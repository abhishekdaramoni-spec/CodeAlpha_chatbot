import os
import sys

# Add current directory to path so we can import from app.py
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import faq_matcher, preprocess_text, correct_spelling

# Define 40 test cases mapping to expected FAQ IDs
test_cases = [
    # --- Standard Paraphrased Cases ---
    {
        "query": "Where do I send my transcripts to apply?",
        "expected_id": 9,
        "category": "Admissions"
    },
    {
        "query": "When is the absolute last day to submit a fall application?",
        "expected_id": 2,
        "category": "Admissions"
    },
    {
        "query": "Is there a deadline for spring semester applications?",
        "expected_id": 3,
        "category": "Admissions"
    },
    {
        "query": "How can I avoid paying the fifty dollar application fee?",
        "expected_id": 4,
        "category": "Admissions"
    },
    {
        "query": "Can I join your university if I am currently in a different college?",
        "expected_id": 5,
        "category": "Admissions"
    },
    {
        "query": "Do you accept Duolingo for English proficiency exams?",
        "expected_id": 6,
        "category": "International"
    },
    {
        "query": "What grade point average do I need to get admitted?",
        "expected_id": 7,
        "category": "Admissions"
    },
    {
        "query": "Do I have to submit my SAT or ACT results?",
        "expected_id": 8,
        "category": "Admissions"
    },
    {
        "query": "Can you give me a list of all documents required for application?",
        "expected_id": 9,
        "category": "Admissions"
    },
    {
        "query": "Can I take a gap year before starting my freshman year?",
        "expected_id": 10,
        "category": "Admissions"
    },
    {
        "query": "Where can I log in to see if I got accepted?",
        "expected_id": 11,
        "category": "Admissions"
    },
    {
        "query": "Are first-year students required to live in the dorms?",
        "expected_id": 12,
        "category": "Housing"
    },
    {
        "query": "Where do I sign up for a dorm room?",
        "expected_id": 13,
        "category": "Housing"
    },
    {
        "query": "What is the cost of study per year?",
        "expected_id": 14,
        "category": "Financials"
    },
    {
        "query": "How much do campus food and lodging cost annually?",
        "expected_id": 15,
        "category": "Financials"
    },
    {
        "query": "Are there any academic awards for high school grades?",
        "expected_id": 16,
        "category": "Financials"
    },
    {
        "query": "What is the website to apply for federal student aid?",
        "expected_id": 17,
        "category": "Financials"
    },
    {
        "query": "By what date must FAFSA be completed?",
        "expected_id": 18,
        "category": "Financials"
    },
    {
        "query": "How do I apply for on-campus student jobs under financial aid?",
        "expected_id": 19,
        "category": "Financials"
    },
    {
        "query": "Can we pay the tuition fees in monthly installments?",
        "expected_id": 20,
        "category": "Financials"
    },
    {
        "query": "What is the typical class size in a lecture?",
        "expected_id": 21,
        "category": "Academics"
    },
    {
        "query": "How many students are there per professor?",
        "expected_id": 22,
        "category": "Academics"
    },
    {
        "query": "Which undergraduate degrees are the most popular?",
        "expected_id": 23,
        "category": "Academics"
    },
    {
        "query": "What is the process to switch to a different major?",
        "expected_id": 24,
        "category": "Academics"
    },
    {
        "query": "Can I choose two majors at the same time?",
        "expected_id": 25,
        "category": "Academics"
    },
    {
        "query": "Does your university offer study abroad programs?",
        "expected_id": 26,
        "category": "Academics"
    },
    {
        "query": "Does the career center help with resume writing and mock interviews?",
        "expected_id": 27,
        "category": "Support"
    },
    {
        "query": "Are there emergency blue lights on campus for safety?",
        "expected_id": 28,
        "category": "Campus Life"
    },
    {
        "query": "Is there a doctor's clinic on campus for sick students?",
        "expected_id": 29,
        "category": "Support"
    },
    {
        "query": "Do you offer free therapy or mental health support?",
        "expected_id": 30,
        "category": "Support"
    },

    # --- Spelling Correction Test Cases ---
    {
        "query": "admision requirments",
        "expected_id": 1,
        "category": "Spelling Correction"
    },
    {
        "query": "scholerships",
        "expected_id": 16,
        "category": "Spelling Correction"
    },
    {
        "query": "what is the tuition fee for foregn students",
        "expected_id": 14,
        "category": "Spelling Correction"
    },
    {
        "query": "dormitory avalability for new studnts",
        "expected_id": 12,
        "category": "Spelling Correction"
    },
    {
        "query": "academic advisors switch magor",
        "expected_id": 24,
        "category": "Spelling Correction"
    },
    {
        "query": "counseling centar free therapi",
        "expected_id": 30,
        "category": "Spelling Correction"
    },

    # --- Broad Synonym & Paraphrase Test Cases ---
    {
        "query": "How much does a year of studying cost?",
        "expected_id": 14,
        "category": "Synonyms & Edge Cases"
    },
    {
        "query": "Where do I sleep on campus?",
        "expected_id": 12,
        "category": "Synonyms & Edge Cases"
    },
    {
        "query": "Can I bring my vehicle to campus?",
        "expected_id": 38,
        "category": "Synonyms & Edge Cases"
    },
    {
        "query": "Is there a fitness center with weights?",
        "expected_id": 36,
        "category": "Synonyms & Edge Cases"
    }
]

def run_tests():
    print("=" * 80)
    print("         SUNRISE UNIVERSITY CHATBOT ACCURACY & INTEGRATION TESTING SUITE         ")
    print("=" * 80)
    print(f"Total Test Cases Loaded: {len(test_cases)}")
    print(f"Database FAQ Nodes: {len(faq_matcher.faqs)}")
    print(f"Corpus Match Variations: {len(faq_matcher.corpus_sentences)}")
    print(f"SentenceTransformers status: {'ENABLED (all-MiniLM-L6-v2)' if faq_matcher.transformer_model else 'DISABLED (TF-IDF Fallback Active)'}")
    print("-" * 80)

    passed_count = 0
    failed_count = 0
    total_score = 0.0
    failed_cases = []

    print(f"{'ID':<3} | {'Test Query':<42} | {'Corrected Query':<36} | {'Match?':<6} | {'Score':<6} | {'Target FAQ'}")
    print("-" * 135)

    for idx, case in enumerate(test_cases, 1):
        query = case["query"]
        expected_id = case["expected_id"]
        
        # Check spelling corrector output
        corrected = correct_spelling(query)
        
        top_matches, _ = faq_matcher.query(query)
        best_match = top_matches[0] if top_matches else None
        score = best_match["score"] if best_match else 0.0
        
        total_score += score
        match_success = False
        
        if best_match and best_match["faq"]["id"] == expected_id:
            match_success = True
            passed_count += 1
            status = "PASSED"
        else:
            failed_count += 1
            status = "FAILED"
            failed_cases.append({
                "query": query,
                "corrected": corrected,
                "expected_id": expected_id,
                "matched_id": best_match["faq"]["id"] if best_match else None,
                "matched_question": best_match["faq"]["question"] if best_match else "None",
                "score": score,
                "matched_expression": best_match["matched_text"] if best_match else "None"
            })

        display_query = query if len(query) <= 42 else query[:39] + "..."
        display_corrected = corrected if len(corrected) <= 36 else corrected[:33] + "..."
        display_matched = best_match["faq"]["question"] if best_match else "None"
        display_matched = display_matched if len(display_matched) <= 25 else display_matched[:22] + "..."
        
        print(f"{idx:<3} | {display_query:<42} | {display_corrected:<36} | {status:<6} | {score:.4f} | #{expected_id} ({display_matched})")

    accuracy = (passed_count / len(test_cases)) * 100
    avg_score = total_score / len(test_cases)

    print("=" * 135)
    print("                                TESTING METRICS SUMMARY                             ")
    print("=" * 80)
    print(f"  Passed Cases:       {passed_count} / {len(test_cases)}")
    print(f"  Failed Cases:       {failed_count} / {len(test_cases)}")
    print(f"  Matching Accuracy:  {accuracy:.2f}%")
    print(f"  Average Similarity: {avg_score:.4f}")
    print("=" * 80)

    if failed_cases:
        print("\n" + "!" * 80)
        print("                              DIAGNOSING FAILED CASES                              ")
        print("!" * 80)
        for i, fc in enumerate(failed_cases, 1):
            print(f"Failure #{i}:")
            print(f"  User Query:         \"{fc['query']}\"")
            print(f"  Spell Corrected:    \"{fc['corrected']}\"")
            print(f"  Expected FAQ ID:    #{fc['expected_id']}")
            print(f"  Actually Matched:   #{fc['matched_id']} - \"{fc['matched_question']}\"")
            print(f"  Similarity Score:   {fc['score']:.4f}")
            print(f"  Matched Expression: \"{fc['matched_expression']}\"")
            print("-" * 80)
    else:
        print("\n[SUCCESS] PERFECT UPGRADED ACCURACY! All 40 misspelled, synonym-based, and paraphrased queries matched.")
        print("This verifies that our SpellChecker + NLTK preprocess + similarity logic is incredibly resilient.")
    print("=" * 80)

if __name__ == "__main__":
    run_tests()
