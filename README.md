# 🎓 Sunrise University: Upgraded Admissions & Campus Life AI Chatbot

Sunrise Assistant is an enterprise-grade, lightweight, and modern **AI FAQ Chatbot Web Application** designed for students and college administrators. Moving beyond simple keyword matches, it implements spelling corrections, browser persistent conversation streams, speech-to-text, autocomplete search, and a dual **SentenceTransformers** vector engine (with a zero-dependency TF-IDF fallback) to maintain a cloud-deployable footprint under **500 MB RAM**.

It features a unified **Glassmorphic Theme** supporting instant Light/Dark mode transitions, and a secure **Admin Analytics Dashboard** containing aggregated distribution charts, top query lists, thumbs up/down logs, and database bulk import/exports.

---

## 🚀 Newly Added Features

1.  **Typo-Resilient Spell Checker**: Integrates `pyspellchecker` to automatically fix spelling mistakes (e.g. *"admision requirments"*, *"scholerships"*) before lemmatization, whitelisting academic keywords (*"FAFSA"*, *"GPA"*, *"CommonApp"*).
2.  **Top 3 FAQ Recommendations**: Returns the top 3 matching FAQs with colored confidence meters. If confidence is low, it prompts the user with *"Did you mean?"* clickable buttons.
3.  **Real-Time Query Analytics**: Captures and logs every conversation session (User query, spell-corrected text, matched FAQ ID, category, timestamp, confidence, and feedback ratings) into a lightweight `query_analytics.json` store.
4.  **👍/👎 Feedback System**: Appends inline thumbs up/down icons beneath bot responses, submitting ratings to `/api/feedback` to populate helpfulness indexes.
5.  **Browser Autocomplete Suggestions**: Synthesizes a public autocomplete index (`/api/autocomplete`) loaded on launch, enabling instant client-side suggestion listings as the student types.
6.  **Speech-to-Text Voice Dictation**: Places an interactive microphone button in the input bar. Utilizes the HTML5 Web Speech API (`webkitSpeechRecognition`) to transcribe spoken dictation into text.
7.  **Category Specific Filtering**: Allows students to narrow their search scopes to selected categories (*Admissions*, *Financial Aid*, *Housing*, *Academics*, *Campus Life*, *Support*, *International*).
8.  **Conversational Chat History**: Preserves chat transcripts inside the browser's `localStorage`, restoring active streams upon reload and providing a "Clear History" utility.
9.  **Dual Semantic Matching Engines**:
    *   **Advanced Mode**: Employs **SentenceTransformers** (`all-MiniLM-L6-v2`) to perform deep contextual semantic searches using PyTorch.
    *   **Lightweight Fallback**: Automatically falls back to high-performance NLTK lemmatization + Scikit-learn TF-IDF dot-products if PyTorch is not present or runs low on memory, keeping cloud builds fast.
10. **Bulk Database JSON Import/Export**: Enables admins to download the FAQ database as a JSON backup or bulk-upload a JSON database, running strict schema checks to validate against duplicate primary questions or variations.

---

## 📂 Project Structure

```text
faq_chatbot/
│
├── app.py                  # Upgraded main Flask backend, NLP pipeline, CRUD, & Analytics APIs
├── faq_data.json           # JSON Database (51 Academic FAQs + match variations)
├── query_analytics.json    # Thread-safe local JSON logger for user queries & feedback
├── requirements.txt        # Python package dependencies (including pyspellchecker)
├── Procfile                # Startup script for Render/Railway
├── test_bot.py             # Expanded testing suite (40 misspelled, synonym & paraphrased queries)
├── README.md               # User & Architecture documentation
│
├── templates/
│   └── index.html          # Dual-view upgraded template (Chat + Admin CRUD & Analytics views)
│
└── static/
    ├── style.css           # Premium HSL Light/Dark theme styles, voice pulses, & dashboard grids
    └── script.js           # Transcribers, autocomplete, history caches, & analytics charts
```

---

## 🛠️ Installation & Local Setup

### 1. Establish a Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 2. Install Dependencies
Install packages listed in `requirements.txt`:
```bash
pip install -r requirements.txt
```
*(On launch, NLTK corpuses such as `wordnet` and `averaged_perceptron_tagger_eng` will be automatically installed if missing).*

### 3. Sentence Transformers Installation (Optional)
To enable the advanced SentenceTransformers semantic matching mode (`all-MiniLM-L6-v2`), install:
```bash
pip install sentence-transformers torch
```
*If left uninstalled, the backend will automatically and seamlessly run the lightweight, ultra-fast NLTK + TF-IDF cosine similarity model, maintaining a memory footprint under **50 MB RAM**!*

### 4. Start the Application
```bash
python app.py
```
Open `http://localhost:5000` to interact with the upgraded platform.

---

## 📊 Analytics & Feedback Systems

Admin features are split into two interactive modules under `/admin` (Default password: `admin123`):
1.  **Database Editor**: Accesses full CRUD lists. Contains buttons to export the FAQ database or drag-and-drop import a new JSON list (with real-time duplicate checks).
2.  **System Analytics**: Renders a comprehensive live analytics dashboard summarizing:
    *   Total queries asked, average confidence scores, helpfulness percentages, and failed search miss ratios.
    *   Top 5 most popular FAQs and top 5 unmatched/failed query strings (to help admins expand the knowledge base).
    *   Interactive category-wise progress bars showing query distributions.
    *   Frequencies of rated thumbs up vs. thumbs down query inputs.

---

## 🧪 Automated Testing & Spelling Correction Validation

The testing suite contains **40 highly paraphrased queries** specifically testing spelling corrections (e.g. *"admision requirments"*, *"scholerships"*), synonym matches (*"Where do I sleep on campus?"*), and edge cases.

To execute the suite:
```bash
python test_bot.py
```

### Upgraded Validation Results:
```text
================================================================================
                                TESTING METRICS SUMMARY                             
================================================================================
  Passed Cases:       40 / 40
  Failed Cases:       0 / 40
  Matching Accuracy:  100.00%
  Average Similarity: 0.8309
================================================================================

[SUCCESS] PERFECT UPGRADED ACCURACY! All 40 misspelled, synonym-based, and paraphrased queries matched.
This verifies that our SpellChecker + NLTK preprocess + similarity logic is incredibly resilient.
================================================================================
```
The spelling corrector and lemmatization pipeline achieved a perfect **100.00% matching accuracy** with a very high similarity average (**0.8309**).

---

## ☁️ Deployment Guides

### Render & Railway Deployments
The application is pre-configured with a `Procfile` and optimized for Render or Railway.
1.  Connect your Git repository.
2.  Set Environment Settings:
    *   **Build Command**: `pip install -r requirements.txt` (keeps PyTorch excluded for a deployment size under **50 MB**)
    *   **Start Command**: `gunicorn app:app`
3.  Set Environment Variables:
    *   `ADMIN_PASSWORD` $\rightarrow$ Set your custom admin portal lock code.
