"""Check a public source export's explicit file list and fingerprints."""
import argparse
import hashlib
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--game-dir', type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    root = args.game_dir.resolve()
    manifest = json.loads((root / 'export-manifest.json').read_text(encoding='utf-8'))
    seen = set()
    forbidden = {'.gb', '.gbc', '.sav', '.srm', '.state', '.fnt', '.bps', '.zip', '.exe', '.dll', '.pyc'}
    for entry in manifest['files']:
        name = entry['path']
        path = (root / name).resolve()
        if name in seen or not path.is_relative_to(root):
            raise ValueError('Invalid or duplicate export path: ' + name)
        if path.suffix.lower() in forbidden or set(path.relative_to(root).parts) & {'work', 'out', 'roms', 'reference-private', '__pycache__'}:
            raise ValueError('Private/binary input in public export: ' + name)
        data = path.read_bytes()
        if len(data) != entry['bytes'] or hashlib.sha256(data).hexdigest() != entry['sha256']:
            raise ValueError('Public export fingerprint mismatch: ' + name)
        seen.add(name)
    print('Verified', len(seen), 'explicit public files')


if __name__ == '__main__':
    main()
