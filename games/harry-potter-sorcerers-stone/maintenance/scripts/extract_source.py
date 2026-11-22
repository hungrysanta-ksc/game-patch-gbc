"""Extract the fixed English-US table and verify unchanged meaningful bits."""
import csv
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.source import ROOT, read_source
from src.text_codec import decode, read_tree, encode_bits, display_codes


def main():
    rom, profile = read_source(sys.argv[1] if len(sys.argv) > 1 else None)
    spec = json.loads((ROOT / 'config/text-format.json').read_text(encoding='utf-8'))
    for item in spec['consumer_fingerprints']:
        expected = bytes.fromhex(item['expected_hex'])
        if rom[item['offset']:item['offset'] + len(expected)] != expected:
            raise ValueError('Consumer fingerprint mismatch: ' + item['name'])
    table = spec['english_us']
    tree, codes = read_tree(rom, table['base_bank'], table['tree_address'])
    if table['descriptor_start'] + table['count'] * 3 != table['tree_address']:
        raise ValueError('Descriptor/tree boundary mismatch')
    entries = []
    restored = bytearray(rom)
    for i in range(table['count']):
        entry = decode(rom, table['base_bank'], table['descriptor_start'] + i * 3, tree)
        raw = entry.pop('raw')
        bits = encode_bits(raw, codes)
        if len(bits) != entry['compressed_bits']:
            raise ValueError('Encoded bit length differs')
        start = entry['source_offset']
        for j, bit in enumerate(bits):
            pos, shift = start + j // 8, j % 8
            if (rom[pos] >> shift) & 1 != bit:
                raise ValueError('Source bit round trip mismatch')
            restored[pos] = (restored[pos] & ~(1 << shift)) | (bit << shift)
        consumed = (len(bits) + 7) // 8
        native = raw[:-1] + bytes((raw[-1] | 128,))
        entry.update(id=f'hp1-en-us-{i:04d}', index=i, raw_hex=raw.hex(),
                     native_decoded_hex=native.hex(), source_codes=display_codes(raw),
                     compressed_hex=rom[start:start + consumed].hex(),
                     nonprintable_codes=sorted(set(v for v in raw if v < 32)),
                     translation_state='untranslated', translation=None)
        entries.append(entry)
    if restored != rom:
        raise ValueError('Whole-ROM unchanged reinsertion mismatch')
    report = {'source_sha256': profile['sha256'], 'scope': 'English-US descriptor table only; other consumers/graphics unresolved',
              'entries': len(entries), 'unique_stream_starts': len({e['source_offset'] for e in entries}),
              'decoded_code_count': sum(len(bytes.fromhex(e['raw_hex'])) for e in entries),
              'max_decoded_codes': max(len(bytes.fromhex(e['raw_hex'])) for e in entries),
              'entries_with_nonprintable_codes': sum(bool(e['nonprintable_codes']) for e in entries),
              'all_meaningful_bits_roundtrip': True, 'whole_rom_unchanged': True,
              'roundtrip_sha256': hashlib.sha256(restored).hexdigest(),
              'runtime_decoder_crosscheck': 'pending', 'control_semantics': 'pending'}
    folder = ROOT / 'work/extraction'
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'source-catalog.json').write_text(json.dumps({'report': report, 'entries': entries}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (folder / 'verification.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    with (folder / 'source-review.tsv').open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f, delimiter='\t')
        w.writerow(['id', 'source_codes', 'translation', 'state'])
        w.writerows((e['id'], e['source_codes'], '', 'untranslated') for e in entries)
    print(json.dumps(report))


if __name__ == '__main__':
    main()
