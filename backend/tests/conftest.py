"""tests/conftest.py — shared fixtures"""
import os
import sys
from pathlib import Path

# Make the project root importable
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Point DB to a temp path for tests
os.environ.setdefault("DB_PATH", ":memory:")
os.environ.setdefault("REGION_NAME", "Ernakulam")
os.environ.setdefault("H3_RES", "8")

import pytest
from datetime import datetime, timezone


@pytest.fixture
def now_day():
    """A weekday daytime datetime."""
    return datetime(2024, 6, 10, 14, 0, 0, tzinfo=timezone.utc)   # 2 PM Monday


@pytest.fixture
def now_night():
    """A weekday late-night datetime."""
    return datetime(2024, 6, 10, 2, 0, 0, tzinfo=timezone.utc)    # 2 AM Monday


@pytest.fixture
def kochi_coords():
    return 9.9312, 76.2673
