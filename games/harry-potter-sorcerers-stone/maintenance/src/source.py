"""Immutable supported-ROM boundary."""
import hashlib
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_source(path=None):
    profile = json.loads((ROOT / 'config/source-profile.json').read_text(encoding='utf-8'))
    path = path or os.environ.get('HP1_SOURCE_ROM')
    path = Path(path) if path else ROOT / 'roms' / profile['filename']
    data = path.read_bytes()
    if len(data) != profile['size_bytes'] or hashlib.sha256(data).hexdigest() != profile['sha256']:
        raise ValueError('Unsupported source ROM: size or SHA-256 mismatch')
    header_sum = 0
    for value in data[0x134:0x14D]:
        header_sum = (header_sum - value - 1) & 255
    if header_sum != data[0x14D]:
        raise ValueError('Invalid source header checksum')
    if (sum(data[:0x14E]) + sum(data[0x150:])) & 65535 != int.from_bytes(data[0x14E:0x150], 'big'):
        raise ValueError('Invalid source global checksum')
    return data, profile
