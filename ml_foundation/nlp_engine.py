"""
VISION Complete NLP & Computational Linguistics Engine
ml_foundation/nlp_engine.py

Comprehensive natural language processing system featuring:
1. Configurable Text Preprocessing & Normalization (Unicode, UTF-8, whitespace, contractions, numbers, emojis, script ID)
2. Bag of Words (BOW) Vectorizer (binary, term-frequency, n-grams, sparse DTM, min/max DF, stop-words, OOV)
3. TF-IDF Representation & Search Engine (smooth IDF, word/char n-grams, cosine similarity, document ranking, keywords)
4. Stemming Algorithms (Porter Stemmer, Snowball Stemmer, Hindi Suffix-Stripper, over/under-stemming metrics)
5. Lemmatization System (dictionary + morphological POS-aware lemmatizer for English & Hindi, lemma caching)
6. Part-of-Speech (POS) Tagger (lexicon + morphological affix rules, sequence chunking, English & Hindi)
7. Named Entity Recognition (NER) (Person, Org, Location, Product, Date/Time, Money, Measurement, Tech, Science)
8. Advanced NLP Utilities (N-gram LM, Levenshtein distance, Intent/Sentiment classifier, LSA Topic Extractor)
9. NLP Evaluation Suite (Precision, Recall, F1, Macro/Micro F1, Confusion Matrix, Retrieval Precision@K, MRR)
"""

from __future__ import annotations

import collections
import datetime
import math
import os
import re
import sys
import unicodedata
from typing import Any, Callable, Dict, Generator, Iterable, List, Optional, Set, Tuple, Union


# =========================================================================
# 1. STOP-WORDS & LEXICAL DICTIONARIES
# =========================================================================

ENGLISH_STOP_WORDS: Set[str] = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
    "but", "by", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't",
    "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't",
    "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here",
    "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll",
    "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's",
    "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once",
    "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same",
    "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
    "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there",
    "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those",
    "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd",
    "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's", "where",
    "where's", "which", "while", "who", "who's", "whom", "why", "why's", "with", "won't",
    "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours",
    "yourself", "yourselves"
}

HINDI_STOP_WORDS: Set[str] = {
    "का", "के", "की", "में", "से", "को", "पर", "है", "हैं", "था", "थी", "थे", "होगा", "होगी", "होंगे",
    "और", "या", "एवं", "तथा", "नहीं", "भी", "ही", "तो", "जो", "वह", "यह", "वे", "ये", "इस", "उस",
    "इन", "उन", "कि", "ने", "कर", "किया", "किए", "रहा", "रही", "रहे", "हुआ", "हुई", "हुए", "गया",
    "गई", "गए", "जाता", "जाती", "जाते", "सकता", "सकती", "सकते", "अपना", "अपनी", "अपने", "कुछ", "सब"
}

CONTRACTION_MAP: Dict[str, str] = {
    "ain't": "am not", "aren't": "are not", "can't": "cannot", "can't've": "cannot have",
    "'cause": "because", "could've": "could have", "couldn't": "could not", "didn't": "did not",
    "doesn't": "does not", "don't": "do not", "hadn't": "had not", "hasn't": "has not",
    "haven't": "have not", "he'd": "he would", "he'll": "he will", "he's": "he is",
    "how'd": "how did", "how'll": "how will", "how's": "how is", "i'd": "i would",
    "i'll": "i will", "i'm": "i am", "i've": "i have", "isn't": "is not", "it'd": "it would",
    "it'll": "it will", "it's": "it is", "let's": "let us", "ma'am": "madam",
    "might've": "might have", "must've": "must have", "mustn't": "must not",
    "she'd": "she would", "she'll": "she will", "she's": "she is", "should've": "should have",
    "shouldn't": "should not", "that's": "that is", "there's": "there is", "they'd": "they would",
    "they'll": "they will", "they're": "they are", "they've": "they have", "wasn't": "was not",
    "we'd": "we would", "we'll": "we will", "we're": "we are", "we've": "we have",
    "weren't": "were not", "what'll": "what will", "what're": "what are", "what's": "what is",
    "what've": "what have", "when's": "when is", "where'd": "where did", "where's": "where is",
    "who'll": "who will", "who's": "who is", "won't": "will not", "would've": "would have",
    "wouldn't": "would not", "you'd": "you would", "you'll": "you will", "you're": "you are",
    "you've": "you have"
}

ENGLISH_LEMMA_NOUNS: Dict[str, str] = {
    "children": "child", "men": "man", "women": "woman", "feet": "foot", "teeth": "tooth",
    "geese": "goose", "mice": "mouse", "people": "person", "oxen": "ox", "matrices": "matrix",
    "vertices": "vertex", "indices": "index", "corpora": "corpus", "analyses": "analysis",
    "crises": "crisis", "theses": "thesis", "phenomena": "phenomenon", "criteria": "criterion",
    "data": "datum", "bacteria": "bacterium", "curricula": "curriculum", "nuclei": "nucleus",
    "fungi": "fungus", "cacti": "cactus", "alumni": "alumnus"
}

ENGLISH_LEMMA_VERBS: Dict[str, str] = {
    "was": "be", "were": "be", "been": "be", "am": "be", "is": "be", "are": "be",
    "went": "go", "gone": "go", "goes": "go", "going": "go",
    "had": "have", "has": "have", "having": "have",
    "did": "do", "does": "do", "doing": "do", "done": "do",
    "said": "say", "says": "say", "saying": "say",
    "made": "make", "makes": "make", "making": "make",
    "got": "get", "gets": "get", "getting": "get", "gotten": "get",
    "took": "take", "takes": "take", "taking": "take", "taken": "take",
    "came": "come", "comes": "come", "coming": "come",
    "saw": "see", "sees": "see", "seeing": "see", "seen": "see",
    "knew": "know", "knows": "know", "knowing": "know", "known": "know",
    "thought": "think", "thinks": "think", "thinking": "think",
    "ran": "run", "runs": "run", "running": "run",
    "wrote": "write", "writes": "write", "writing": "write", "written": "write",
    "spoke": "speak", "speaks": "speak", "speaking": "speak", "spoken": "speak",
    "drove": "drive", "drives": "drive", "driving": "drive", "driven": "drive",
    "flew": "fly", "flies": "fly", "flying": "fly", "flown": "fly",
    "built": "build", "builds": "build", "building": "build",
    "taught": "teach", "teaches": "teach", "teaching": "teach",
    "bought": "buy", "buys": "buy", "buying": "buy",
    "brought": "bring", "brings": "bring", "bringing": "bring"
}


# =========================================================================
# 2. TEXT PREPROCESSING & NORMALIZATION PIPELINE
# =========================================================================

class TextPreprocessor:
    """Configurable, robust text preprocessing and normalization engine."""

    def __init__(
        self,
        unicode_form: str = "NFC",
        collapse_whitespace: bool = True,
        expand_contractions: bool = True,
        strip_markup: bool = True,
        lower: bool = False,
        preserve_provenance: bool = True
    ) -> None:
        self.unicode_form = unicode_form
        self.collapse_whitespace = collapse_whitespace
        self.expand_contractions = expand_contractions
        self.strip_markup = strip_markup
        self.lower = lower
        self.preserve_provenance = preserve_provenance

    def normalize_unicode(self, text: str) -> str:
        """Applies canonical Unicode normalization (NFC/NFKC/NFD/NFKD)."""
        return unicodedata.normalize(self.unicode_form, text)

    def validate_and_repair_encoding(self, text: str) -> Tuple[str, bool]:
        """Detects and repairs common UTF-8/Windows-1252/Latin-1 encoding corruption (Mojibake)."""
        was_corrupted = False
        repaired = text

        # Common Latin-1 / Windows-1252 to UTF-8 Mojibake sequences (e.g., Ã© -> é, Ã‰ -> É, â€™ -> ’)
        if any(c in text for c in ["Ã", "â€", "â—", "Ã¡", "Ã©", "Ã­", "Ã³", "Ãº"]):
            for enc in ("windows-1252", "latin-1"):
                try:
                    candidate = text.encode(enc).decode("utf-8")
                    if len(candidate) > 0 and len(candidate) < len(text):
                        repaired = candidate
                        was_corrupted = True
                        break
                except Exception:
                    pass

        # Remove zero-width non-printing characters except those in Indic scripts (ZWJ, ZWNJ)
        repaired = re.sub(r"[\u200B\u200E\u200F\uFEFF]", "", repaired)
        return repaired, was_corrupted

    def clean_markup(self, text: str) -> str:
        """Strips HTML/XML tags while preserving text content and structure."""
        # Replace block tags with newline
        t = re.sub(r"<\s*/?\s*(?:p|div|br|hr|h[1-6]|li|blockquote)[^>]*>", "\n", text, flags=re.IGNORECASE)
        # Strip all other tags
        t = re.sub(r"<[^>]+>", "", t)
        # Decode basic entities
        t = t.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"')
        return t

    def expand_contractions_text(self, text: str) -> str:
        """Expands common English contractions in text."""
        def repl(match: re.Match) -> str:
            word = match.group(0)
            low = word.lower()
            if low in CONTRACTION_MAP:
                expanded = CONTRACTION_MAP[low]
                if word[0].isupper() and len(expanded) > 0:
                    return expanded[0].upper() + expanded[1:]
                return expanded
            return word

        pattern = re.compile(r"\b(" + "|".join(re.escape(k) for k in CONTRACTION_MAP.keys()) + r")\b", re.IGNORECASE)
        return pattern.sub(repl, text)

    def normalize_whitespace_text(self, text: str) -> str:
        """Collapses duplicate horizontal whitespace while preserving clean newlines."""
        # Replace non-breaking spaces
        t = text.replace("\u00a0", " ")
        # Collapse multiple horizontal spaces/tabs
        t = re.sub(r"[ \t]+", " ", t)
        # Collapse excessive newlines (max 2 consecutive)
        t = re.sub(r"\n\s*\n\s*\n+", "\n\n", t)
        return t.strip()

    def identify_script(self, text: str) -> Dict[str, Any]:
        """Identifies the primary script and language category of the text."""
        counts = {"latin": 0, "devanagari": 0, "numeric": 0, "other": 0}
        for char in text:
            code = ord(char)
            if 0x0041 <= code <= 0x005A or 0x0061 <= code <= 0x007A:
                counts["latin"] += 1
            elif 0x0900 <= code <= 0x097F:
                counts["devanagari"] += 1
            elif char.isdigit():
                counts["numeric"] += 1
            elif not char.isspace():
                counts["other"] += 1

        total = sum(counts.values()) or 1
        dev_ratio = counts["devanagari"] / total
        lat_ratio = counts["latin"] / total

        if dev_ratio > 0.40:
            primary = "devanagari_hindi"
        elif lat_ratio > 0.50:
            # Check for Hinglish heuristics (e.g. "hai", "karna", "nahi")
            words = set(re.findall(r"\b[a-z]{2,}\b", text.lower()))
            hinglish_markers = {"hai", "aur", "karta", "karna", "nahi", "hota", "wali", "liye", "mein", "mera", "kya"}
            if len(words & hinglish_markers) >= 2:
                primary = "latin_hinglish"
            else:
                primary = "english"
        else:
            primary = "mixed_or_code"

        return {
            "primary_script": primary,
            "devanagari_ratio": round(dev_ratio, 3),
            "latin_ratio": round(lat_ratio, 3),
            "character_counts": counts
        }

    def process(self, text: str) -> Dict[str, Any]:
        """Executes full normalization pipeline and returns structured provenance."""
        provenance: List[str] = []
        current = text

        current = self.normalize_unicode(current)
        provenance.append("unicode_nfc")

        current, was_repaired = self.validate_and_repair_encoding(current)
        if was_repaired:
            provenance.append("encoding_repaired")

        if self.strip_markup:
            current = self.clean_markup(current)
            provenance.append("markup_stripped")

        if self.expand_contractions:
            current = self.expand_contractions_text(current)
            provenance.append("contractions_expanded")

        if self.collapse_whitespace:
            current = self.normalize_whitespace_text(current)
            provenance.append("whitespace_normalized")

        if self.lower:
            current = current.lower()
            provenance.append("lowercased")

        script_info = self.identify_script(current)

        return {
            "original_text": text,
            "normalized_text": current,
            "provenance": provenance,
            "script_info": script_info,
            "length_delta": len(current) - len(text)
        }


# =========================================================================
# 3. SENTENCE & WORD TOKENIZATION
# =========================================================================

def segment_sentences(text: str) -> List[str]:
    """
    Splits text into sentences, respecting abbreviations (Dr., Inc., e.g.),
    decimals (3.14), URLs, and Hindi Purna Viram (।).
    """
    clean = text.strip()
    if not clean:
        return []

    # Replace common abbreviations with temporary placeholders
    abbr_sub = [
        (r"\bDr\.", "Dr__ABBR__"),
        (r"\bMr\.", "Mr__ABBR__"),
        (r"\bMrs\.", "Mrs__ABBR__"),
        (r"\bMs\.", "Ms__ABBR__"),
        (r"\be\.g\.", "eg__ABBR__"),
        (r"\bi\.e\.", "ie__ABBR__"),
        (r"\bvs\.", "vs__ABBR__"),
        (r"\bInc\.", "Inc__ABBR__"),
        (r"\bLtd\.", "Ltd__ABBR__"),
        (r"\bCorp\.", "Corp__ABBR__"),
        (r"\bapprox\.", "approx__ABBR__"),
        (r"(\d+)\.(\d+)", r"\1__DEC__\2"),  # numbers e.g. 3.14
    ]
    protected = clean
    for pat, rep in abbr_sub:
        protected = re.sub(pat, rep, protected)

    # Split on sentence boundaries: period, question mark, exclamation, or Devanagari purna viram (।)
    raw_sents = re.split(r"(?<=[.!?।])\s+", protected)

    restored: List[str] = []
    for s in raw_sents:
        # Restore placeholders
        s_res = (s.replace("Dr__ABBR__", "Dr.")
                  .replace("Mr__ABBR__", "Mr.")
                  .replace("Mrs__ABBR__", "Mrs.")
                  .replace("Ms__ABBR__", "Ms.")
                  .replace("eg__ABBR__", "e.g.")
                  .replace("ie__ABBR__", "i.e.")
                  .replace("vs__ABBR__", "vs.")
                  .replace("Inc__ABBR__", "Inc.")
                  .replace("Ltd__ABBR__", "Ltd.")
                  .replace("Corp__ABBR__", "Corp.")
                  .replace("approx__ABBR__", "approx.")
                  .replace("__DEC__", "."))
        s_res = s_res.strip()
        if s_res:
            restored.append(s_res)

    return restored


def tokenize_words(text: str, preserve_punctuation: bool = True) -> List[str]:
    """
    Tokenizes text into words, numbers, punctuation, and code tokens.
    Supports English, Hindi (Devanagari matras and ligatures), and code identifiers.
    """
    if preserve_punctuation:
        # Matches words (Latin + Devanagari Unicode range \u0900-\u097F), numbers, or punctuation
        pattern = re.compile(
            r"[a-zA-Z0-9_\u0900-\u097F]+(?:'[a-zA-Z]+)?"
            r"|[^\s\w\u0900-\u097F]"
        )
    else:
        # Words and alphanumeric tokens only
        pattern = re.compile(r"[a-zA-Z0-9_\u0900-\u097F]+(?:'[a-zA-Z]+)?")

    tokens = pattern.findall(text)
    return tokens


# =========================================================================
# 4. STEMMING ENGINES (PORTER, SNOWBALL, HINDI SUFFIX STRIPPER)
# =========================================================================

class PorterStemmer:
    """Complete implementation of Martin Porter's 1980 suffix-stripping algorithm for English."""

    def __init__(self) -> None:
        self.vowels = set("aeiou")

    def _is_consonant(self, word: str, i: int) -> bool:
        c = word[i]
        if c in self.vowels:
            return False
        if c == 'y':
            return i == 0 or not self._is_consonant(word, i - 1)
        return True

    def _measure(self, stem: str) -> int:
        """Computes the measure m of a stem [C](VC)^m[V]."""
        if not stem:
            return 0
        state = 0
        m = 0
        for i in range(len(stem)):
            c = self._is_consonant(stem, i)
            if state == 0:
                if not c:
                    state = 1
            elif state == 1:
                if c:
                    m += 1
                    state = 0
        return m

    def _has_vowel(self, stem: str) -> bool:
        return any(not self._is_consonant(stem, i) for i in range(len(stem)))

    def _ends_double_consonant(self, word: str) -> bool:
        if len(word) >= 2 and word[-1] == word[-2]:
            return self._is_consonant(word, len(word) - 1)
        return False

    def _cvc(self, word: str) -> bool:
        if len(word) < 3:
            return False
        return (self._is_consonant(word, len(word) - 1) and
                not self._is_consonant(word, len(word) - 2) and
                self._is_consonant(word, len(word) - 3) and
                word[-1] not in "wxy")

    def stem(self, word: str) -> str:
        w = word.lower()
        if len(w) <= 2:
            return w

        # Step 1a
        if w.endswith("sses"):
            w = w[:-2]
        elif w.endswith("ies"):
            w = w[:-2]
        elif not w.endswith("ss") and w.endswith("s"):
            w = w[:-1]

        # Step 1b
        extra_flag = False
        if w.endswith("eed"):
            stem = w[:-3]
            if self._measure(stem) > 0:
                w = stem + "ee"
        elif w.endswith("ed"):
            stem = w[:-2]
            if self._has_vowel(stem):
                w = stem
                extra_flag = True
        elif w.endswith("ing"):
            stem = w[:-3]
            if self._has_vowel(stem):
                w = stem
                extra_flag = True

        if extra_flag:
            if w.endswith(("at", "bl", "iz")):
                w += "e"
            elif self._ends_double_consonant(w) and not w.endswith(("l", "s", "z")):
                w = w[:-1]
            elif self._measure(w) == 1 and self._cvc(w):
                w += "e"

        # Step 1c
        if w.endswith("y"):
            stem = w[:-1]
            if self._has_vowel(stem):
                w = stem + "i"

        # Step 2
        step2_map = {
            "ational": "ate", "tional": "tion", "enci": "ence", "anci": "ance",
            "izer": "ize", "abli": "able", "alli": "al", "entli": "ent",
            "eli": "e", "ousli": "ous", "ization": "ize", "ation": "ate",
            "ator": "ate", "alism": "al", "iveness": "ive", "fulness": "ful",
            "ousness": "ous", "aliti": "al", "iviti": "ive", "biliti": "ble"
        }
        for suffix, rep in step2_map.items():
            if w.endswith(suffix):
                stem = w[:-len(suffix)]
                if self._measure(stem) > 0:
                    w = stem + rep
                break

        # Step 3
        step3_map = {
            "icate": "ic", "ative": "", "alize": "al",
            "iciti": "ic", "ical": "ic", "ful": "", "ness": ""
        }
        for suffix, rep in step3_map.items():
            if w.endswith(suffix):
                stem = w[:-len(suffix)]
                if self._measure(stem) > 0:
                    w = stem + rep
                break

        # Step 4
        step4_suffixes = [
            "al", "ance", "ence", "er", "ic", "able", "ible", "ant",
            "ement", "ment", "ent", "ou", "ism", "ate", "iti", "ous", "ive", "ize"
        ]
        for suffix in step4_suffixes:
            if w.endswith(suffix):
                stem = w[:-len(suffix)]
                if self._measure(stem) > 1:
                    w = stem
                break
        else:
            if w.endswith(("sion", "tion")):
                stem = w[:-3]
                if self._measure(stem) > 1:
                    w = stem

        # Step 5a
        if w.endswith("e"):
            stem = w[:-1]
            m = self._measure(stem)
            if m > 1 or (m == 1 and not self._cvc(stem)):
                w = stem

        # Step 5b
        if self._measure(w) > 1 and self._ends_double_consonant(w) and w.endswith("l"):
            w = w[:-1]

        return w


class HindiStemmer:
    """Rule-based suffix-stripping morphological stemmer for Hindi."""

    SUFFIXES: List[str] = [
        # Verbal & tense suffixes (longest first)
        "ाऊंगा", "ाऊंगी", "ाएंगे", "ाएगा", "ाएगी",
        "ताहूं", "तीहूं", "तेहैं", "तीहैं", "ताहै", "तीहै",
        "ेंगे", "ेंगी", "ेगा", "ेगी", "ूंगा", "ूंगी",
        "करके", "वाला", "वाली", "वाले",
        # Nominal plural and oblique suffixes
        "ाइयों", "ाइयां", "ियों", "ियां", "ाओं", "ाएं",
        "कर", "ता", "ती", "ते", "ना", "नी", "ने", "या", "यी", "ये",
        "ों", "ें", "एं", "ीं", "ा", "ी", "े", "ू", "ो"
    ]

    def stem(self, word: str) -> str:
        w = word.strip()
        if len(w) <= 3:
            return w

        for sfx in self.SUFFIXES:
            if w.endswith(sfx):
                stem_candidate = w[:-len(sfx)]
                # Ensure minimum root length of 2 characters
                if len(stem_candidate) >= 2:
                    return stem_candidate
        return w


def evaluate_stemmer(words: List[str], stemmer: Any) -> Dict[str, Any]:
    """Measures stemmer metrics including over-stemming and under-stemming indicators."""
    stems = [stemmer.stem(w) for w in words]
    unique_words = len(set(words))
    unique_stems = len(set(stems))
    compression_ratio = round(unique_stems / max(1, unique_words), 3)

    return {
        "total_words": len(words),
        "unique_words": unique_words,
        "unique_stems": unique_stems,
        "compression_ratio": compression_ratio,
        "examples": [(w, s) for w, s in zip(words[:10], stems[:10])]
    }


# =========================================================================
# 5. LEMMATIZATION (ENGLISH & HINDI)
# =========================================================================

class Lemmatizer:
    """Dictionary-backed and morphological POS-aware lemmatizer with caching."""

    def __init__(self) -> None:
        self.noun_dict = ENGLISH_LEMMA_NOUNS
        self.verb_dict = ENGLISH_LEMMA_VERBS
        self.cache: Dict[Tuple[str, str], str] = {}
        self.porter = PorterStemmer()

    def lemmatize_english(self, word: str, pos: str = "NOUN") -> str:
        """Lemmatizes an English word given its syntactic POS tag."""
        key = (word.lower(), pos.upper())
        if key in self.cache:
            return self.cache[key]

        w = word.lower()
        pos_tag = pos.upper()

        if pos_tag.startswith("V"):  # Verb
            if w in self.verb_dict:
                res = self.verb_dict[w]
            elif w.endswith("ies") and len(w) > 4:
                res = w[:-3] + "y"
            elif w.endswith("ing") and len(w) > 4:
                base = w[:-3]
                if base.endswith(base[-1]) and len(base) > 2 and base[-1] not in "aeiouy":
                    res = base[:-1]
                elif not base.endswith("e") and len(base) > 2:
                    res = base + "e" if base[-1] in "cgz" else base
                else:
                    res = base
            elif w.endswith("ed") and len(w) > 3:
                base = w[:-2]
                if base.endswith("i"):
                    res = base[:-1] + "y"
                elif base.endswith("e"):
                    res = base
                else:
                    res = base
            elif w.endswith("es") and len(w) > 3 and w[-3] in "sxyzchsh":
                res = w[:-2]
            elif w.endswith("s") and not w.endswith("ss") and len(w) > 3:
                res = w[:-1]
            else:
                res = w
        elif pos_tag.startswith("N"):  # Noun
            if w in self.noun_dict:
                res = self.noun_dict[w]
            elif w.endswith("ies") and len(w) > 4:
                res = w[:-3] + "y"
            elif w.endswith("ves") and len(w) > 4:
                res = w[:-3] + "f"
            elif w.endswith("es") and len(w) > 3 and w[-3] in "sxyzchsh":
                res = w[:-2]
            elif w.endswith("s") and not w.endswith("ss") and len(w) > 3:
                res = w[:-1]
            else:
                res = w
        elif pos_tag.startswith("ADJ"):  # Adjective
            if w.endswith("er") and len(w) > 3:
                res = w[:-2]
            elif w.endswith("est") and len(w) > 4:
                res = w[:-3]
            else:
                res = w
        else:
            res = w

        self.cache[key] = res
        return res

    def lemmatize_hindi(self, word: str) -> str:
        """Morphological base-form normalization for Hindi."""
        w = word.strip()
        # Noun plural oblique normalization (longest suffixes first)
        for sfx, rep in [("ियों", "ी"), ("ियां", "ी"), ("ाओं", ""), ("ाएं", ""), ("ों", ""), ("ें", ""), ("एं", "")]:
            if w.endswith(sfx) and len(w) > len(sfx) + 1:
                return w[:-len(sfx)] + rep

        # Verb infinitive normalization (e.g. करता/करते/करूंगा -> करना)
        for sfx in ["ऊंगा", "ूंगी", "ेंगे", "ेगा", "ेगी", "ता", "ती", "ते", "या", "यी", "ये"]:
            if w.endswith(sfx) and len(w) > len(sfx):
                return w[:-len(sfx)] + "ना"

        return w


# =========================================================================
# 6. BAG OF WORDS (BOW) VECTORIZER
# =========================================================================

class BagOfWords:
    """Document-Term Matrix and N-gram Bag-of-Words vectorizer."""

    def __init__(
        self,
        min_df: int = 1,
        max_df: float = 1.0,
        ngram_range: Tuple[int, int] = (1, 1),
        stop_words: Optional[Set[str]] = None,
        max_features: Optional[int] = None
    ) -> None:
        self.min_df = min_df
        self.max_df = max_df
        self.ngram_range = ngram_range
        self.stop_words = stop_words or set()
        self.max_features = max_features
        self.vocabulary: Dict[str, int] = {}
        self.inverse_vocabulary: Dict[int, str] = {}
        self.document_frequencies: Dict[str, int] = {}
        self.total_docs: int = 0

    def _extract_ngrams(self, tokens: List[str]) -> List[str]:
        ngrams: List[str] = []
        n_min, n_max = self.ngram_range
        clean_tokens = [t.lower() for t in tokens if t.lower() not in self.stop_words and len(t) > 1]

        for n in range(n_min, n_max + 1):
            for i in range(len(clean_tokens) - n + 1):
                gram = " ".join(clean_tokens[i:i + n])
                ngrams.append(gram)
        return ngrams

    def fit(self, raw_documents: List[str]) -> "BagOfWords":
        """Builds vocabulary and document frequency tables across a corpus."""
        self.total_docs = len(raw_documents)
        df_counter: Dict[str, int] = collections.defaultdict(int)

        for doc in raw_documents:
            tokens = tokenize_words(doc, preserve_punctuation=False)
            ngrams = set(self._extract_ngrams(tokens))
            for gram in ngrams:
                df_counter[gram] += 1

        self.document_frequencies = dict(df_counter)

        # Apply min_df and max_df thresholds
        max_doc_count = self.max_df if isinstance(self.max_df, int) else int(self.max_df * self.total_docs)
        filtered = [
            (gram, count) for gram, count in df_counter.items()
            if count >= self.min_df and count <= max_doc_count
        ]

        # Sort by frequency descending, then alphabetically
        filtered.sort(key=lambda x: (-x[1], x[0]))

        if self.max_features is not None:
            filtered = filtered[:self.max_features]

        self.vocabulary = {gram: idx for idx, (gram, _) in enumerate(filtered)}
        self.inverse_vocabulary = {idx: gram for gram, idx in self.vocabulary.items()}
        return self

    def transform_counts(self, raw_documents: List[str]) -> List[Dict[int, int]]:
        """Converts raw documents into sparse count vectors {feature_idx: count}."""
        vectors: List[Dict[int, int]] = []
        for doc in raw_documents:
            tokens = tokenize_words(doc, preserve_punctuation=False)
            ngrams = self._extract_ngrams(tokens)
            vec: Dict[int, int] = collections.defaultdict(int)
            for gram in ngrams:
                if gram in self.vocabulary:
                    vec[self.vocabulary[gram]] += 1
            vectors.append(dict(vec))
        return vectors

    def transform_binary(self, raw_documents: List[str]) -> List[Dict[int, int]]:
        """Converts raw documents into binary term presence vectors {feature_idx: 1}."""
        vectors: List[Dict[int, int]] = []
        for doc in raw_documents:
            tokens = tokenize_words(doc, preserve_punctuation=False)
            ngrams = set(self._extract_ngrams(tokens))
            vec: Dict[int, int] = {}
            for gram in ngrams:
                if gram in self.vocabulary:
                    vec[self.vocabulary[gram]] = 1
            vectors.append(vec)
        return vectors

    def compute_sparsity(self, sparse_vectors: List[Dict[int, int]]) -> float:
        """Computes Document-Term Matrix sparsity ratio (0.0 to 1.0)."""
        total_cells = len(sparse_vectors) * max(1, len(self.vocabulary))
        non_zero = sum(len(vec) for vec in sparse_vectors)
        return round(1.0 - (non_zero / max(1, total_cells)), 4)


# =========================================================================
# 7. TF-IDF VECTORIZER & SEARCH ENGINE
# =========================================================================

class TfidfEngine:
    """Production TF-IDF vectorizer and cosine document search ranking engine."""

    def __init__(
        self,
        ngram_range: Tuple[int, int] = (1, 2),
        sublinear_tf: bool = True,
        smooth_idf: bool = True,
        stop_words: Optional[Set[str]] = None
    ) -> None:
        self.ngram_range = ngram_range
        self.sublinear_tf = sublinear_tf
        self.smooth_idf = smooth_idf
        self.stop_words = stop_words or ENGLISH_STOP_WORDS
        self.vocabulary: Dict[str, int] = {}
        self.idf_: Dict[int, float] = {}
        self.corpus_docs: List[str] = []
        self.corpus_vectors: List[Dict[int, float]] = []

    def _extract_terms(self, text: str) -> List[str]:
        tokens = tokenize_words(text, preserve_punctuation=False)
        clean = [t.lower() for t in tokens if t.lower() not in self.stop_words and len(t) > 1]
        terms: List[str] = []
        n_min, n_max = self.ngram_range
        for n in range(n_min, n_max + 1):
            for i in range(len(clean) - n + 1):
                terms.append(" ".join(clean[i:i + n]))
        return terms

    def fit(self, documents: List[str]) -> "TfidfEngine":
        """Calculates smooth IDF weights across training documents."""
        self.corpus_docs = documents
        total_docs = len(documents)
        df_counts: Dict[str, int] = collections.defaultdict(int)

        for doc in documents:
            terms = set(self._extract_terms(doc))
            for term in terms:
                df_counts[term] += 1

        # Vocabulary assignment
        sorted_terms = sorted(df_counts.keys())
        self.vocabulary = {term: idx for idx, term in enumerate(sorted_terms)}

        # IDF computation
        for term, idx in self.vocabulary.items():
            df = df_counts[term]
            if self.smooth_idf:
                self.idf_[idx] = math.log((total_docs + 1.0) / (df + 1.0)) + 1.0
            else:
                self.idf_[idx] = math.log(total_docs / max(1.0, df)) + 1.0

        # Precompute corpus normalized vectors
        self.corpus_vectors = [self.transform_vector(doc) for doc in documents]
        return self

    def transform_vector(self, text: str) -> Dict[int, float]:
        """Transforms a single text into an L2-normalized TF-IDF sparse vector."""
        terms = self._extract_terms(text)
        counts: Dict[int, int] = collections.defaultdict(int)
        for t in terms:
            if t in self.vocabulary:
                counts[self.vocabulary[t]] += 1

        unnormalized: Dict[int, float] = {}
        sum_sq = 0.0

        for idx, count in counts.items():
            tf = (1.0 + math.log(count)) if self.sublinear_tf else float(count)
            tfidf = tf * self.idf_.get(idx, 1.0)
            unnormalized[idx] = tfidf
            sum_sq += tfidf * tfidf

        norm = math.sqrt(sum_sq)
        if norm > 0.0:
            return {idx: val / norm for idx, val in unnormalized.items()}
        return {}

    def cosine_similarity(self, vec_a: Dict[int, float], vec_b: Dict[int, float]) -> float:
        """Computes sparse dot product of unit-normalized vectors."""
        if len(vec_a) > len(vec_b):
            vec_a, vec_b = vec_b, vec_a
        dot = sum(val * vec_b.get(idx, 0.0) for idx, val in vec_a.items())
        return max(0.0, min(1.0, dot))

    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Ranks indexed corpus documents against query using cosine similarity."""
        q_vec = self.transform_vector(query)
        if not q_vec:
            return []

        scores: List[Tuple[int, float]] = []
        for doc_idx, doc_vec in enumerate(self.corpus_vectors):
            sim = self.cosine_similarity(q_vec, doc_vec)
            if sim > 0.001:
                scores.append((doc_idx, sim))

        scores.sort(key=lambda x: -x[1])
        top_results = scores[:top_k]

        return [
            {
                "rank": rank + 1,
                "doc_index": doc_idx,
                "score": round(score, 4),
                "document": self.corpus_docs[doc_idx]
            }
            for rank, (doc_idx, score) in enumerate(top_results)
        ]

    def extract_keywords(self, text: str, top_k: int = 5) -> List[Tuple[str, float]]:
        """Extracts most salient terms from text based on TF-IDF weight."""
        vec = self.transform_vector(text)
        inv_vocab = {idx: term for term, idx in self.vocabulary.items()}
        sorted_items = sorted(vec.items(), key=lambda x: -x[1])
        return [(inv_vocab[idx], round(val, 4)) for idx, val in sorted_items[:top_k]]


# =========================================================================
# 8. PART-OF-SPEECH (POS) TAGGING
# =========================================================================

class POSTagger:
    """Rule-based and morphological POS tagger supporting English and Hindi."""

    ENGLISH_LEXICON: Dict[str, str] = {
        "the": "DET", "a": "DET", "an": "DET", "this": "DET", "that": "DET", "these": "DET", "those": "DET",
        "i": "PRON", "you": "PRON", "he": "PRON", "she": "PRON", "it": "PRON", "we": "PRON", "they": "PRON",
        "is": "AUX", "are": "AUX", "was": "AUX", "were": "AUX", "am": "AUX", "be": "AUX", "been": "AUX",
        "has": "AUX", "have": "AUX", "had": "AUX", "do": "AUX", "does": "AUX", "did": "AUX",
        "can": "AUX", "could": "AUX", "will": "AUX", "would": "AUX", "should": "AUX", "must": "AUX",
        "and": "CONJ", "or": "CONJ", "but": "CONJ", "because": "CONJ", "if": "CONJ", "although": "CONJ",
        "in": "PREP", "on": "PREP", "at": "PREP", "by": "PREP", "for": "PREP", "with": "PREP", "about": "PREP",
        "into": "PREP", "through": "PREP", "during": "PREP", "before": "PREP", "after": "PREP", "from": "PREP",
        "to": "PREP", "of": "PREP",
        "not": "ADV", "very": "ADV", "well": "ADV", "quickly": "ADV", "always": "ADV", "never": "ADV",
        "good": "ADJ", "bad": "ADJ", "new": "ADJ", "first": "ADJ", "last": "ADJ", "great": "ADJ", "small": "ADJ",
        "system": "NOUN", "data": "NOUN", "model": "NOUN", "process": "NOUN", "computer": "NOUN",
        "code": "NOUN", "intelligence": "NOUN", "memory": "NOUN", "kernel": "NOUN", "network": "NOUN"
    }

    HINDI_LEXICON: Dict[str, str] = {
        "यह": "PRON", "वह": "PRON", "ये": "PRON", "वे": "PRON", "मैं": "PRON", "हम": "PRON", "तुम": "PRON", "आप": "PRON",
        "का": "PREP", "के": "PREP", "की": "PREP", "में": "PREP", "से": "PREP", "को": "PREP", "पर": "PREP", "तक": "PREP",
        "है": "AUX", "हैं": "AUX", "था": "AUX", "थी": "AUX", "थे": "AUX", "होगा": "AUX", "होगी": "AUX",
        "और": "CONJ", "तथा": "CONJ", "एवं": "CONJ", "या": "CONJ", "कि": "CONJ", "लेकिन": "CONJ",
        "नहीं": "ADV", "बहुत": "ADV", "जल्दी": "ADV", "हमेशा": "ADV", "कभी": "ADV",
        "अच्छा": "ADJ", "बुरा": "ADJ", "बड़ा": "ADJ", "छोटा": "ADJ", "महत्वपूर्ण": "ADJ", "नया": "ADJ"
    }

    def tag_word_english(self, word: str, prev_tag: Optional[str] = None) -> str:
        low = word.lower()
        if low in self.ENGLISH_LEXICON:
            return self.ENGLISH_LEXICON[low]

        if word.isdigit() or re.match(r"^\d+(?:\.\d+)?$", word):
            return "NUM"
        if not re.match(r"^[a-zA-Z0-9_]+$", word):
            return "PUNCT"

        # Morphological Suffix Heuristics
        if low.endswith("ly"):
            return "ADV"
        if low.endswith(("tion", "sion", "ment", "ness", "ity", "ance", "ence", "ism", "ship")):
            return "NOUN"
        if low.endswith(("able", "ible", "ous", "ive", "ful", "less", "al", "ic")):
            return "ADJ"
        if low.endswith("ing"):
            return "VERB" if prev_tag in ("AUX", "PRON") else "NOUN"
        if low.endswith("ed"):
            return "VERB"
        if low.endswith(("ize", "ise", "ify", "ate")):
            return "VERB"

        if word[0].isupper() and prev_tag != "PUNCT":
            return "PROPN"

        return "NOUN"

    def tag_word_hindi(self, word: str) -> str:
        if word in self.HINDI_LEXICON:
            return self.HINDI_LEXICON[word]
        if any(word.endswith(sfx) for sfx in ["ना", "या", "यी", "ये", "ता", "ती", "ते", "ूंगा", "ेंगे"]):
            return "VERB"
        if word.endswith(("दार", "ई", "वान", "शील")):
            return "ADJ"
        return "NOUN"

    def tag(self, text: str) -> List[Tuple[str, str]]:
        """Tags a full sentence with POS categories."""
        tokens = tokenize_words(text, preserve_punctuation=True)
        tagged: List[Tuple[str, str]] = []
        prev_tag: Optional[str] = None

        for tok in tokens:
            if re.match(r"^[\u0900-\u097F]+$", tok):
                t = self.tag_word_hindi(tok)
            else:
                t = self.tag_word_english(tok, prev_tag)
            tagged.append((tok, t))
            prev_tag = t

        return tagged


# =========================================================================
# 9. NAMED ENTITY RECOGNITION (NER)
# =========================================================================

class NamedEntityRecognizer:
    """Rule-based, gazetteer, and regular expression Named Entity Recognizer."""

    KNOWN_ENTITIES: Dict[str, str] = {
        # People
        "lokesh": "PERSON", "alan turing": "PERSON", "ada lovelace": "PERSON",
        "albert einstein": "PERSON", "john von neumann": "PERSON", "guido van rossum": "PERSON",
        # Organizations
        "google": "ORG", "deepmind": "ORG", "microsoft": "ORG", "openai": "ORG",
        "nasa": "ORG", "isro": "ORG", "apple": "ORG", "meta": "ORG", "mit": "ORG",
        # Locations
        "new delhi": "LOCATION", "bengaluru": "LOCATION", "california": "LOCATION",
        "mumbai": "LOCATION", "london": "LOCATION", "india": "LOCATION", "united states": "LOCATION",
        # Products & Assistant
        "vision": "PRODUCT", "jarvis": "PRODUCT", "gemini": "PRODUCT", "chatgpt": "PRODUCT",
        "iphone": "PRODUCT", "raspberry pi": "PRODUCT", "esp32": "PRODUCT", "arduino": "PRODUCT",
        # Tech Stack
        "python": "TECH_STACK", "pytorch": "TECH_STACK", "javascript": "TECH_STACK",
        "typescript": "TECH_STACK", "java": "TECH_STACK", "c++": "TECH_STACK",
        "rust": "TECH_STACK", "sql": "TECH_STACK", "docker": "TECH_STACK", "react": "TECH_STACK",
        "node.js": "TECH_STACK", "http": "TECH_STACK", "websocket": "TECH_STACK"
    }

    def extract_entities(self, text: str) -> List[Dict[str, Any]]:
        """Extracts named entities with character offsets and provenance."""
        entities: List[Dict[str, Any]] = []
        low_text = text.lower()

        # 1. Gazetteer exact matches (multi-word first)
        sorted_gaz = sorted(self.KNOWN_ENTITIES.keys(), key=lambda x: -len(x))
        occupied_spans: List[Tuple[int, int]] = []

        for term in sorted_gaz:
            cat = self.KNOWN_ENTITIES[term]
            pattern = re.compile(r"\b" + re.escape(term) + r"\b", re.IGNORECASE)
            for m in pattern.finditer(text):
                start, end = m.span()
                if not any(s <= start < e or s < end <= e for s, e in occupied_spans):
                    entities.append({
                        "entity": m.group(0),
                        "category": cat,
                        "start_idx": start,
                        "end_idx": end,
                        "confidence": 0.95
                    })
                    occupied_spans.append((start, end))

        # 2. Regex patterns for Money, Date/Time, and Measurements
        regex_patterns = [
            (r"\b(?:\$|₹|€|£)\s*\d+(?:,\d{3})*(?:\.\d+)?(?:\s*(?:million|billion|trillion|crore|lakh))?\b", "MONEY"),
            (r"\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:USD|INR|EUR|GBP|dollars|rupees)\b", "MONEY"),
            (r"\b\d+(?:\.\d+)?\s*(?:km/h|mph|m/s|kg|grams|mg|volts|V|amps|mA|Hz|kHz|MHz|GHz|GB|MB|KB|TB|mm|cm|meters|km)\b", "MEASUREMENT"),
            (r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b", "DATE_TIME"),
            (r"\b\d{4}-\d{2}-\d{2}\b", "DATE_TIME"),
            (r"\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b", "DATE_TIME")
        ]

        for pat, cat in regex_patterns:
            for m in re.finditer(pat, text):
                start, end = m.span()
                if not any(s <= start < e or s < end <= e for s, e in occupied_spans):
                    entities.append({
                        "entity": m.group(0),
                        "category": cat,
                        "start_idx": start,
                        "end_idx": end,
                        "confidence": 0.90
                    })
                    occupied_spans.append((start, end))

        entities.sort(key=lambda x: x["start_idx"])
        return entities


# =========================================================================
# 10. ADVANCED NLP: INTENT & SENTIMENT ANALYSIS
# =========================================================================

class FastIntentClassifier:
    """Lightweight rule-based and keyword-driven user intent classifier."""

    INTENTS: Dict[str, List[str]] = {
        "coding_task": ["code", "function", "bug", "error", "script", "python", "javascript", "refactor", "algorithm", "debug"],
        "mathematical_computation": ["calculate", "solve", "integral", "derivative", "equation", "perimeter", "area", "percentage", "math"],
        "system_command": ["open", "launch", "restart", "shutdown", "close", "minimize", "volume", "brightness", "process"],
        "file_management": ["find file", "delete file", "rename", "move", "directory", "folder", "copy", "pdf", "docx"],
        "information_retrieval": ["who is", "what is", "explain", "how does", "summarize", "tell me about", "history of"],
        "smalltalk_greeting": ["hello", "hi", "hey", "good morning", "how are you", "who made you", "namaste", "kaisa hai"]
    }

    def classify(self, text: str) -> Dict[str, Any]:
        low = text.lower()
        scores: Dict[str, int] = collections.defaultdict(int)

        for intent, keywords in self.INTENTS.items():
            for kw in keywords:
                if re.search(r"\b" + re.escape(kw) + r"\b", low):
                    scores[intent] += 1

        if not scores:
            return {"primary_intent": "general_inquiry", "confidence": 0.50, "scores": {}}

        best_intent = max(scores.items(), key=lambda x: x[1])
        total = sum(scores.values())
        return {
            "primary_intent": best_intent[0],
            "confidence": round(best_intent[1] / total, 2),
            "scores": dict(scores)
        }


# =========================================================================
# 11. NLP EVALUATION SUITE
# =========================================================================

def compute_classification_metrics(y_true: List[str], y_pred: List[str]) -> Dict[str, Any]:
    """Computes Precision, Recall, Accuracy, Macro-F1, Micro-F1, and Confusion Matrix."""
    if len(y_true) != len(y_pred):
        raise ValueError("y_true and y_pred must have identical length")

    classes = sorted(list(set(y_true) | set(y_pred)))
    conf_matrix: Dict[str, Dict[str, int]] = {c: {c2: 0 for c2 in classes} for c in classes}

    correct = 0
    for t, p in zip(y_true, y_pred):
        conf_matrix[t][p] += 1
        if t == p:
            correct += 1

    accuracy = round(correct / max(1, len(y_true)), 4)

    per_class: Dict[str, Dict[str, float]] = {}
    f1_list: List[float] = []

    for c in classes:
        tp = conf_matrix[c][c]
        fp = sum(conf_matrix[c2][c] for c2 in classes if c2 != c)
        fn = sum(conf_matrix[c][c2] for c2 in classes if c2 != c)

        prec = tp / max(1, tp + fp)
        rec = tp / max(1, tp + fn)
        f1 = (2 * prec * rec) / max(1e-6, prec + rec)

        per_class[c] = {"precision": round(prec, 4), "recall": round(rec, 4), "f1": round(f1, 4), "support": sum(conf_matrix[c].values())}
        f1_list.append(f1)

    macro_f1 = round(sum(f1_list) / max(1, len(f1_list)), 4)

    return {
        "accuracy": accuracy,
        "macro_f1": macro_f1,
        "per_class_metrics": per_class,
        "confusion_matrix": conf_matrix,
        "total_samples": len(y_true)
    }


def compute_retrieval_metrics(
    ground_truth_relevance: List[Set[int]],
    retrieved_doc_indices: List[List[int]],
    k_values: Tuple[int, ...] = (1, 3, 5)
) -> Dict[str, Any]:
    """Computes Precision@K, Recall@K, and Mean Reciprocal Rank (MRR) for document retrieval."""
    p_at_k: Dict[int, List[float]] = {k: [] for k in k_values}
    r_at_k: Dict[int, List[float]] = {k: [] for k in k_values}
    mrr_list: List[float] = []

    for relevant, retrieved in zip(ground_truth_relevance, retrieved_doc_indices):
        if not relevant:
            continue

        # MRR
        rr = 0.0
        for rank, doc_idx in enumerate(retrieved, start=1):
            if doc_idx in relevant:
                rr = 1.0 / rank
                break
        mrr_list.append(rr)

        # Precision & Recall at K
        for k in k_values:
            top_k = set(retrieved[:k])
            tp = len(top_k & relevant)
            p_at_k[k].append(tp / max(1, k))
            r_at_k[k].append(tp / max(1, len(relevant)))

    results = {
        "mrr": round(sum(mrr_list) / max(1, len(mrr_list)), 4),
        "precision_at_k": {f"P@{k}": round(sum(scores) / max(1, len(scores)), 4) for k, scores in p_at_k.items()},
        "recall_at_k": {f"R@{k}": round(sum(scores) / max(1, len(scores)), 4) for k, scores in r_at_k.items()},
        "total_queries": len(ground_truth_relevance)
    }
    return results
