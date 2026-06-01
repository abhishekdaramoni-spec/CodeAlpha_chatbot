import os
import re
import json
import string
import logging
import uuid
from datetime import datetime
from flask import Flask, request, jsonify, render_template, send_file
import os
import nltk

nltk_data_dir = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "nltk_data"
)

os.makedirs(nltk_data_dir, exist_ok=True)

if nltk_data_dir not in nltk.data.path:
    nltk.data.path.append(nltk_data_dir)

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Flask App
app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "faq_chatbot_super_secret_key_123")

# Admin Configuration
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
CONFIDENCE_THRESHOLD = 0.25

# Setup NLTK Auto-Downloader
import nltk
required_nltk_packages = ['punkt', 'stopwords', 'wordnet', 'averaged_perceptron_tagger', 'averaged_perceptron_tagger_eng']
for package in required_nltk_packages:
    try:
        if package == 'punkt':
            nltk.data.find('tokenizers/punkt')
        elif package == 'stopwords':
            nltk.data.find('corpora/stopwords')
        elif package == 'wordnet':
            nltk.data.find('corpora/wordnet')
        elif package == 'averaged_perceptron_tagger':
            nltk.data.find('taggers/averaged_perceptron_tagger')
        elif package == 'averaged_perceptron_tagger_eng':
            nltk.data.find('taggers/averaged_perceptron_tagger_eng')
    except LookupError:
        logger.info(f"Downloading required NLTK package: {package}")
        try:
            nltk.download(package, quiet=True)
        except Exception as e:
            logger.warning(f"NLTK download failed for {package}: {e}")

from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from nltk import pos_tag

# Initialize SpellChecker
from spellchecker import SpellChecker
spell = SpellChecker()

# Whitelist common university/admission terms from spellchecker
custom_whitelist = [
    "fafsa", "sat", "act", "gpa", "ap", "ib", "toefl", "ielts", "duolingo", 
    "sunrise", "sunassist", "sunriseuniversity", "commonapp", "bursar", "fraternities", "sororities", "freshman", "freshmen",
    "rec", "gym", "undergraduate", "workstudy", "mealplan", "mealplans"
]
spell.word_frequency.load_words(custom_whitelist)

# Initialize NLTK utilities
lemmatizer = WordNetLemmatizer()
try:
    stop_words = set(stopwords.words('english'))
except Exception:
    nltk.download('stopwords', quiet=True)
    stop_words = set(stopwords.words('english'))

# Optional Sentence Transformers support
HAS_TRANSFORMERS = False
try:
    from sentence_transformers import SentenceTransformer, util
    import torch
    HAS_TRANSFORMERS = True
    logger.info("SentenceTransformers package successfully imported!")
except ImportError:
    logger.info("SentenceTransformers not installed. Defaulting to TF-IDF.")

# File Paths
DATA_FILE = os.path.join(os.path.dirname(__file__), 'faq_data.json')
ANALYTICS_FILE = os.path.join(os.path.dirname(__file__), 'query_analytics.json')

# Initialize Analytics Log
if not os.path.exists(ANALYTICS_FILE):
    with open(ANALYTICS_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f)

def get_wordnet_pos(tag):
    """Map POS tag to first character lemmatize() accepts"""
    tag = tag.upper()
    if tag.startswith('J'):
        return 'a'  # Adjective
    elif tag.startswith('V'):
        return 'v'  # Verb
    elif tag.startswith('N'):
        return 'n'  # Noun
    elif tag.startswith('R'):
        return 'r'  # Adverb
    else:
        return 'n'  # Default to noun

def correct_spelling(text):
    """Automatically correct spelling mistakes using pyspellchecker while preserving whitelisted terms"""
    if not text:
        return ""
    
    # Strip punctuation but keep spaces for spelling correction word tokenize
    cleaned_punctuation = text.translate(str.maketrans(string.punctuation, ' ' * len(string.punctuation)))
    words = cleaned_punctuation.split()
    corrected_words = []
    
    for word in words:
        lowered_word = word.lower()
        if lowered_word.isdigit():
            corrected_words.append(word)
            continue
            
        unknown = spell.unknown([lowered_word])
        if unknown and lowered_word not in custom_whitelist:
            corr = spell.correction(lowered_word)
            corrected_words.append(corr if corr else word)
        else:
            corrected_words.append(word)
            
    return " ".join(corrected_words)

def preprocess_text(text):
    """
    Robust preprocessing pipeline:
    1. Spelling correction
    2. Lowercasing
    3. Punctuation removal
    4. Tokenization
    5. Stopword removal
    6. POS-tagged Lemmatization
    """
    if not text:
        return ""
    
    # Spelling Correction
    text = correct_spelling(text)
    
    # Lowercase
    text = text.lower()
    
    # Remove punctuation
    text = text.translate(str.maketrans('', '', string.punctuation))
    
    # Tokenize
    tokens = word_tokenize(text)
    
    # Get POS tags
    tagged_tokens = pos_tag(tokens)
    
    # Filter stopwords and lemmatize
    cleaned_tokens = []
    for word, tag in tagged_tokens:
        if word not in stop_words:
            pos = get_wordnet_pos(tag)
            lemma = lemmatizer.lemmatize(word, pos)
            cleaned_tokens.append(lemma)
            
    return " ".join(cleaned_tokens)

# scikit-learn TF-IDF & Cosine Similarity components
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

class FAQMatcher:
    def __init__(self, data_file_path):
        self.data_file_path = data_file_path
        self.faqs = []
        
        # TF-IDF variables
        self.corpus_sentences = []
        self.corpus_mapping = []  # Map each corpus sentence index back to (faq_index, original_text, is_primary)
        self.vectorizer = TfidfVectorizer()
        self.tfidf_matrix = None
        
        # Sentence Transformer variables
        self.transformer_model = None
        self.transformer_embeddings = None
        self.transformer_corpus_texts = []
        self.transformer_mapping = [] # Map index to faq_index
        
        self.reload()

    def reload(self):
        """Loads FAQs and fits the active matching engine (SentenceTransformers or TF-IDF fallback)"""
        logger.info("Loading FAQ database and compiling semantic indexes...")
        try:
            if not os.path.exists(self.data_file_path):
                logger.error(f"FAQ data file not found at {self.data_file_path}!")
                self.faqs = []
                return
            
            with open(self.data_file_path, 'r', encoding='utf-8') as f:
                self.faqs = json.load(f)
            
            # 1. Prepare TF-IDF Corpus
            self.corpus_sentences = []
            self.corpus_mapping = []
            
            for idx, faq in enumerate(self.faqs):
                primary_q = faq.get("question", "").strip()
                if primary_q:
                    self.corpus_sentences.append(preprocess_text(primary_q))
                    self.corpus_mapping.append((idx, primary_q, True))
                
                variations = faq.get("variations", [])
                for var in variations:
                    var = var.strip()
                    if var:
                        self.corpus_sentences.append(preprocess_text(var))
                        self.corpus_mapping.append((idx, var, False))
            
            if self.corpus_sentences:
                self.vectorizer = TfidfVectorizer(token_pattern=r'(?u)\b\w+\b')
                self.tfidf_matrix = self.vectorizer.fit_transform(self.corpus_sentences)
                logger.info(f"TF-IDF fitted with {len(self.corpus_sentences)} match expressions.")
            else:
                self.tfidf_matrix = None
                
            # 2. Try loading SentenceTransformers
            self.transformer_model = None
            self.transformer_embeddings = None
            self.transformer_corpus_texts = []
            self.transformer_mapping = []
            
            if HAS_TRANSFORMERS:
                try:
                    logger.info("Initializing SentenceTransformer Model: all-MiniLM-L6-v2...")
                    self.transformer_model = SentenceTransformer('all-MiniLM-L6-v2')
                    
                    for idx, faq in enumerate(self.faqs):
                        primary_q = faq.get("question", "").strip()
                        if primary_q:
                            self.transformer_corpus_texts.append(primary_q)
                            self.transformer_mapping.append((idx, primary_q, True))
                        
                        variations = faq.get("variations", [])
                        for var in variations:
                            var = var.strip()
                            if var:
                                self.transformer_corpus_texts.append(var)
                                self.transformer_mapping.append((idx, var, False))
                                
                    if self.transformer_corpus_texts:
                        self.transformer_embeddings = self.transformer_model.encode(
                            self.transformer_corpus_texts, 
                            convert_to_tensor=True
                        )
                        logger.info("SentenceTransformer embeddings successfully built.")
                except Exception as ex:
                    logger.warning(f"Failed to load SentenceTransformer: {ex}. Using default TF-IDF fallbacks.")
                    self.transformer_model = None
                    
        except Exception as e:
            logger.exception(f"Error occurred during FAQMatcher reload: {e}")

    def query(self, user_query, category_filters=None):
        """
        Processes user query, filters by category, and returns the top 3 unique FAQ suggestions
        with confidence scores.
        """
        # Ensure database is loaded
        if not self.faqs:
            return [], "System database is empty."
            
        # Spelling Correction & Clean
        spelled_corrected = correct_spelling(user_query)
        processed_query = preprocess_text(user_query)
        if not processed_query.strip():
            return [], ""

        similarities = []
        mapping_ref = []
        
        # 1. Perform Matching
        try:
            if self.transformer_model is not None and self.transformer_embeddings is not None:
                # Use Transformers
                query_emb = self.transformer_model.encode(spelled_corrected, convert_to_tensor=True)
                cos_scores = util.cos_sim(query_emb, self.transformer_embeddings)[0]
                similarities = cos_scores.cpu().numpy()
                mapping_ref = self.transformer_mapping
            elif self.tfidf_matrix is not None:
                # Fall back to TF-IDF
                query_vector = self.vectorizer.transform([processed_query])
                similarities = cosine_similarity(query_vector, self.tfidf_matrix).flatten()
                mapping_ref = self.corpus_mapping
            else:
                return [], "Matching engine is not initialized."
        except Exception as ex:
            logger.error(f"Error during core similarity calculation: {ex}")
            return [], "Matching operation failed."

        # 2. Apply Category Filters (by setting similarity of out-of-category nodes to -1.0)
        if category_filters:
            normalized_filters = [c.lower().replace(" ", "") for c in category_filters]
            for i, ref in enumerate(mapping_ref):
                faq_idx = ref[0]
                faq = self.faqs[faq_idx]
                faq_cat = faq.get("category", "General").lower().replace(" ", "")
                if faq_cat not in normalized_filters:
                    similarities[i] = -1.0

        # 3. Compile Top 3 Unique FAQs
        sorted_indices = np.argsort(similarities)[::-1]
        seen_ids = set()
        top_matches = []
        
        for idx in sorted_indices:
            score = float(similarities[idx])
            if score < -0.5: # filtered out by category
                continue
                
            faq_idx, matched_text, is_primary = mapping_ref[idx]
            faq = self.faqs[faq_idx]
            faq_id = faq["id"]
            
            if faq_id not in seen_ids:
                seen_ids.add(faq_id)
                top_matches.append({
                    "faq": faq,
                    "score": round(max(0.0, score), 4),
                    "matched_text": matched_text
                })
                if len(top_matches) >= 3:
                    break
                    
        return top_matches, spelled_corrected

# Initialize FAQ Matcher
faq_matcher = FAQMatcher(DATA_FILE)

# Helper function to check admin password
def verify_admin_auth():
    auth_header = request.headers.get("X-Admin-Password")
    return auth_header == ADMIN_PASSWORD

# Helper function to validate schema duplicates
def validate_faq_schema(faq_list, ignore_id=None):
    """
    Validates duplicates in FAQ catalog:
    1. Duplicate primary questions.
    2. Duplicate variations (across same or other FAQs).
    Returns (is_valid, error_message)
    """
    questions = {}
    variations = {}
    
    for faq in faq_list:
        fid = faq.get("id")
        if ignore_id is not None and fid == ignore_id:
            continue
            
        q = faq.get("question", "").strip().lower()
        if q:
            if q in questions:
                return False, f"Duplicate primary question detected: \"{faq.get('question')}\" in FAQ ID #{fid} matches FAQ ID #{questions[q]}."
            questions[q] = fid
            
        vars = faq.get("variations", [])
        for v in vars:
            v_clean = v.strip().lower()
            if v_clean:
                if v_clean in variations:
                    return False, f"Duplicate query variation detected: \"{v}\" in FAQ ID #{fid} matches variation in FAQ ID #{variations[v_clean]}."
                variations[v_clean] = fid
                
    return True, ""

# Routes
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/autocomplete', methods=['GET'])
def autocomplete_index():
    """Returns a flat list of all primary questions and variations for instant client autocomplete"""
    try:
        suggestions = []
        for faq in faq_matcher.faqs:
            q = faq.get("question", "").strip()
            if q:
                suggestions.append(q)
            for v in faq.get("variations", []):
                v = v.strip()
                if v:
                    suggestions.append(v)
        # Remove duplicates while keeping order
        seen = set()
        unique_suggestions = [x for x in suggestions if not (x.lower() in seen or seen.add(x.lower()))]
        return jsonify({"suggestions": unique_suggestions, "success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    """Handles chatbot user questions, logs query analytics, and returns top 3 matching FAQs"""
    try:
        data = request.get_json() or {}
        user_message = data.get("message", "").strip()
        category_filters = data.get("categories", [])
        
        if not user_message:
            return jsonify({
                "answer": "Please say something! I am here to help.",
                "confidence": 0.0,
                "success": False
            }), 400
            
        top_matches, corrected_query = faq_matcher.query(user_message, category_filters)
        
        top_match = top_matches[0] if top_matches else None
        top_score = top_match["score"] if top_match else 0.0
        
        # Build Response
        log_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        
        if top_score >= CONFIDENCE_THRESHOLD and top_match:
            best_faq = top_match["faq"]
            response_payload = {
                "log_id": log_id,
                "answer": best_faq["answer"],
                "confidence": top_score,
                "matched_question": best_faq["question"],
                "matched_expression": top_match["matched_text"],
                "category": best_faq.get("category", "General"),
                "corrected_query": corrected_query,
                "success": True,
                "top_suggestions": [
                    {
                        "question": m["faq"]["question"],
                        "answer": m["faq"]["answer"],
                        "score": m["score"],
                        "category": m["faq"].get("category", "General")
                    } for m in top_matches[1:] # exclude the top match
                ]
            }
            matched_faq_id = best_faq["id"]
            matched_faq_q = best_faq["question"]
            matched_cat = best_faq.get("category", "General")
        else:
            # Low Confidence Fallback
            suggestions_list = [
                {
                    "question": m["faq"]["question"],
                    "answer": m["faq"]["answer"],
                    "score": m["score"],
                    "category": m["faq"].get("category", "General")
                } for m in top_matches
            ]
            
            response_payload = {
                "log_id": log_id,
                "answer": "Sorry, I couldn't find a relevant answer. Please rephrase your question.",
                "confidence": top_score,
                "corrected_query": corrected_query,
                "success": False,
                "top_suggestions": suggestions_list
            }
            matched_faq_id = None
            matched_faq_q = "None"
            matched_cat = "Failed Search"
            
        # Log to Query Analytics
        try:
            log_entry = {
                "id": log_id,
                "timestamp": timestamp,
                "user_query": user_message,
                "corrected_query": corrected_query,
                "matched_faq_id": matched_faq_id,
                "matched_faq_question": matched_faq_q,
                "confidence": top_score,
                "category": matched_cat,
                "feedback": None
            }
            
            with open(ANALYTICS_FILE, 'r+', encoding='utf-8') as f:
                logs = json.load(f)
                logs.append(log_entry)
                f.seek(0)
                json.dump(logs, f, indent=2, ensure_ascii=False)
                f.truncate()
        except Exception as le:
            logger.error(f"Failed to write query analytics log: {le}")
            
        return jsonify(response_payload)
            
    except Exception as e:
        logger.exception("Error in /api/chat endpoint")
        return jsonify({
            "answer": "Sorry, an internal error occurred while processing your request.",
            "confidence": 0.0,
            "success": False
        }), 500

@app.route('/api/feedback', methods=['POST'])
def save_feedback():
    """Stores user thumbs up/down feedback against logged query ID"""
    try:
        data = request.get_json() or {}
        log_id = data.get("log_id")
        feedback = data.get("feedback") # "helpful" or "not_helpful"
        
        if not log_id or feedback not in ["helpful", "not_helpful"]:
            return jsonify({"success": False, "message": "Invalid request parameters."}), 400
            
        updated = False
        with open(ANALYTICS_FILE, 'r+', encoding='utf-8') as f:
            logs = json.load(f)
            for log in logs:
                if log.get("id") == log_id:
                    log["feedback"] = feedback
                    updated = True
                    break
            if updated:
                f.seek(0)
                json.dump(logs, f, indent=2, ensure_ascii=False)
                f.truncate()
                return jsonify({"success": True, "message": "Feedback submitted successfully."})
            else:
                return jsonify({"success": False, "message": "Log session not found."}), 404
    except Exception as e:
        logger.error(f"Error saving feedback: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# ADMIN CONTROLS & UTILITIES

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    """Verifies admin credentials"""
    data = request.get_json() or {}
    password = data.get("password", "")
    if password == ADMIN_PASSWORD:
        return jsonify({"success": True, "message": "Authenticated successfully."})
    return jsonify({"success": False, "message": "Invalid password."}), 401

@app.route('/api/admin/faqs', methods=['GET'])
def get_admin_faqs():
    """Returns all FAQ items for administration UI"""
    if not verify_admin_auth():
        return jsonify({"success": False, "message": "Unauthorized access."}), 401
    return jsonify({
        "faqs": faq_matcher.faqs,
        "success": True
    })

@app.route('/api/admin/faqs', methods=['POST'])
def create_faq():
    """Creates a new FAQ entry with strict validation checking for duplicate questions and variations"""
    if not verify_admin_auth():
        return jsonify({"success": False, "message": "Unauthorized access."}), 401
        
    try:
        new_faq = request.get_json() or {}
        question = new_faq.get("question", "").strip()
        answer = new_faq.get("answer", "").strip()
        category = new_faq.get("category", "General").strip()
        variations = [v.strip() for v in new_faq.get("variations", []) if v.strip()]
        
        if not question or not answer:
            return jsonify({"success": False, "message": "Question and Answer are required."}), 400
            
        faqs = faq_matcher.faqs
        new_id = max([f.get("id", 0) for f in faqs]) + 1 if faqs else 1
        
        formatted_faq = {
            "id": new_id,
            "category": category,
            "question": question,
            "variations": variations,
            "answer": answer
        }
        
        # Validate for duplicates
        temp_list = faqs + [formatted_faq]
        is_valid, err_msg = validate_faq_schema(temp_list)
        if not is_valid:
            return jsonify({"success": False, "message": err_msg}), 409
            
        faqs.append(formatted_faq)
        
        # Write to JSON
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(faqs, f, indent=2, ensure_ascii=False)
            
        # Re-vectorize
        faq_matcher.reload()
        
        return jsonify({"success": True, "faq": formatted_faq, "message": "FAQ created successfully."})
    except Exception as e:
        logger.exception("Error in create_faq")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/admin/faqs/<int:faq_id>', methods=['PUT'])
def update_faq(faq_id):
    """Updates an existing FAQ entry with duplicate check validation"""
    if not verify_admin_auth():
        return jsonify({"success": False, "message": "Unauthorized access."}), 401
        
    try:
        updated_data = request.get_json() or {}
        question = updated_data.get("question", "").strip()
        answer = updated_data.get("answer", "").strip()
        category = updated_data.get("category", "General").strip()
        variations = [v.strip() for v in updated_data.get("variations", []) if v.strip()]
        
        if not question or not answer:
            return jsonify({"success": False, "message": "Question and Answer are required."}), 400
            
        faqs = faq_matcher.faqs
        target_idx = -1
        for idx, faq in enumerate(faqs):
            if faq.get("id") == faq_id:
                target_idx = idx
                break
                
        if target_idx == -1:
            return jsonify({"success": False, "message": "FAQ item not found."}), 404
            
        # Prepare proposed updated element
        proposed_faq = {
            "id": faq_id,
            "category": category,
            "question": question,
            "variations": variations,
            "answer": answer
        }
        
        # Validate proposed against everything except this active item id
        temp_list = [f for f in faqs if f.get("id") != faq_id] + [proposed_faq]
        is_valid, err_msg = validate_faq_schema(temp_list)
        if not is_valid:
            return jsonify({"success": False, "message": err_msg}), 409
            
        # Commit update
        faqs[target_idx] = proposed_faq
        
        # Write to JSON
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(faqs, f, indent=2, ensure_ascii=False)
            
        # Re-vectorize
        faq_matcher.reload()
        
        return jsonify({"success": True, "faq": faqs[target_idx], "message": "FAQ updated successfully."})
    except Exception as e:
        logger.exception("Error in update_faq")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/admin/faqs/<int:faq_id>', methods=['DELETE'])
def delete_faq(faq_id):
    """Deletes an FAQ entry by ID"""
    if not verify_admin_auth():
        return jsonify({"success": False, "message": "Unauthorized access."}), 401
        
    try:
        faqs = faq_matcher.faqs
        target_idx = -1
        for idx, faq in enumerate(faqs):
            if faq.get("id") == faq_id:
                target_idx = idx
                break
                
        if target_idx == -1:
            return jsonify({"success": False, "message": "FAQ item not found."}), 404
            
        # Remove
        deleted_faq = faqs.pop(target_idx)
        
        # Write to JSON
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(faqs, f, indent=2, ensure_ascii=False)
            
        # Re-vectorize
        faq_matcher.reload()
        
        return jsonify({"success": True, "message": "FAQ deleted successfully.", "deleted_id": faq_id})
    except Exception as e:
        logger.exception("Error in delete_faq")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/admin/faqs/export', methods=['GET'])
def export_faqs():
    """Exports the entire FAQ JSON database file as an attachment download"""
    if not verify_admin_auth():
        return jsonify({"success": False, "message": "Unauthorized access."}), 401
    return send_file(DATA_FILE, as_attachment=True, download_name="faq_data_export.json")

@app.route('/api/admin/faqs/import', methods=['POST'])
def import_faqs():
    """Imports entire FAQ JSON file with schema structure and duplicate checks validation"""
    if not verify_admin_auth():
        return jsonify({"success": False, "message": "Unauthorized access."}), 401
        
    try:
        if 'file' not in request.files:
            return jsonify({"success": False, "message": "No file uploaded."}), 400
            
        uploaded_file = request.files['file']
        if not uploaded_file.filename.endswith('.json'):
            return jsonify({"success": False, "message": "Invalid file format. Must be a JSON file."}), 400
            
        imported_list = json.load(uploaded_file)
        if not isinstance(imported_list, list):
            return jsonify({"success": False, "message": "Invalid JSON format. Expected a list of FAQ objects."}), 400
            
        # Validate basic schema fields of every object
        for idx, faq in enumerate(imported_list):
            if not isinstance(faq, dict) or "question" not in faq or "answer" not in faq:
                return jsonify({"success": False, "message": f"Object at index {idx} is invalid. Question and Answer properties are required."}), 400
            # Ensure proper types
            faq["id"] = faq.get("id", idx + 1)
            faq["category"] = faq.get("category", "General").strip()
            faq["question"] = faq.get("question", "").strip()
            faq["variations"] = [v.strip() for v in faq.get("variations", []) if v.strip()]
            faq["answer"] = faq.get("answer", "").strip()
            
        # Check for duplicates inside the imported file
        is_valid, err_msg = validate_faq_schema(imported_list)
        if not is_valid:
            return jsonify({"success": False, "message": f"Validation failed in uploaded file: {err_msg}"}), 409
            
        # Write to JSON store
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(imported_list, f, indent=2, ensure_ascii=False)
            
        # Re-vectorize
        faq_matcher.reload()
        
        return jsonify({
            "success": True, 
            "message": f"Knowledge base imported successfully. Vectorized {len(imported_list)} FAQ nodes.",
            "count": len(imported_list)
        })
    except Exception as e:
        logger.exception("Error in import_faqs")
        return jsonify({"success": False, "message": f"Failed to parse JSON: {str(e)}"}), 500

@app.route('/api/admin/analytics', methods=['GET'])
def get_admin_analytics():
    """Computes aggregated dashboard stats from query logs"""
    if not verify_admin_auth():
        return jsonify({"success": False, "message": "Unauthorized access."}), 401
        
    try:
        with open(ANALYTICS_FILE, 'r', encoding='utf-8') as f:
            logs = json.load(f)
            
        total_queries = len(logs)
        if total_queries == 0:
            return jsonify({
                "success": True,
                "total_queries": 0,
                "avg_confidence": 0.0,
                "success_count": 0,
                "failed_count": 0,
                "top_asked": [],
                "top_failed": [],
                "category_distribution": {},
                "feedback_stats": {"helpful": 0, "not_helpful": 0, "no_feedback": 0}
            })
            
        # Metrics Calculations
        sum_confidence = 0.0
        success_count = 0
        failed_count = 0
        
        faq_counts = {}
        failed_queries = {}
        category_counts = {}
        
        feedback_helpful = 0
        feedback_not_helpful = 0
        feedback_none = 0
        
        for log in logs:
            score = log.get("confidence", 0.0)
            sum_confidence += score
            
            # Matched status
            if log.get("matched_faq_id") is not None:
                success_count += 1
                faq_q = log.get("matched_faq_question", "Unknown")
                faq_counts[faq_q] = faq_counts.get(faq_q, 0) + 1
            else:
                failed_count += 1
                raw_q = log.get("user_query", "").strip()
                if raw_q:
                    failed_queries[raw_q] = failed_queries.get(raw_q, 0) + 1
                    
            # Category counting
            cat = log.get("category", "General")
            category_counts[cat] = category_counts.get(cat, 0) + 1
            
            # Feedback
            fb = log.get("feedback")
            if fb == "helpful":
                feedback_helpful += 1
            elif fb == "not_helpful":
                feedback_not_helpful += 1
            else:
                feedback_none += 1
                
        # Sort and get top elements
        sorted_asked = sorted(faq_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        sorted_failed = sorted(failed_queries.items(), key=lambda x: x[1], reverse=True)[:5]
        
        top_asked = [{"question": k, "count": v} for k, v in sorted_asked]
        top_failed = [{"query": k, "count": v} for k, v in sorted_failed]
        
        return jsonify({
            "success": True,
            "total_queries": total_queries,
            "avg_confidence": round(sum_confidence / total_queries, 4),
            "success_count": success_count,
            "failed_count": failed_count,
            "top_asked": top_asked,
            "top_failed": top_failed,
            "category_distribution": category_counts,
            "feedback_stats": {
                "helpful": feedback_helpful,
                "not_helpful": feedback_not_helpful,
                "no_feedback": feedback_none
            }
        })
    except Exception as e:
        logger.exception("Error in get_admin_analytics")
        return jsonify({"success": False, "message": str(e)}), 500

# Standalone run
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
