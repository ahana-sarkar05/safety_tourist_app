"""
services/classifier.py — Keyword-based incident classifier.

classify(headline, body="") -> (incident_type, severity)

incident_type: one of THEFT | ASSAULT | HARASSMENT | ACCIDENT | FLOOD |
               LANDSLIDE | FIRE | PROTEST | SCAM | CURFEW | RIOT | OTHER
severity     : int 1-5 (1=very low, 5=very high)
"""
from __future__ import annotations
import re

# ── Type keywords (checked in order; first match wins) ──────────────────────
TYPE_RULES: list[tuple[str, list[str]]] = [
    ("RIOT",       ["riot", "communal violence", "mob attack", "lynching"]),
    ("CURFEW",     ["curfew", "section 144"]),
    ("PROTEST",    ["protest", "strike", "hartal", "bandh", "shutdown", "demonstration", "agitation", "march", "rally"]),
    ("FLOOD",      ["flood", "waterlogged", "inundated", "submerged", "flash flood", "deluge"]),
    ("LANDSLIDE",  ["landslide", "landfall", "mudslide", "debris flow"]),
    ("FIRE",       ["fire", "blaze", "arson", "burns down", "gutted"]),
    ("ASSAULT",    ["assault", "attack", "stab", "murder", "killed", "shot", "beaten", "gang", "rape", "molestation"]),
    ("HARASSMENT", ["harass", "eve-teas", "molest", "grope", "stalk"]),
    ("THEFT",      ["theft", "rob", "steal", "pickpocket", "burglary", "snatch", "loot", "chain snatch"]),
    ("ACCIDENT",   ["accident", "crash", "collision", "hit-and-run", "road rage", "mishap", "vehicle", "bus", "truck"]),
    ("SCAM",       ["scam", "fraud", "cheat", "duped", "con", "fake", "racket"]),
]

# ── Severity boosters ────────────────────────────────────────────────────────
SEVERITY_BOOST: dict[str, int] = {
    "death": 2, "killed": 2, "murder": 2, "fatal": 2, "dead": 2,
    "rape": 2, "riot": 2, "curfew": 2,
    "multiple": 1, "several": 1, "many": 1, "dozens": 1,
    "major": 1, "massive": 1, "severe": 1, "large": 1,
    "police": 1, "arrested": 1, "detained": 1,
}

BASE_SEVERITY: dict[str, int] = {
    "RIOT": 5, "CURFEW": 4, "PROTEST": 2, "FLOOD": 4, "LANDSLIDE": 4,
    "FIRE": 3, "ASSAULT": 4, "HARASSMENT": 3, "THEFT": 2,
    "ACCIDENT": 3, "SCAM": 2, "OTHER": 1,
}


def classify(headline: str, body: str = "") -> tuple[str, int]:
    """
    Returns (incident_type: str, severity: int 1-5).
    """
    text = (headline + " " + body).lower()

    incident_type = "OTHER"
    for itype, keywords in TYPE_RULES:
        if any(kw in text for kw in keywords):
            incident_type = itype
            break

    severity = BASE_SEVERITY.get(incident_type, 1)
    for word, boost in SEVERITY_BOOST.items():
        if word in text:
            severity = min(5, severity + boost)

    return incident_type, severity


# ── Deduplication ────────────────────────────────────────────────────────────
def _tokenize(text: str) -> set[str]:
    return set(re.sub(r"[^\w\s]", "", text.lower()).split())


def jaccard(a: str, b: str) -> float:
    ta, tb = _tokenize(a), _tokenize(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def deduplicate(articles: list[dict], threshold: float = 0.65) -> list[dict]:
    """
    Remove near-duplicate articles by headline Jaccard similarity.
    Keeps the most recent article in each cluster.
    articles: list of dicts with keys 'headline', 'timestamp' (ISO str or datetime).
    """
    kept: list[dict] = []
    for art in articles:
        is_dup = False
        for k in kept:
            if jaccard(art["headline"], k["headline"]) >= threshold:
                # keep the newer one
                if str(art.get("timestamp", "")) > str(k.get("timestamp", "")):
                    kept.remove(k)
                    kept.append(art)
                is_dup = True
                break
        if not is_dup:
            kept.append(art)
    return kept
