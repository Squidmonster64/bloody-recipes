"""Regression tests for supermarket shopping-list normalisation."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "generator"))

from app.models import SourceFacts
from app.normalize import (
    _looks_like_intermediate_shopping_item,
    _repair_shopping_lists,
)


class _FailingCompletions:
    def create(self, **kwargs):
        raise RuntimeError("offline test")


class _FailingChat:
    completions = _FailingCompletions()


class _FailingClient:
    chat = _FailingChat()


def test_shredded_beef_with_sauce_is_not_a_retail_item():
    assert _looks_like_intermediate_shopping_item("750 g shredded beef with sauce")
    assert not _looks_like_intermediate_shopping_item("200 g shredded cheddar")


def test_suspect_beef_component_falls_back_to_source_beef_cut():
    source = SourceFacts(
        submitted_url="pasted://test",
        ingredients=[
            "750 g beef chuck",
            "1 brown onion",
            "2 tbsp tomato paste",
        ],
    )
    buy, pantry = _repair_shopping_lists(
        _FailingClient(),
        source,
        "",
        ["750 g shredded beef with sauce", "1 brown onion"],
        ["2 tbsp tomato paste"],
    )
    assert buy == ["750 g beef chuck", "1 brown onion"]
    assert pantry == ["2 tbsp tomato paste"]
    assert not any(_looks_like_intermediate_shopping_item(i) for i in [*buy, *pantry])
