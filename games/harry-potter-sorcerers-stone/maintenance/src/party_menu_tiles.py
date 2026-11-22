"""Tile recipes for the original framed and compact Start menu readouts."""
from src.hangul_encoding import glyph_index
from src.source import ROOT
FONT=dict(zip("0123456789/ ",["111101101101111","010110010010111","111001111100111","111001111001111","101101111001001","111100111001111","111100111101111","111001010010010","111101111101111","111101111001111","001001010100100","0"*15]))
FONT.update(L="100100100100111",v="000000101101010",S="111100111001111",P="110101110100100",M="101111111101101")
def make_tiles(*, compact=False):
    font = (ROOT / 'assets/fonts/7x7_comp.fnt').read_bytes()
    tiles = bytearray()

    # Native menu palette 3 uses index 0 for its backdrop and 1 for label ink.
    background, foreground = (0, 1) if compact else (1, 0)

    def emit(pixel):
        for y in range(8):
            row = [pixel(x, y) for x in range(8)]
            for plane in (0, 1):
                tiles.append(sum(((color >> plane) & 1) << (7 - x)
                                 for x, color in enumerate(row)))

    def pair(left, right, ink, offset=0):
        def pixel(x, y):
            column = x - offset
            if not 1 <= y <= 5 or column < 0 or column % 4 == 3:
                return background
            character = (left, right)[column // 4]
            return ink if FONT[character][3 * (y - 1) + column % 4] == '1' else background
        emit(pixel)

    for left in "0123456789/ ":
        for right in "0123456789/ ":
            pair(left, right, foreground)

    for character in '해리'.ljust(5):
        start = glyph_index(character) * 8 if character != ' ' else None
        rows = font[start:start + 8] if start is not None else bytes(8)
        emit(lambda x, y: foreground if y and x and rows[y - 1] & (128 >> (x - 1)) else background)

    pair('L', 'v', foreground)
    label_ink = foreground if compact else 3
    inset = 0 if compact else 1
    pair('S', 'P', label_ink, inset)
    pair('M', 'P', label_ink, inset)
    for filled in range(9):
        if compact:
            emit(lambda x, y: 1 if x < filled and 2 <= y <= 4 else
                 2 if y == 3 else background)
        else:
            emit(lambda x, y: (3 if x < filled else 2) if 2 <= y <= 4 else 1)
    return bytes(tiles)
