"""HP1 descriptor/Huffman reader, derived from target bank-0 consumer code.

Tree loader $360F, descriptor resolver $300A, bit decoder $3633.
This layer preserves codes; it does not interpret layout or game events.
"""


def offset(bank, address):
    if not 0 <= bank < 256 or not 0x4000 <= address < 0x8000:
        raise ValueError('Invalid bank/window address')
    return bank * 0x4000 + address - 0x4000


def tree_codes(tree):
    codes = {}

    def walk(node, path, ancestors):
        if node * 2 + 1 >= len(tree):
            raise ValueError('Out-of-range tree node')
        if node in ancestors:
            # The original tree has a zero child returning to the root.
            # It emits no symbol. Enumerate simple leaf paths; the full-table
            # bit comparison must independently prove these encode every stream.
            return
        for bit in (0, 1):
            child = tree[node * 2 + bit]
            if child & 0x80:
                value = child & 0x7F
                if value in codes:
                    raise ValueError('Duplicate leaf needs explicit encoding policy')
                codes[value] = path + (bit,)
            else:
                walk(child, path + (bit,), ancestors | {node})
    walk(0, (), set())
    if 127 not in codes:
        raise ValueError('Missing terminator')
    return codes


def read_tree(rom, bank, address):
    start = offset(bank, address)
    size = rom[start] * 2
    if not size or (address + 1 + size) > 0x8000:
        raise ValueError('Invalid tree size')
    tree = rom[start + 1:start + 1 + size]
    if len(tree) != size:
        raise ValueError('Truncated tree')
    return tree, tree_codes(tree)


def decode(rom, base_bank, descriptor_address, tree, *, max_output=4096):
    desc = offset(base_bank, descriptor_address)
    target_bank = base_bank + rom[desc]
    stored = int.from_bytes(rom[desc + 1:desc + 3], 'little')
    address = stored | 0x4000
    start = offset(target_bank, address)
    output = bytearray()
    node = 0
    for bit_index in range((0x8000 - address) * 8):
        value = rom[start + bit_index // 8]
        bit = (value >> (bit_index % 8)) & 1
        child = tree[node * 2 + bit]
        if child & 0x80:
            char = child & 127
            if char == 127:
                if not output:
                    raise ValueError('Empty output: native final-character flag would underflow')
                return {'descriptor_offset': desc, 'descriptor_hex': rom[desc:desc + 3].hex(),
                        'source_bank': target_bank, 'source_address': address,
                        'source_offset': start, 'compressed_bits': bit_index + 1,
                        'raw': bytes(output)}
            output.append(char)
            if len(output) > max_output:
                raise ValueError('Decode exceeds investigation bound')
            node = 0
        else:
            node = child
    raise ValueError('Stream crosses bank window without a terminator')


def encode_bits(raw, codes):
    return tuple(bit for value in raw + b'\x7f' for bit in codes[value])


def display_codes(raw):
    # Literal ASCII-like codes only; braces also escaped to keep this reversible.
    return ''.join(chr(v) if 32 <= v <= 126 and v not in (123, 125)
                   else '{BYTE:%02X}' % v for v in raw)
