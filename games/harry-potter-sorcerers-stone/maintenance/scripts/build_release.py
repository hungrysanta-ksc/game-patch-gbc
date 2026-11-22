"""Rebuild a frozen release from original ROM, then verify and package one BPS.

Python standard library plus the externally supplied, fingerprinted Flips tool.
Private translation/font inputs are identified by config, never embedded here.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.source import ROOT, read_source


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rom', type=Path, required=True)
    parser.add_argument('--flips', type=Path, required=True)
    parser.add_argument('--profile', default='config/release-v1.0.0.json')
    parser.add_argument('--docs-dir', type=Path, default=ROOT.parent)
    parser.add_argument('--out', type=Path, default=ROOT / 'out/release-v1.0.0')
    args = parser.parse_args()
    spec = json.loads((ROOT / args.profile).read_text(encoding='utf-8'))
    original, source_profile = read_source(args.rom)
    for item in spec['private_inputs']:
        path = ROOT / item['path']
        require(path.is_file(), 'Missing private input: ' + item['path'])
        require(digest(path) == item['sha256'], 'Private input mismatch: ' + item['path'])
    require(digest(args.flips) == spec['flips']['sha256'], 'Flips binary fingerprint mismatch')
    env = dict(os.environ, HP1_SOURCE_ROM=str(args.rom.resolve()))
    for command in [('scripts/extract_source.py',),
                    ('scripts/build_runtime.py', '--spec', spec['runtime_spec'])]:
        subprocess.run([sys.executable, *command], cwd=ROOT, env=env, check=True)
    target_path = ROOT / 'out' / ('runtime-' + spec['runtime_version']) / ('hp1-korean-runtime-' + spec['runtime_version'] + '.gbc')
    target = target_path.read_bytes()
    require(len(target) == spec['output_bytes'] and digest(target_path) == spec['output_sha256'],
            'Rebuilt ROM differs from the approved release')
    runtime = json.loads((target_path.parent / 'manifest.json').read_text(encoding='utf-8'))
    require(bool(runtime.get('memory_layout_review')), 'Missing reviewed memory layout')
    documents = ['README.md', 'INSTALL.md', 'CHANGELOG.md', 'THIRD-PARTY-NOTICES.md']
    for name in documents:
        require((args.docs_dir / name).is_file(), 'Missing release document: ' + name)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='release-stage-', dir=args.out.parent) as td:
        stage = Path(td)
        patch = stage / (spec['tag'] + '.bps')
        subprocess.run([str(args.flips.resolve()), '--create', '--bps', str(args.rom.resolve()), str(target_path), str(patch)], check=True)
        applied = stage / 'roundtrip.gbc'
        subprocess.run([str(args.flips.resolve()), '--apply', str(patch), str(args.rom.resolve()), str(applied)], check=True)
        require(applied.read_bytes() == target, 'BPS application is not byte-identical')
        bad_source = stage / 'wrong-source.gbc'
        damaged = bytearray(original)
        damaged[0x200] ^= 1
        bad_source.write_bytes(damaged)
        bad_patch = stage / 'corrupt.bps'
        damaged = bytearray(patch.read_bytes())
        damaged[len(damaged) // 2] ^= 1
        bad_patch.write_bytes(damaged)
        negative = []
        for label, p, source in [('wrong-source', patch, bad_source), ('corrupt-patch', bad_patch, args.rom.resolve())]:
            rejected_output = stage / (label + '-rejected-output.gbc')
            run = subprocess.run([str(args.flips.resolve()), '--apply', str(p), str(source), str(rejected_output)], capture_output=True)
            require(run.returncode != 0 and not rejected_output.exists(), 'Invalid BPS/source was not rejected: ' + label)
            negative.append(dict(case=label, rejected=True))
        manifest = dict(version=spec['version'], tag=spec['tag'], variant='single-with-optional-cheats',
                        source_sha256=source_profile['sha256'], output_sha256=spec['output_sha256'],
                        output_bytes=len(target), patch_sha256=digest(patch), patch_bytes=patch.stat().st_size,
                        flips=spec['flips'], byte_identical_application=True, negative_cases=negative,
                        memory_layout=runtime['memory_layout_review'],
                        documents={name: digest(args.docs_dir / name) for name in documents})
        manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
        members = {name: (args.docs_dir / name).read_bytes() for name in documents}
        members.update({patch.name: patch.read_bytes(), 'release-manifest.json': manifest_bytes})
        archive = stage / (spec['tag'] + '.zip')
        with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            for name, data in sorted(members.items()):
                info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                z.writestr(info, data)
        with zipfile.ZipFile(archive) as z:
            require(z.testzip() is None and set(z.namelist()) == set(members), 'Invalid release ZIP')
            for name, data in members.items():
                require(z.read(name) == data, 'ZIP member mismatch: ' + name)
        # Publish only fully verified outputs; ROMs and temporary probes stay out.
        args.out.mkdir(parents=True, exist_ok=True)
        for path in (patch, archive):
            shutil.copyfile(path, args.out / path.name)
        (args.out / 'verification.json').write_bytes(manifest_bytes)
        print(json.dumps(dict(zip=archive.name, zip_sha256=digest(archive), patch_sha256=digest(patch),
                              output_sha256=spec['output_sha256'], verified=True)))


if __name__ == '__main__':
    main()
