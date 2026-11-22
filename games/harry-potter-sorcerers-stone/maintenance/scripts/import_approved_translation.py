"""Import the exact user-approved TSV without rewriting its prose."""
import csv
import hashlib
import io
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.source import ROOT, read_source
from src.hangul_encoding import encode_text

EXPECTED = 'c8245204ddd9324f1258218fa2ee63909aa0cf09e1ac5729828ca865724b47b7'


def main():
    path = Path(sys.argv[1])
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != EXPECTED:
        raise ValueError('Not the approved TSV revision')
    _, profile = read_source()
    rows = list(csv.DictReader(io.StringIO(data.decode('utf-8-sig')), delimiter='\t'))
    entries = json.loads((ROOT / 'work/extraction/source-catalog.json').read_text())['entries']
    by_id = {r['id']: r for r in rows}
    if len(by_id) != len(rows) or set(by_id) != {e['id'] for e in entries}:
        raise ValueError('Missing/extra/duplicate IDs')
    drafts = []
    blanks = []
    lengths = []
    for entry in entries:
        row = by_id[entry['id']]
        text = row['번역문']
        if row['원문'] != entry['source_codes']:
            raise ValueError('Protected original differs: ' + entry['id'])
        if re.findall(r'@[1-9]', text) != re.findall(r'@[1-9]', row['원문']) or text.count('_') != row['원문'].count('_'):
            raise ValueError('Control token mismatch: ' + entry['id'])
        preserve = text == '' and bytes.fromhex(entry['raw_hex']) == b' '
        if not text and not preserve:
            raise ValueError('Unexpected empty translation')
        raw = bytes.fromhex(entry['raw_hex']) if preserve else encode_text(text)
        if len(raw) > 1024:
            raise ValueError('Text exceeds buffer: ' + entry['id'])
        drafts.append({'id': entry['id'], 'source': row['원문'], 'translation': text,
                       'state': 'user-approved', 'speaker_or_type': row['화자/유형'],
                       'original_review_label': row['판정'], 'preserve_source_blank': preserve})
        lengths.append({'id': entry['id'], 'encoded_bytes': len(raw)})
        if preserve:
            blanks.append(entry['id'])
    folder = ROOT / 'assets/translation/reference-private/approved-v001'
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'user-approved.tsv').write_bytes(data)
    artifact = {'source_sha256': profile['sha256'], 'approved_tsv_sha256': EXPECTED,
                'non_distribution': True, 'approval': 'User explicitly approved every row; preserve wording; gameplay correction deferred to QA',
                'drafts': drafts}
    (folder / 'translation.json').write_text(json.dumps(artifact, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    report = {'approved_tsv_sha256': EXPECTED, 'rows': len(rows), 'approved_text_rows': len(rows) - len(blanks),
              'preserved_blank_rows': len(blanks), 'blank_ids': blanks, 'missing_ids': [], 'unknown_glyphs': [],
              'source_mismatches': [], 'token_mismatches': [], 'lengths': lengths}
    (ROOT / 'work/approved-v001-import.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ('rows', 'approved_text_rows', 'preserved_blank_rows', 'approved_tsv_sha256')}))


if __name__ == '__main__':
    main()
