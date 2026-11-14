"""Deterministic Unicode Hangul syllable decomposition for the runtime PoC."""

from __future__ import annotations

SBASE = 0xAC00
LCOUNT, VCOUNT, TCOUNT = 19, 21, 28
NCOUNT = VCOUNT * TCOUNT
SCOUNT = LCOUNT * NCOUNT


def decompose_syllable(char: str) -> tuple[int, int, int] | None:
    """Return ( choseong, jungseong, jongseong ) indices; jongseong 0 means none."""
    if len(char) != 1:
        raise ValueError("expected one Unicode character")
    code = ord(char) - SBASE
    if not 0 <= code < SCOUNT:
        return None
    return code // NCOUNT, (code % NCOUNT) // TCOUNT, code % TCOUNT


def decompose_text(text: str) -> list[tuple[str, tuple[int, int, int]]]:
    """Return only precomposed Hangul syllables with their component indices."""
    return [(char, parts) for char in text if (parts := decompose_syllable(char)) is not None]
