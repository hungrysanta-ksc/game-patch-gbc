import unittest
from src.hangul_encoding import glyph_index, encode_char, decode_char, encode_text


class HangulEncodingTests(unittest.TestCase):
    def test_entire_font_repertoire_and_control_separation(self):
        for index in range(2350):
            char = bytes((0xb0 + index // 94, 0xa1 + index % 94)).decode('euc_kr')
            self.assertEqual(glyph_index(char), index)
            encoded = encode_char(char)
            self.assertEqual(decode_char(encoded), char)
            self.assertTrue(all(32 <= b < 64 for b in encoded[1:]))
            self.assertNotIn(ord('@'), encoded)
            self.assertNotIn(ord('_'), encoded)

    def test_rejects_invalid_and_unavailable_glyphs(self):
        for payload in (b'\x01\x20\x20', b'\x01\x20\x20\x40', b'\x01\x3f\x3f\x3f'):
            with self.assertRaises(ValueError):
                decode_char(payload)
        for text in ('힣', '漢', '\n'):
            with self.assertRaises(ValueError):
                encode_text(text)

    def test_native_tokens_remain_exact(self):
        self.assertEqual(encode_text('@1_ A'), b'@1_  A')


if __name__ == '__main__':
    unittest.main()
