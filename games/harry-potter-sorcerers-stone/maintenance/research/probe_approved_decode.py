"""Controlled CPU decode of every approved descriptor and numeric templates.

This is not natural scene reachability or visual QA.
"""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pyboy import PyBoy
from src.sm83_poc_assembler import assemble

version = sys.argv[1] if len(sys.argv) == 2 else 'v008'
rom_path = ROOT / f'out/runtime-{version}/hp1-korean-runtime-{version}.gbc'
manifest = json.loads((rom_path.parent / 'manifest.json').read_text(encoding='utf-8'))
p = PyBoy(str(rom_path), window='null', sound_emulated=False)
p.set_emulation_speed(0)
p.tick(120, False)
p.memory[0xffff] = 0
p.memory[0xff0f] = 0
p.memory[0xff50] = 1
p.memory[0x3000] = 0
p.memory[0x2000] = 1
p.memory[0xff70] = 7
p.memory[0xcddc] = 0x20
p.memory[0, 0x3b80:0x3b83] = [0xc3, 0x80, 0x3b]
done = []


def finish(_):
    done.append(True)
    p.register_file.PC = 0x3b80


p.hook_register(0, 0x3b70, finish, None)


def invoke(body):
    done.clear()
    code = assemble('DI\n' + body + '\nJP $3B70', origin=0x3b00)
    assert len(code) < 0x70
    p.memory[0, 0x3b00:0x3b00 + len(code)] = list(code)
    p.register_file.SP = 0xcff0
    p.register_file.PC = 0x3b00
    for _ in range(30):
        p.tick(1, False)
        if done: break
    assert done, 'Routine failed to return'


invoke('CALL $67F5\nCALL $360F')
module = bytes.fromhex(manifest['module_hex'])[32:]
for entry in manifest['layout']:
    index = int(entry['id'].split('-')[-1])
    raw = bytes.fromhex(entry['raw_hex'])
    p.memory[0xd400:0xd800] = [0x55] * 1024
    invoke(f'LD HL,${index * 3 + 1:04X}\nLD DE,$D400\nCALL $3630')
    assert bytes(p.memory[0xd400:0xd400 + len(raw)]) == raw, entry['id']
    assert bytes(p.memory[0xd400 + len(raw):0xd800]) == b'\x55' * (1024 - len(raw)), 'Decode overrun'
    assert bytes(p.memory[0xdda0:0xe000]) == module, 'Runtime corruption'
numeric = []
for index in (7, 8, 1400, 2317, 2320, 2394):
    entry = manifest['layout'][index]
    p.memory[0xc23a:0xc27a] = [0x55] * 64
    invoke(f'LD HL,$FFFF\nCALL $6F1C\nLD HL,$FFFF\nCALL $6F22\nLD HL,$FFFF\nCALL $6F28\nLD HL,${index * 3 + 1:04X}\nCALL $3071')
    raw = bytearray.fromhex(entry['raw_hex'])
    slots = []
    for offset in (0xc23a, 0xc24a, 0xc25a):
        value = bytearray(p.memory[offset:offset + 16])
        end = next(i for i,b in enumerate(value) if b & 128)
        value = value[:end + 1]; value[-1] &= 127
        slots.append(bytes(value))
    for i,value in enumerate(slots,1):raw = raw.replace(f'@{i}'.encode(), value)
    assert bytes(p.memory[0xd400:0xd400 + len(raw)]) == raw
    assert bytes(p.memory[0xdda0:0xe000]) == module
    numeric.append({'index': index, 'slot_values': [v.decode('ascii') for v in slots], 'output_bytes': len(raw)})
p.stop(save=False)
report = {'rom_sha256': hashlib.sha256(rom_path.read_bytes()).hexdigest(), 'direct_entries': 3063,
          'longest_bytes': max(e['length'] for e in manifest['layout']), 'numeric_cases': numeric,
          'scope': 'Controlled real CPU calls, not full scene playback',
          'interventions': 'ROM-memory harness3B00, completion hook3B70, idle3B80; bank1/WRAM7/US20; SP=CFF0, IRQ disabled; D400 canary55',
          'limits': ['Coordinate template2320 active caller unresolved', 'No screen layout proof from decoder calls']}
(ROOT / f'work/runtime-{version}-cpu-decode-verification.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report))
