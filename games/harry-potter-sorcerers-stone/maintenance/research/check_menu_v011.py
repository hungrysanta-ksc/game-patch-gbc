"""Check the exact ROM, cursor pixels, WRAM, and SRAM from both v011 replays."""
import json
import sys
from hashlib import sha256
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.hangul_encoding import encode_text
from src.source import read_source

WORK = ROOT / 'work/runtime-v011'


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def digest(data):
    return sha256(data).hexdigest()


def check_core(core, rom_hash, original_save):
    def directory(route):
        return WORK / f'v011-{route}-{core}'

    def capture(route, frame, ext):
        return directory(route) / f'{frame:04}.{ext}'

    def slots(route, frame):
        return capture(route, frame, 'ram').read_bytes()[0xFF8:0xFFF]

    def frame_image(route, frame):
        return Image.open(capture(route, frame, 'png'))

    # Both cores draw the root/spell/item cursor with 12 light pixels.
    for route, frame, y, row in [
        ('menu', 3800, 32, 0), ('menu', 5700, 32, 3),
        ('menu-disabled', 5700, 32, 0), ('battle-long', 7210, 112, 1),
        ('spell-disabled', 7210, 112, 0), ('battle-long', 7990, 112, 1),
        ('battle-items', 7050, 112, 1), ('battle-items', 7980, 112, 0)
    ]:
        image = frame_image(route, frame)
        for k in range(4):
            count = sum(min(image.getpixel((x, y + 8*k + dy))) > 155
                        for x in range(7) for dy in range(7))
            assert count == (12 if k == row else 0), (core, route, frame, k)

    assert slots('items', 5600)[3] == 0x3B
    assert slots('items-disabled', 5600)[3] == 0
    assert slots('battle-long', 7210)[5:] == bytes([0x25, 0])
    assert slots('spell-disabled', 7210)[5:] == bytes(2)
    assert slots('battle-items', 7050)[4] == 0x2C
    assert slots('battle-items', 7980)[4] == 0
    assert slots('item-command-disabled', 7050)[1:5] == bytes(4)
    assert slots('battle-card', 7820)[:2] == bytes([0x14, 1])
    assert slots('card-disabled', 7820)[:2] == bytes([0, 1])
    assert slots('card-command-disabled', 7820)[:2] == bytes(2)
    for route, counts in [('battle-card', (473, 313)), ('card-disabled', (313, 473))]:
        image = frame_image(route, 7820)
        for y, most_common in zip((18, 58), counts):
            colors = image.crop((130, y, 157, y + 27)).getcolors()
            assert max(n for n, color in colors) == most_common

    saved = capture('save-reset', 4750, 'sram').read_bytes()
    assert saved != original_save and capture('save-reset', 9300, 'sram').read_bytes() == saved
    assert slots('save-reset', 4750)[2] == 5 and slots('save-reset', 9300) == bytes(7)
    previous = ROOT / f'work/runtime-v010/v010-protection-{core}'
    for frame in (5200, 5500):
        diff = ImageChops.difference(Image.open(previous / f'{frame}.png'), frame_image('protection', frame))
        assert diff.getbbox() is None
    diff = ImageChops.difference(Image.open(previous / '4250.png'), frame_image('menu', 4250))
    assert diff.getbbox() == (64, 32, 160, 56)

    routes = ('menu items menu-disabled items-disabled panel-values battle-cursor battle-long '
              'battle-card battle-items spell-disabled card-disabled card-command-disabled '
              'item-command-disabled protection title-empty title-save save-reset').split()
    watermarks = []
    for route in routes:
        trace = read_json(directory(route) / 'trace.json')
        assert trace['rom_sha256'] == rom_hash
        for entry in trace['frames']:
            frame = entry['frame']
            ram = capture(route, frame, 'ram').read_bytes()
            marker = ram[0xF80:0xFF0]
            watermarks.append(len(marker) - len(marker.lstrip(bytes([0x69]))))
            if route in ('menu', 'items', 'panel-values') and frame >= 3800:
                assert ram[0x7FD0:0x8000] == bytes(48)
    assert min(watermarks) > 0, (core, min(watermarks))
    return dict(routes=routes, min_unused_stack_marker_in_captures=min(watermarks),
                saved_then_reloaded_sha256=digest(saved))


def main():
    original, profile = read_source()
    old = read_json(ROOT / 'out/runtime-v010/manifest.json')
    new = read_json(ROOT / 'out/runtime-v011/manifest.json')
    rom = (ROOT / 'out/runtime-v011/hp1-korean-runtime-v011.gbc').read_bytes()
    prior = (ROOT / 'out/runtime-v010/hp1-korean-runtime-v010.gbc').read_bytes()
    assert digest(rom) == new['output_sha256']
    assert digest(prior) == old['output_sha256'] == '2f4b23e675e8a1d5ed3b57f4ea24968e1ca615c515aae887d9d71de0e39ba4e9'
    assert len(old['layout']) == len(new['layout']) == 3063
    changed = [i for i, (x, y) in enumerate(zip(old['layout'], new['layout'])) if x['raw_hex'] != y['raw_hex']]
    assert changed == [350, 390, 410, 438, 453]
    for i in changed:
        entry = new['layout'][i]
        raw = bytearray(encode_text(new['text_overrides'][entry['id']]))
        raw[-1] |= 128
        assert raw.hex() == entry['raw_hex']
        assert rom[entry['offset']:entry['offset'] + len(raw)] == raw
    for offset in (0x15A, 0x163):
        assert original[offset:offset + 3] == bytes.fromhex('31ffcf')
        assert rom[offset:offset + 3] == bytes.fromhex('31f8cf')

    source_save = Path(read_json(WORK / 'menu.json')['initial_sram']).read_bytes()
    assert digest(source_save) == 'daafe23b9365ced9e61a81fbff698ca1a15460e307a28d3859757691cbdd747d'
    report = dict(rom_sha256=digest(rom), source_sha256=profile['sha256'], prior_rom_sha256=digest(prior),
                  changed_descriptors=changed, original_save_sha256=digest(source_save))
    report['cores'] = {core: check_core(core, digest(rom), source_save) for core in ('gambatte', 'vbam')}
    (WORK / 'verified.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
