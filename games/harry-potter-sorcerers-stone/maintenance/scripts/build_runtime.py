"""Build the cumulative development renderer from the immutable source."""
import hashlib
import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.source import ROOT, read_source
from src.compact_runtime import text_pool
from src.hangul_encoding import encode_text, glyph_index
from src.sm83_poc_assembler import assemble, decode_machine, reassemble_decoded
from src.forest_pickup_positions import CORRECTIONS, approved_write


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--spec', default='config/runtime-v002.json')
    args = parser.parse_args()
    original, profile = read_source()
    catalog = json.loads((ROOT / 'work/extraction/source-catalog.json').read_text(encoding='utf-8'))
    spec = json.loads((ROOT / args.spec).read_text(encoding='utf-8'))
    version = spec['version']
    compact = spec.get('compact_field_dash', False)
    baseline = original if compact else original + b'\xff' * len(original)
    if compact:
        pool_start, pool_end = text_pool(original)
    if not re.fullmatch(r'v[0-9]{3}', version) or not spec['non_distribution']:
        raise ValueError('Invalid development version')
    draft_path = ROOT / spec['drafts_path']
    artifact = json.loads(draft_path.read_text(encoding='utf-8'))
    if any(x['source_sha256'] != profile['sha256'] for x in (artifact, catalog['report'])) or not artifact['non_distribution']:
        raise ValueError('Source identity/development policy mismatch')
    drafts = {e['id']: e for e in artifact['drafts']}
    if len(drafts) != len(artifact['drafts']) or set(drafts) - {e['id'] for e in catalog['entries']}:
        raise ValueError('Duplicate or unknown translation ID')
    font_path = ROOT / 'assets/fonts/7x7_comp.fnt'
    font = font_path.read_bytes()
    if len(font) != 18800 or sha(font) != '04ba6bb04d33662dd0a1f324c31c31b4cc7824b593e6b80a5bdcdf1111bb43f6':
        raise ValueError('Font identity mismatch')
    writes = []; machine_records = []

    def add(name, start, data, *, expected=None, intent='data'):
        end = start + len(data)
        if start < 0 or end > len(baseline) or not data:
            raise ValueError('Invalid write extent')
        # 05:6840 and 05:684C read bank 01's destination tables for story
        # warps. Reserve the entire four-table set, including other maps.
        if spec.get('preserve_event_warps') and start < 0x4BCA and end > 0x4A3E:
            raise ValueError('Write to native warp tables: ' + name)
        # FF words here select the secondary house-score table at 03:7E81.
        if spec.get('preserve_house_scores') and start < 0xFE8D and end > 0xFE51:
            raise ValueError('Write to native house-score tables: ' + name)
        if expected is not None and baseline[start:end] != expected:
            raise ValueError('Source fingerprint mismatch: ' + name)
        native_chair_fix = (spec.get('field_discovery_corrections') and
                            name == 'great-hall-combination-position' and
                            start == 0x28FFED and data == bytes.fromhex('0a192501a600') and
                            expected == bytes.fromhex('0a1925019e00'))
        native_forest_fix = (spec.get('forest_pickup_positions') and
                             approved_write(name, start, expected, data))
        if compact and start >= 0x80000 and name != 'english-self-descriptors' and not (native_chair_fix or native_forest_fix):
            if not (pool_start <= start < end <= pool_end and start % 0x4000
                    and start // 0x4000 == (end - 1) // 0x4000):
                raise ValueError('Write outside retired language bank: ' + name)
        for w in writes:
            if start < w['offset'] + w['length'] and w['offset'] < end:
                raise ValueError('Overlapping writes: ' + name)
        writes.append({'writer': name, 'offset': start, 'length': len(data), 'intent': intent,
                       'expected_hex': baseline[start:end].hex(), 'replacement_hex': data.hex()})

    def machine(name, text, origin):
        data = assemble(text, origin=origin)
        if reassemble_decoded(decode_machine(data, origin=origin), origin=origin) != data:
            raise ValueError('Code round trip failed')
        machine_records.append({'name': name, 'origin': origin, 'length': len(data), 'sha256': sha(data)})
        return data

    def routine(name):
        suffix = '_compact' if compact and name in ('loader', 'raw_reader', 'glyph', 'decode_gate') else ''
        return (ROOT / f'src/runtime/{name}{suffix}.asm').read_text()

    module = bytearray(640)
    placements = [('raw_reader', 0xDDA0, 96), ('glyph', 0xDE00, 192),
                  ('string_width', 0xDEC0, 64), ('word_width', 0xDF00, 128), ('is_hangul', 0xDF80, 128)]
    deferred = spec.get('deferred_variable_strings', False)
    if deferred:
        placements[1] = ('glyph', 0xDE00, 128)
        placements[-1] = ('is_hangul', 0xDF80, 16)
        placements += [('variable_descriptor', 0xDE80, 64), ('variable_copy', 0xDF90, 112)]
    module_spans = []
    for name, origin, capacity in placements:
        text = routine(name)
        data = machine(name, text, origin)
        if len(data) > capacity:
            raise ValueError('Module capacity exceeded: ' + name)
        if any(origin < end and start < origin + len(data) for start, end in module_spans):
            raise ValueError('Overlapping module code: ' + name)
        module_spans.append((origin, origin + len(data)))
        module[origin - 0xDD80:origin - 0xDD80 + len(data)] = data
    if spec.get('party_and_cursor') and any(end > 0xDFD0 for _, end in module_spans):
        raise ValueError('Renderer code overlaps the party panel backup at WRAM7:DFD0-DFFF')
    add('runtime-module', pool_start + 0x3000 if compact else 0x403000, bytes(module), intent='declared-machine-code-and-padding')
    for name, origin, capacity in [('loader', 0x3A78, 56), ('decode_gate', 0x3FD7, 41)]:
        if name == 'loader' and spec.get('party_and_cursor'):
            continue
        data = machine(name, routine(name), origin)
        if len(data) > capacity:
            raise ValueError('Cave capacity exceeded')
        add(name, origin, data, expected=b'\xff' * len(data), intent='machine-code')
    for name, offset, text, expected in [
        ('init-loader-hook', 0x680A, 'CALL $7FB7' if spec.get('party_and_cursor') else 'CALL $3A78', 'cd4a11'),
        ('substitution-reader-hook', 0x3082, 'CALL $3FD7', 'cd3336'),
        ('direct-reader-hook', 0x30C8, 'CALL $3FD7', 'cd3336'),
        ('glyph-hook', 0x656D, 'JP $DE00\nNOP', 'c5faaec1'),
        ('word-width-hook', 0x703F, 'JP $DF00\nNOP', 'e5cd5c67'),
        ('string-width-hook', 0x6742, 'JP $DEC0\nNOP', 'c5e51e00'),
    ]:
        add(name, offset, machine(name, text, offset), expected=bytes.fromhex(expected), intent='machine-code')
    if deferred:
        add('descriptor-reader-hook', 0x3630, machine('descriptor-reader-hook', 'JP $DE80', 0x3630),
            expected=bytes.fromhex('cd0a30'), intent='machine-code')
        add('variable-copy-hook', 0x3069, machine('variable-copy-hook', 'JP $DF90\nNOP', 0x3069),
            expected=bytes.fromhex('2a12cb7f'), intent='machine-code')
    if compact:
        patches = [
            ('language-screen-skip', 0x1872F, 'JP $47AC', '215f79'),
            ('language-slot', 0x187DF, 'XOR A\nLD [$CDDD],A\nLD A,$20\nLD [$CDDC],A\nNOP',
             'eaddcd211947cfeadccd'),
            ('restore-settings', 0x11670, 'CALL $7FA2', 'cd4011'),
            ('lock-loaded-language', 0x13FA2,
             'CALL $1140\nPUSH AF\nXOR A\nLD [$CDDD],A\nLD A,$20\nLD [$CDDC],A\nPOP AF\nRET', 'ff' * 15),
            ('title-count', 0x142DF, 'ADD A,$02', 'c603'),
            ('title-cursor', 0x14191, routine('title_cursor'),
             'fe403eff28023e012155cd86e603fe032013fa40cbb73e03200bf0a5e64028043e021801af'),
            ('field-vector-hook', 0xEEB7, 'JP $3FEA', 'c34b12'),
            ('field-dash', 0x3FEA, routine('field_dash'), 'ff' * 22),
            ('field-dash-axis', 0x3AA4, routine('field_dash_axis'), 'ff' * 10),
        ]
        if spec.get('title_bonus_entry'):
            # Last remaining row is Bonus Games for both SRAM states. Native
            # dispatch remaps the no-save cursor to the same logical index 2.
            patches.extend([
                ('next-title-label', 0x142FE, 'CALL $7FBE\nNOP', '19110300'),
                ('title-label-step', 0x17FBE,
                 'ADD HL,DE\nLD DE,$0003\nLD A,B\nCP A,$02\nRET NZ\nLD HL,$15F4\nRET', 'ff' * 12),
                ('title-bonus-action', 0x141EF, 'CP A,$02', 'fe03'),
            ])
        if spec.get('field_cheat_shortcut'):
            buttons = routine('field_cheat_buttons')
            size = len(assemble(buttons, origin=0x7F65))
            if size > 0x8000 - 0x7F65:
                raise ValueError('Field button handler exceeds bank 02')
            patches.extend([
                ('field-buttons-init-hook', 0x62F9, 'CALL $7FE0', 'faeccc'),
                ('field-buttons-init', 0x7FE0, 'XOR A\nLD [$CE16],A\nLD A,[$CCEC]\nRET', 'ff' * 8),
                ('field-cheat-buttons', 0xBF65, buttons, 'ff' * size),
                # 179D saved the caller's bank. Restore it before any native
                # action. Fall through to 17C4 for the original cheat menu.
                ('field-button-dispatch', 0x17A9,
                 'OR A\nLD A,$02\nLD [$2000],A\nCALL $7F65\nLD L,A\nPOP AF\n'
                 'LD [$2000],A\nLD A,L\nOR A\nRET Z\nCP A,$04\nJR Z,$17E1\n'
                 'CP A,$08\nJR Z,$180A\nNOP\nNOP',
                 '6ff1ea00207db7c81819f0a4e647fe472011af2116ceb6280a35c0'),
            ])
        if spec.get('battle_edition'):
            from src.battle_edition import install
            install(add, machine, original, preserve_event_warps=spec.get('preserve_event_warps', False))
        elif spec.get('progression_cheats'):
            if not spec.get('field_cheat_shortcut'):
                raise ValueError('Progression menu requires the field shortcut')
            # Historical v017 layout, superseded by v019's banked cheat labels.
            # Keep new labels local to this menu, outside the dialogue catalog.
            addr = 0x4A3E
            labels = {}
            for key, label in [('level', '레벨 99로 올리기'), ('level_done', '레벨 99 (완료)'),
                               ('spells', '주문 전체 습득'), ('spells_done', '주문 전체 습득 (완료)')]:
                data = bytearray(encode_text(label))
                data[-1] |= 0x80
                if addr + len(data) > 0x4BCA:
                    raise ValueError('Cheat labels exceed retired warp tables')
                labels[key] = f'${addr:04X}'
                add('cheat-label-' + key, addr, data, expected=original[addr:addr + len(data)])
                addr += len(data)
            for name, start, end, source in [
                    ('cheat-actions', 0x4C31, 0x4CC2, routine('cheat_actions')),
                    ('cheat-label-draw', 0x4CE4, 0x4D5F, routine('cheat_labels').format(**labels))]:
                code = machine(name, source, start)
                if start + len(code) > end:
                    raise ValueError('Cheat menu region exceeded: ' + name)
                add(name, start, code, expected=original[start:start + len(code)], intent='machine-code')
        for name, offset, body, expected in patches:
            origin = offset if offset < 0x4000 else 0x4000 + offset % 0x4000
            data = machine(name, body, origin)
            if len(data) != len(bytes.fromhex(expected)):
                raise ValueError('Hook extent mismatch: ' + name)
            add(name, offset, data, expected=bytes.fromhex(expected), intent='machine-code')

    if spec.get('party_and_cursor'):
        from src.menu_runtime import install
        availability = spec.get('combination_marker_availability',
                                'unlearned' if spec.get('field_discovery_corrections') else 'native')
        if availability not in ('native', 'unlearned'):
            raise ValueError('Unknown combination marker availability policy')
        install(add, machine, original, compact_panel=spec.get('compact_party_panel', False),
                pickup_markers=spec.get('field_pickup_markers', False),
                herb_markers=spec.get('herb_pickup_markers', False),
                combination_markers=spec.get('combination_pickup_markers', False),
                unlearned_combinations=availability == 'unlearned',
                event_ingredients=spec.get('event_ingredient_markers', False),
                event_discoveries=spec.get('event_discovery_markers', False),
                preserve_house_scores=spec.get('preserve_house_scores', False))

    if spec.get('field_discovery_corrections'):
        if not spec.get('combination_pickup_markers'):
            raise ValueError('Discovery corrections require combination markers')
        # Map 56's chair blocks the original 293,158 interaction rectangle.
        # Moving the invisible discovery actor 8px down lets its native box
        # meet Harry at the reachable south edge; map art/collision stay native.
        add('great-hall-combination-position', 0x28FFED,
            bytes.fromhex('0a192501a600'), expected=bytes.fromhex('0a1925019e00'))

    if spec.get('forest_pickup_positions'):
        for name, offset, before, after in CORRECTIONS:
            add(name, offset, bytes.fromhex(after), expected=bytes.fromhex(before))

    descriptors = bytearray()
    directory = bytearray(b'\xff' * (3063 * 3))
    cursor = 0x2A * 0x4000 + 1 if compact else 0x40C001
    layout = []; selected_glyphs = set()
    overrides = spec.get('text_overrides', {})
    use_source = set(spec.get('source_text_ids', []))
    if (overrides.keys() | use_source) - drafts.keys() or overrides.keys() & use_source:
        raise ValueError('Unknown or conflicting text correction')
    for e in catalog['entries']:
        source = bytes.fromhex(e['raw_hex'])
        if 1 in source:
            raise ValueError('Original code collides with escape')
        draft = drafts.get(e['id'])
        raw = source
        if draft:
            if draft['source'] != e['source_codes']:
                raise ValueError('Protected source changed')
            target = e['source_codes'] if e['id'] in use_source else overrides.get(e['id'], draft['translation'])
            if re.findall(r'@[1-9]', target) != re.findall(r'@[1-9]', e['source_codes']) or target.count('_') != e['source_codes'].count('_'):
                raise ValueError('Protected variable/paragraph token mismatch')
            if draft.get('preserve_source_blank'):
                if target != '' or source != b' ' or draft.get('state') != 'user-approved':
                    raise ValueError('Invalid approved blank preservation')
                raw = source
            else:
                raw = source if e['id'] in use_source else encode_text(target)
            if spec.get('folio_layout') and 1725 <= e['index'] <= 1826:
                # Detail and overview share a description. The detail renderer
                # consumes the native three-byte prefix before the body.
                if not source.startswith(b'  _') or not raw.lstrip(b' ').startswith(b'_'):
                    raise ValueError('Unexpected Folio Magi description header')
                raw = b'  ' + raw.lstrip(b' ')
            selected_glyphs |= {glyph_index(c) for c in target if '가' <= c <= '힣'}
        if not raw or len(raw) > 1024:
            raise ValueError('Decoded text overlaps the next declared buffer')
        if b'@' in raw and len(raw) + raw.count(b'@') * 14 > 1024:
            raise ValueError('Variable expansion exceeds declared output region')
        data = raw[:-1] + bytes([raw[-1] | 128])
        if cursor // 0x4000 != (cursor + len(data) - 1) // 0x4000:
            cursor = ((cursor + 0x3FFF) & ~0x3FFF) + 1
        bank, address = cursor // 0x4000, 0x4000 + cursor % 0x4000
        if not compact and not 0x103 <= bank < 0x200:
            raise ValueError('Raw bank range exhausted')
        at = e['index'] * 3
        directory[at:at + 3] = bytes([bank & 255]) + address.to_bytes(2, 'little')
        descriptors.extend(bytes([0]) + (0x4001 + at).to_bytes(2, 'little'))
        add('raw-' + e['id'], cursor, data)
        layout.append({'id': e['id'], 'offset': cursor, 'raw_hex': data.hex(), 'translated': bool(draft), 'length': len(data)})
        cursor += len(data)
    variable_bounds = []
    if deferred:
        # Deferred references can name any relocated entry. Use the largest
        # actual payload, not the old 16-byte slot size, as the expansion bound.
        longest_reference = max(e['length'] for e in layout)
        for entry in layout:
            count = bytes.fromhex(entry['raw_hex']).count(b'@')
            if not count:
                continue
            # The observed save-time caller formats three numeric slots.
            contracts = spec.get('numeric_variable_contracts', {})
            contract = contracts.get(entry['id'])
            if contract and (not contract.get('evidence') or contract.get('slot_bytes') != 16):
                raise ValueError('Invalid numeric variable contract')
            slot_bound = 16 if entry['id'] == 'hp1-en-us-2317' or contract else max(16, longest_reference)
            maximum = entry['length'] + count * (slot_bound - 2)
            if maximum > 1024:
                raise ValueError('Deferred variable output capacity unresolved: ' + entry['id'])
            variable_bounds.append({'id': entry['id'], 'max_slot_bytes': slot_bound,
                                    'max_output_bytes': maximum,
                                    'contract': contract if contract else ('observed-save-time-numeric-caller' if slot_bound == 16 else 'any-current-descriptor')})
    add('english-self-descriptors', 0x80001, bytes(descriptors))
    add('raw-directory' if compact else 'expanded-raw-directory', pool_start + 1 if compact else 0x400001, bytes(directory))
    if compact:
        for block, i in enumerate(range(0, len(font), 0x2000)):
            add(f'font-block-{block}', (0x27 + block) * 0x4000 + 0x2000, font[i:i + 0x2000])
    else:
        add('full-wansung-font', 0x404000, font)
        add('header-rom-size', 0x148, b'\x08', expected=b'\x07', intent='header')
    result = bytearray(baseline)
    for w in writes:
        result[w['offset']:w['offset'] + w['length']] = bytes.fromhex(w['replacement_hex'])
    header_sum = 0
    for value in result[0x134:0x14D]:
        header_sum = (header_sum - value - 1) & 255
    add('header-checksum', 0x14D, bytes([header_sum]), intent='checksum')
    result[0x14D] = header_sum
    global_sum = (sum(result[:0x14E]) + sum(result[0x150:])) & 65535
    add('global-checksum', 0x14E, global_sum.to_bytes(2, 'big'), intent='checksum')
    result[0x14E:0x150] = global_sum.to_bytes(2, 'big')
    covered = bytearray(len(result))
    for w in writes:
        covered[w['offset']:w['offset'] + w['length']] = b'\x01' * w['length']
    if any(a != b and not covered[i] for i, (a, b) in enumerate(zip(baseline, result))):
        raise ValueError('Unregistered final diff')
    # Original font and non-English descriptor/storage ranges must be intact.
    if result[0x2A5CAB:0x2A60AB] != original[0x2A5CAB:0x2A60AB] or (not compact and result[0x98000:0x400000] != original[0x98000:]):
        raise ValueError('Unrelated original data changed')
    layout_review = None
    if spec.get('memory_layout_review'):
        from src.memory_layout import check
        layout_review = check(original, result, writes, spec['memory_layout_review'])
    out = ROOT / f'out/runtime-{version}'; out.mkdir(parents=True, exist_ok=True)
    manifest = {'version': version, 'non_distribution': True, 'source_sha256': sha(original), 'output_sha256': sha(result),
                'output_sha1': hashlib.sha1(result).hexdigest(), 'output_bytes': len(result), 'font_sha256': sha(font),
                'entry_count': len(layout), 'translated_entries': len(drafts), 'selected_glyphs': sorted(selected_glyphs),
                'glyph_table_entries': 2350, 'module_hex': module.hex(), 'machine_records': machine_records,
                'layout': layout, 'writes': writes, 'draft_sha256': sha(draft_path.read_bytes()),
                'limitations': ['WRAM/cave ownership not established for whole game', 'Development translations', 'Remaining consumer/IRQ/variable verification']}
    if deferred:
        manifest['variable_output_bounds'] = variable_bounds
    if artifact.get('approved_tsv_sha256'):
        tsv = draft_path.parent / 'user-approved.tsv'
        if sha(tsv.read_bytes()) != artifact['approved_tsv_sha256'] or any(e['state'] != 'user-approved' for e in drafts.values()):
            raise ValueError('Approved input identity/state mismatch')
        manifest['approved_tsv_sha256'] = artifact['approved_tsv_sha256']
        manifest['approved_rows'] = len(drafts)
        manifest['preserved_blank_rows'] = sum(bool(e.get('preserve_source_blank')) for e in drafts.values())
        manifest['limitations'] = ['Approved prose preserved; gameplay QA pending',
                                  'Full-game WRAM/cave ownership unresolved',
                                  'Coordinate template2320 numeric contract has no established active caller',
                                  'Graphics text outside descriptor table not localized']
    if overrides or use_source:
        manifest['text_overrides'] = overrides
        manifest['source_text_ids'] = sorted(use_source)
    if layout_review:
        manifest['memory_layout_review'] = layout_review
    (out / f'hp1-korean-runtime-{version}.gbc').write_bytes(result)
    (out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: manifest[k] for k in ('output_sha256', 'entry_count', 'translated_entries', 'glyph_table_entries')}))


if __name__ == '__main__':
    main()
