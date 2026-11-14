"""Game Boy 2bpp tile primitives for the Hangul composition PoC."""

from __future__ import annotations


def decode_tile(data: bytes) -> tuple[tuple[int, ...], ...]:
    if len(data) != 16:
        raise ValueError("a Game Boy 2bpp tile must be 16 bytes")
    rows = []
    for row in range(8):
        low, high = data[row * 2 : row * 2 + 2]
        rows.append(tuple(((low >> (7 - col)) & 1) | (((high >> (7 - col)) & 1) << 1) for col in range(8)))
    return tuple(rows)


def encode_tile(pixels: tuple[tuple[int, ...], ...]) -> bytes:
    if len(pixels) != 8 or any(len(row) != 8 for row in pixels):
        raise ValueError("tile pixels must be an 8x8 matrix")
    out = bytearray()
    for row in pixels:
        low = high = 0
        for col, value in enumerate(row):
            if not 0 <= value <= 3:
                raise ValueError("2bpp pixel must be in range 0..3")
            low |= (value & 1) << (7 - col)
            high |= ((value >> 1) & 1) << (7 - col)
        out.extend((low, high))
    return bytes(out)


def overlay_tile(base: bytes, overlay: bytes) -> bytes:
    """Replace base pixels only where the overlay pixel is nonzero."""
    base_pixels, overlay_pixels = decode_tile(base), decode_tile(overlay)
    result = tuple(
        tuple(over if over else under for under, over in zip(base_row, over_row))
        for base_row, over_row in zip(base_pixels, overlay_pixels)
    )
    return encode_tile(result)
