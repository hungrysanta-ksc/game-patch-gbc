"""Reviewed native object records; no new code, RAM, or reward state.

The invisible interaction rectangles sit behind forest collision tiles. Move
only their Y anchors towards the reachable south edge. Keep X unchanged: the
native placement index groups these six-byte records by horizontal sector.
Evidence and original/save-specific pickup audit: docs/qa-v027.md.
"""

# writer, source ROM offset, expected full record, replacement full record
CORRECTIONS = (
    ('forest-3-pickup-3-position', 0x27BE0C, '0703df000c01', '0703df001401'),
    ('forest-4-pickup-2-position', 0x27BE63, '0702ed014c00', '0702ed015c00'),
    ('forest-4-pickup-3-position', 0x27BE6F, '07035e02b301', '07035e02c301'),
    ('forest-5-pickup-2-position', 0x27BEBD, '07028c015201', '07028c015a01'),
    ('forest-6-pickup-3-position', 0x27BF05, '070354005301', '070354005b01'),
)


def approved_write(name, start, expected, data):
    return any(name == writer and start == offset
               and expected == bytes.fromhex(before) and data == bytes.fromhex(after)
               for writer, offset, before, after in CORRECTIONS)
