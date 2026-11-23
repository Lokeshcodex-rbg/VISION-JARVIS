import sys
import os
sys.path.insert(0, os.path.abspath("."))
import json
from ml_foundation.tokenizer import JarvisBPE

def test_tokenizer_efficiency():
    tok_path = "data/neural_models/checkpoints/vision-13m-curriculum-breakthrough/tokenizer.json"
    tok = JarvisBPE.load(tok_path)
    
    vocab_size = len(tok.vocab)
    print(f"Loaded tokenizer from {tok_path}, vocab size: {vocab_size}")

    corpus_samples = {
        "english_general": [
            "The quick brown fox jumps over the lazy dog.",
            "Artificial intelligence systems require robust foundation model pretraining and validation.",
            "In computer science, an abstract data type is a mathematical model for data types.",
            "The experiment demonstrated significant improvement in structural convergence and stability.",
            "Newton's laws of motion describe the relationship between a body and the forces acting upon it."
        ],
        "hindi_devanagari": [
            "नमस्ते, आप कैसे हैं? आज मौसम बहुत सुहावना है।",
            "कृत्रिम बुद्धिमत्ता आधुनिक विज्ञान और प्रौद्योगिकी का एक महत्वपूर्ण हिस्सा है।",
            "गणित और भौतिक विज्ञान में समीकरणों का उपयोग प्राकृतिक नियमों को समझने के लिए किया जाता है।",
            "नई दिल्ली भारत की राजधानी है और यह एक ऐतिहासिक शहर है।",
            "शिक्षा मनुष्य को आत्मनिर्भर और विचारशील बनाती है।"
        ],
        "hinglish": [
            "Monday ko dinner ka reminder update kar dena please.",
            "Bhai kal subah meeting kitne baje schedule karni hai?",
            "Code run karke check karo ki koi syntax error toh nahi aa raha.",
            "Yeh formula galat lag raha hai, isko dobara calculate karte hain.",
            "Jarvis mera project documentation summarize kar do."
        ],
        "python_code": [
            "def calculate_factorial(n: int) -> int:\n    if n <= 1:\n        return 1\n    return n * calculate_factorial(n - 1)",
            "class BinarySearchTree:\n    def __init__(self, value):\n        self.val = value\n        self.left = None\n        self.right = None",
            "import torch\nimport torch.nn as nn\n\nclass Attention(nn.Module):\n    def __init__(self, d_model): super().__init__()",
            "for i in range(len(data)):\n    if data[i] % 2 == 0:\n        result.append(data[i] ** 2)",
            "try:\n    response = requests.get(url, timeout=5)\nexcept requests.exceptions.RequestException as e:\n    logger.error(e)"
        ],
        "mathematics_scientific": [
            "Calculate 15% of 850 plus 25% of 640.",
            "Compute the integral of x^2 * sin(x) dx from 0 to pi.",
            "The eigenvalues of matrix A are lambda_1 = 3 and lambda_2 = -1.",
            "Solve the system of equations: 3x + 4y = 25 and 2x - y = 9.",
            "The gravitational force between two masses is F = G * (m1 * m2) / r^2."
        ]
    }

    metrics = {}
    for domain, texts in corpus_samples.items():
        total_chars = 0
        total_words = 0
        total_tokens = 0
        round_trip_passed = True
        
        for t in texts:
            total_chars += len(t)
            words = t.split()
            total_words += len(words)
            tokens = tok.encode(t)
            total_tokens += len(tokens)
            decoded = tok.decode(tokens)
            if decoded != t:
                round_trip_passed = False
                
        tokens_per_word = total_tokens / max(1, total_words)
        chars_per_token = total_chars / max(1, total_tokens)
        compression_ratio = total_chars / max(1, total_tokens)
        
        metrics[domain] = {
            "total_texts": len(texts),
            "total_chars": total_chars,
            "total_words": total_words,
            "total_tokens": total_tokens,
            "tokens_per_word": round(tokens_per_word, 3),
            "chars_per_token": round(chars_per_token, 3),
            "compression_ratio": round(compression_ratio, 3),
            "round_trip_exact": round_trip_passed
        }

    # Test unknown token and rare unicode behavior
    test_edge_cases = [
        "Special emojis: 🚀 🤖 🧠 💻 🔬",
        "Rare symbols: ∑ ∏ ∫ √ ∞ ≈ ≠ ≤ ≥",
        "Corrupted bytes: \x00\x01\x02\xff\xfe",
        "Mixed script: English + हिन्दी + Devanagari + Python x = 42"
    ]
    edge_results = []
    for ec in test_edge_cases:
        tokens = tok.encode(ec)
        dec = tok.decode(tokens)
        edge_results.append({
            "input": repr(ec),
            "tokens_len": len(tokens),
            "round_trip": dec == ec,
            "decoded": repr(dec)
        })

    # Tradeoff calculation between 8,192 vs 20,480 vs 32,000 vocab sizes
    # At d_model = 768 (100M model)
    tradeoffs = {}
    for v in [8192, 16384, 20480, 32000, 50257]:
        emb_params = v * 768
        # Sequence length reduction factor estimate
        # e.g. English is ~1.2 tokens/word at 32k vs ~1.35 tokens/word at 8k
        # Hindi is ~2.2 tokens/word at 32k vs ~4.8 tokens/word at 8k
        tradeoffs[f"vocab_{v}"] = {
            "vocab_size": v,
            "embedding_params_d768": emb_params,
            "embedding_mb_fp16": round(emb_params * 2 / (1024**2), 2),
            "embedding_fraction_of_100m": round(emb_params / 98_000_000, 4)
        }

    output = {
        "tokenizer_meta": {
            "type": tok.type if hasattr(tok, "type") else "JarvisBPE",
            "vocab_size": vocab_size,
            "special_tokens_count": len(tok.special_tokens) if hasattr(tok, "special_tokens") else 0
        },
        "domain_efficiency": metrics,
        "edge_case_tests": edge_results,
        "vocab_size_tradeoffs": tradeoffs
    }

    with open("VISION_TOKENIZER_EFFICIENCY_REPORT.json", "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print("Tokenizer efficiency audit completed:")
    for k, v in metrics.items():
        print(f"  {k:25s}: {v['tokens_per_word']} tok/word | {v['chars_per_token']} chars/tok | RoundTrip: {v['round_trip_exact']}")

if __name__ == "__main__":
    test_tokenizer_efficiency()
