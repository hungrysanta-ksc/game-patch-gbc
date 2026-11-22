"""Failure boundaries that must reject malformed input before translation."""
import unittest
from src.text_codec import decode, offset, tree_codes


class CodecBoundaries(unittest.TestCase):
    def test_invalid_banked_address(self):
        for bank, address in [(256, 0x4000), (1, 0x8000), (1, 0x3FFF)]:
            with self.assertRaises(ValueError):
                offset(bank, address)

    def test_no_terminator(self):
        with self.assertRaises(ValueError):
            tree_codes(bytes([0xC1, 0xC2]))

    def test_stream_without_terminator_cannot_wrap_into_another_bank(self):
        rom = bytearray(0x8000)
        rom[0x4001:0x4004] = bytes([0, 0xFF, 0x7F])
        with self.assertRaisesRegex(ValueError, 'crosses bank'):
            decode(rom, 1, 0x4001, bytes([0xC1, 0xFF]))

    def test_native_termination_requires_a_preceding_character(self):
        rom = bytearray(0x8000)
        rom[0x4001:0x4004] = bytes([0, 0x00, 0x50])
        rom[0x5000] = 1
        with self.assertRaisesRegex(ValueError, 'underflow'):
            decode(rom, 1, 0x4001, bytes([0xC1, 0xFF]))


if __name__ == '__main__':
    unittest.main()
