"""Controlled CPU-routine test; this is NOT a gameplay reachability test.

Overrides a small ROM window in emulator memory, disables IRQs, sets bank/stack,
and calls real metric initialization, descriptor-slot writer and @ substitution.
No input ROM file is modified; overrides and register/RAM setup are recorded.
"""
import argparse
import importlib.metadata
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pyboy import PyBoy
import pyboy.pyboy as pyboy_core
from src.sm83_poc_assembler import assemble, decode_machine, reassemble_decoded


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('rom', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--language', type=lambda x: int(x, 0), default=0x20)
    args = parser.parse_args()
    rom = args.rom.read_bytes()
    cases = []
    for entry in (2329, 2340, 2346, 2349):
        p = PyBoy(str(args.rom), window='null', sound_emulated=False)
        p.set_emulation_speed(0)
        p.tick(120, False)
        p.memory[0xffff] = 0
        p.memory[0xff0f] = 0
        p.memory[0xff50] = 1
        p.memory[0x3000] = 0
        p.memory[0x2000] = 1
        p.memory[0xff70] = 7
        p.memory[0xcddc] = args.language
        p.memory[0xc23a:0xc27a] = [0x55] * 64
        text = f'''DI
    CALL $67F5
    CALL $360F
    LD A,$01
    LD [$2000],A
    LD BC,$1234
    LD HL,${entry * 3 + 1:04X}
    CALL $6F3D
    LD HL,${2323 * 3 + 1:04X}
    CALL $3071
finish:
    JP finish
'''
        code = assemble(text, origin=0x3b00)
        if reassemble_decoded(decode_machine(code, origin=0x3b00), origin=0x3b00) != code:
            raise ValueError('Harness assembly roundtrip')
        p.memory[0, 0x3b00:0x3b00 + len(code)] = list(code)
        p.memory[0, 0x3b80:0x3b83] = [0xc3, 0x80, 0x3b]
        result = {}

        def finish(_):
            p.register_file.PC = 0x3b80
            if result:
                return
            result.update({'slots_hex': bytes(p.memory[0xc23a:0xc27a]).hex(),
                           'output_hex': bytes(p.memory[0xd400:0xd500]).hex(),
                           'template_hex': bytes(p.memory[0xd800:0xd840]).hex(),
                           'module_hex': bytes(p.memory[0xdda0:0xe000]).hex(),
                           'bc': (p.register_file.B << 8) | p.register_file.C,
                           'sp': p.register_file.SP})

        p.hook_register(0, 0x3b00 + len(code) - 3, finish, None)
        p.register_file.SP = 0xcff0
        p.register_file.B = 0x12
        p.register_file.C = 0x34
        p.register_file.PC = 0x3b00
        for _ in range(20):
            p.tick(1, False)
            if result:
                break
        cases.append({'entry': entry, 'completed': bool(result), 'harness_hex': code.hex(), **result})
        p.stop(save=False)
    report = {'rom_sha256': hashlib.sha256(rom).hexdigest(), 'language_bank': args.language,
              'pyboy_version': importlib.metadata.version('pyboy'),
              'pyboy_core_sha256': hashlib.sha256(Path(pyboy_core.__file__).read_bytes()).hexdigest(),
              'scope': 'Controlled SM83 function invocation; no natural recipe-menu reachability claim',
              'interventions': {'rom_override_address': 0x3b00, 'idle_override': {'address': 0x3b80, 'hex': 'c3803b'},
                                'irq_enable': 0, 'rom_bank': 1, 'boot_rom_disabled': True,
                                'wram_bank': 7, 'stack': 0xcff0, 'bc': 0x1234, 'canary_region': 'C23A:C27A = 55'},
              'cases': cases}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'rom_sha256': report['rom_sha256'], 'cases': [{'entry': c['entry'], 'completed': c['completed'], 'slot_prefix': c.get('slots_hex', '')[:32], 'output_prefix': c.get('output_hex', '')[:100]} for c in cases]}))


if __name__ == '__main__':
    main()
