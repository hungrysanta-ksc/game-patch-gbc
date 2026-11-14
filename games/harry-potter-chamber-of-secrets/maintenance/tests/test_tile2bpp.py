from src.tile2bpp import decode_tile, encode_tile, overlay_tile


def test_2bpp_roundtrip_and_transparent_overlay():
    base = bytes([0xFF, 0x00] * 8)
    overlay = bytes([0x00, 0x80] + [0x00, 0x00] * 7)
    assert encode_tile(decode_tile(base)) == base
    result = decode_tile(overlay_tile(base, overlay))
    assert result[0][0] == 2
    assert result[0][1] == 1
    assert result[1][0] == 1
