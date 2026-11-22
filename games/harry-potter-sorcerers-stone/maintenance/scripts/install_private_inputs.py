"""Import only the explicitly fingerprinted local release inputs; no downloads."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.source import ROOT


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--from-directory', type=Path, required=True,
                        help='Authorized private input folder with the same relative layout')
    args = parser.parse_args()
    spec = json.loads((ROOT / 'config/release-v1.0.0.json').read_text(encoding='utf-8'))
    plan = []
    origin = args.from_directory.resolve()
    for item in spec['private_inputs']:
        source = (origin / item['path']).resolve()
        target = (ROOT / item['path']).resolve()
        if not source.is_relative_to(origin) or not target.is_relative_to(ROOT):
            raise ValueError('Private input escapes its root')
        if hashlib.sha256(source.read_bytes()).hexdigest() != item['sha256']:
            raise ValueError('Private input mismatch: ' + item['path'])
        if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() != item['sha256']:
            raise ValueError('Refusing to overwrite a different local input: ' + item['path'])
        plan.append((source, target))
    for source, target in plan:
        target.parent.mkdir(parents=True, exist_ok=True)
        if source != target:
            shutil.copyfile(source, target)
    print('Verified and installed', len(plan), 'local inputs; excluded from public Git')


if __name__ == '__main__':
    main()
