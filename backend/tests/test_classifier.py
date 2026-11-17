"""
tests/test_classifier.py — unit tests for keyword classification.
"""
from services.classifier import classify, deduplicate


def test_theft_headline():
    itype, sev = classify("Bag snatched near Marine Drive")
    assert itype == "THEFT"
    assert sev >= 2


def test_assault_with_death_boosts_severity():
    itype, sev = classify("Man killed in assault at Fort Kochi")
    assert itype == "ASSAULT"
    assert sev >= 4


def test_flood_detected():
    itype, sev = classify("Heavy flooding in Ernakulam streets after monsoon")
    assert itype == "FLOOD"
    assert sev >= 3


def test_protest_detected():
    itype, sev = classify("Hartal called in Kerala by trade unions")
    assert itype == "PROTEST"


def test_curfew_high_severity():
    itype, sev = classify("Curfew imposed in Kochi after communal tensions")
    assert itype == "CURFEW"
    assert sev >= 4


def test_scam_detected():
    itype, sev = classify("Tourists duped by auto-rickshaw scam near airport")
    assert itype == "SCAM"


def test_other_for_irrelevant():
    itype, _ = classify("Cricket match results in Kochi stadium")
    assert itype == "OTHER"


def test_deduplicate_removes_near_duplicate():
    articles = [
        {"headline": "Theft reported at Fort Kochi beach", "timestamp": "2024-01-01T10:00:00"},
        {"headline": "Theft reported at Fort Kochi beach area", "timestamp": "2024-01-01T11:00:00"},
        {"headline": "Heavy rain in Ernakulam causes flooding", "timestamp": "2024-01-01T09:00:00"},
    ]
    result = deduplicate(articles, threshold=0.5)
    assert len(result) == 2   # two distinct stories


def test_deduplicate_keeps_newer():
    articles = [
        {"headline": "Robbery at Marine Drive Kochi", "timestamp": "2024-01-01T08:00:00"},
        {"headline": "Robbery at Marine Drive Kochi", "timestamp": "2024-01-01T12:00:00"},
    ]
    result = deduplicate(articles)
    assert len(result) == 1
    assert result[0]["timestamp"] == "2024-01-01T12:00:00"
