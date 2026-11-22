"""Regression gates for the two historical free-space mistakes and RAM aliasing."""
import copy
import json
import unittest

from src.memory_layout import validate_layout
from src.source import ROOT, read_source


class MemoryLayoutTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not (ROOT / 'out/runtime-v026/manifest.json').exists():
            raise unittest.SkipTest('Build v026 with private inputs before the six artifact-dependent checks')
        cls.original, _ = read_source()
        cls.result = (ROOT / 'out/runtime-v026/hp1-korean-runtime-v026.gbc').read_bytes()
        cls.writes = json.loads((ROOT / 'out/runtime-v026/manifest.json').read_text(encoding='utf-8'))['writes']
        cls.ledger = json.loads((ROOT / 'config/memory-layout-v026.json').read_text(encoding='utf-8'))

    def check(self, writes=None, result=None, ledger=None):
        return validate_layout(self.original, result if result is not None else self.result,
                               writes if writes is not None else self.writes,
                               ledger if ledger is not None else self.ledger)

    def test_current_layout(self):
        self.assertEqual(self.check()['reviewed_nontext_writers'], 155)

    def test_new_ff_cave_is_not_implicitly_approved(self):
        writes = copy.deepcopy(self.writes)
        writes.append(dict(writer='unreviewed-cave', offset=0xfe5f, length=2, replacement_hex='0000'))
        with self.assertRaisesRegex(ValueError, 'Unreviewed ROM placement'):
            self.check(writes=writes)

    def test_changed_runtime_requires_review(self):
        writes = copy.deepcopy(self.writes)
        w = next(x for x in writes if x['writer'] == 'remember-command')
        # A new RAM address in an existing helper must not bypass the ledger.
        w['replacement_hex'] = w['replacement_hex'].replace('f9cf', '79cf')
        with self.assertRaisesRegex(ValueError, 'Runtime bytes changed'):
            self.check(writes=writes)

    def test_native_tables_stay_intact(self):
        for address in (0x4a3e, 0xfe5f):
            result = bytearray(self.result)
            result[address] ^= 1
            with self.assertRaisesRegex(ValueError, 'Protected native resource'):
                self.check(result=result)

    def test_overlapping_ram_is_rejected(self):
        ledger = copy.deepcopy(self.ledger)
        next(x for x in ledger['ram_regions'] if x['name'] == 'party-compositor')['start'] = 0xdfcf
        with self.assertRaisesRegex(ValueError, 'Overlapping RAM allocations'):
            self.check(ledger=ledger)

    def test_different_wram_banks_do_not_alias(self):
        ledger = copy.deepcopy(self.ledger)
        region = copy.deepcopy(next(x for x in ledger['ram_regions'] if x['name'] == 'hangul-runtime'))
        region.update(name='test-only-different-bank', bank=2)
        ledger['ram_regions'].append(region)
        self.check(ledger=ledger)


if __name__ == '__main__':
    unittest.main()
