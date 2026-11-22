"""Lossless Wansung index escape for the HP1 development renderer."""


def glyph_index(char):
    value = char.encode('euc_kr')
    if len(value) != 2 or not 0xB0 <= value[0] <= 0xC8 or not 0xA1 <= value[1] <= 0xFE:
        raise ValueError(f'Missing selected-font glyph: {char!r}')
    return (value[0] - 0xB0) * 94 + value[1] - 0xA1


def encode_char(char):
    index = glyph_index(char)
    return bytes((1, 32 + (index & 31), 32 + ((index >> 5) & 31), 32 + (index >> 10)))


def decode_char(data):
    if len(data) != 4 or data[0] != 1 or any(not 32 <= b < 64 for b in data[1:]):
        raise ValueError('Invalid Hangul escape')
    index = (data[1] - 32) | ((data[2] - 32) << 5) | ((data[3] - 32) << 10)
    if index >= 2350:
        raise ValueError('Hangul index outside font')
    return bytes((0xB0 + index // 94, 0xA1 + index % 94)).decode('euc_kr')


def encode_text(text):
    result = bytearray()
    for char in text:
        if '가' <= char <= '힣':
            result.extend(encode_char(char))
        elif char == ' ':
            result.extend(b'  ')
        elif 32 <= ord(char) < 127:
            result.append(ord(char))
        else:
            raise ValueError('Unmapped character in authored text')
    return bytes(result)
