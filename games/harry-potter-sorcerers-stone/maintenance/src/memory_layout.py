"""Enforce the manually reviewed ROM placements and bank-qualified RAM ledger.

This is a regression guard, not an automatic free-space detector. Updating the
ledger requires reviewing native consumers; FF fill alone never qualifies.
"""
import hashlib
import json
import re
from src.source import ROOT


def validate_layout(original, result, writes, ledger):
    if hashlib.sha256(original).hexdigest() != ledger['source_sha256']:
        raise ValueError('Memory layout source mismatch')
    sites = {x['writer']: x for x in ledger['rom_sites']}
    if len(sites) != len(ledger['rom_sites']):
        raise ValueError('Duplicate reviewed ROM writer')
    seen = set()
    for w in writes:
        name, start, length = w['writer'], w['offset'], w['length']
        if re.fullmatch(r'raw-hp1-en-us-\d{4}', name):
            lo, hi = ledger['raw_text_range']
            if not (lo <= start < start + length <= hi):
                raise ValueError('Raw text outside reviewed allocation: ' + name)
            continue
        site = sites.get(name)
        if not site or site['offset'] != start or site['length'] != length:
            raise ValueError('Unreviewed ROM placement: ' + name)
        seen.add(name)
        if 'replacement_sha256' in site:
            digest = hashlib.sha256(bytes.fromhex(w['replacement_hex'])).hexdigest()
            if digest != site['replacement_sha256']:
                raise ValueError('Runtime bytes changed since memory review: ' + name)
    if seen != sites.keys():
        raise ValueError('Reviewed ROM writer set changed')
    for p in ledger['protected_rom']:
        start, end = p['start'], p['end']
        if result[start:end] != original[start:end]:
            raise ValueError('Protected native resource modified: ' + p['name'])
    for index, a in enumerate(ledger['ram_regions']):
        if not a['start'] < a['end'] or not a['evidence']:
            raise ValueError('Invalid RAM allocation: ' + a['name'])
        for b in ledger['ram_regions'][:index]:
            if (a['space'], a['bank']) == (b['space'], b['bank']):
                if a['start'] < b['end'] and b['start'] < a['end']:
                    raise ValueError('Overlapping RAM allocations: ' + a['name'] + ' / ' + b['name'])
    return {'ledger': ledger['id'], 'reviewed_nontext_writers': len(seen),
            'text_writers': len(writes) - len(seen),
            'ram_regions': len(ledger['ram_regions']),
            'scope': 'Placement/content regression guard; not proof of all indirect native accesses'}


def check(original, result, writes, path):
    return validate_layout(original, result, writes,
                           json.loads((ROOT / path).read_text(encoding='utf-8')))
