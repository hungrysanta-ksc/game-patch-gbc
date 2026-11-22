"""Prove the compact writer pools against HP1's retired language streams."""
from src.text_codec import decode, read_tree


def text_pool(original):
    owned = bytearray(len(original))
    for bank in (0x26, 0x2C, 0x33):
        base = bank * 0x4000
        tree, _ = read_tree(original, bank, 0x63E6)
        end = base + 0x23E7 + len(tree)
        owned[base + 1:end] = b'\x01' * (end - base - 1)
        for index in range(3063):
            entry = decode(original, bank, 0x4001 + 3 * index, tree)
            start = entry['source_offset']
            length = (entry['compressed_bits'] + 7) // 8
            owned[start:start + length] = b'\x01' * length
    # Native bank tags at 4000 are outside the allocator, even in pure text banks.
    lo, hi = 0x26 * 0x4000, 0x3A * 0x4000
    if original[0x1871A:0x1871D] != bytes([0x26, 0x2C, 0x33]):
        raise ValueError('Retired language table changed')
    for pos in range(lo, hi):
        if pos % 0x4000 and not owned[pos] and original[pos] != 0xFF:
            raise ValueError(f'Unclassified compact pool byte at {pos:#x}')
    return lo, hi
