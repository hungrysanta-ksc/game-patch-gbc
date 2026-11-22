"""Controlled CPU evidence: native score calculation and exact save migration.

The ROM files are immutable; only the emulator's fixed-ROM harness is replaced.
This complements (and does not replace) the cold-boot controller replays.
"""
import io
import json
import sys
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pyboy import PyBoy
from src.sm83_poc_assembler import assemble
from src.source import read_source

WORK = ROOT / 'work/runtime-v026'


class Probe:
    def __init__(self, path):
        self.p = PyBoy(str(path), window='null', sound_emulated=False, ram_file=io.BytesIO(bytes(8192)))
        self.p.set_emulation_speed(0)
        self.p.tick(120, False)
        self.m = self.p.memory
        self.m[0xffff] = self.m[0xff0f] = 0
        self.m[0xff50] = 1
        self.m[0x3000] = 0
        self.m[0, 0x3b80:0x3b83] = [0xc3, 0x80, 0x3b]
        self.p.hook_register(0, 0x3b70, self.finish, None)

    def finish(self, _):
        self.result = (self.p.register_file.SP, self.p.register_file.A,
                       self.p.register_file.F, self.m[0xff70])
        self.p.register_file.PC = 0x3b80

    def invoke(self, body, expected_sp=0xcff0):
        self.result = None
        code = assemble('DI\n' + body + '\nJP $3B70', origin=0x3b00)
        assert len(code) < 0x70
        self.m[0, 0x3b00:0x3b00 + len(code)] = list(code)
        self.p.register_file.SP = 0xcff0
        self.p.register_file.PC = 0x3b00
        for _ in range(30):
            self.p.tick(1, False)
            if self.result:
                break
        assert self.result and self.result[0] == expected_sp, self.result
        return self.result

    def word(self, address, value=None):
        if value is not None:
            self.m[6, address:address + 2] = list((value & 65535).to_bytes(2, 'little'))
        return self.m[6, address] + 256 * self.m[6, address + 1]

    def ram6(self):
        return bytes(self.m[6, 0xd000:0xdfff]) + bytes([self.m[6, 0xdfff]])


def main():
    original, _ = read_source()
    paths = {'original': next((ROOT / 'roms').glob('*.gbc'))}
    paths.update({v: ROOT / f'out/runtime-v{v}/hp1-korean-runtime-v{v}.gbc' for v in ('025', '026')})
    probes = {v: Probe(path) for v, path in paths.items()}
    fixed = paths['026'].read_bytes()
    assert fixed[0xfe51:0xfe8d] == original[0xfe51:0xfe8d]
    records = []
    # Entire 24-word primary table, six secondary rows, positive/negative totals.
    for stage in range(24):
        for chapter in range(6):
            for personal in (-2, 3):
                values = {}
                for version, q in probes.items():
                    q.word(0xd5c8, 777)
                    q.word(0xd5d0, personal)
                    q.m[6, 0xd60a] = chapter
                    q.m[0xff70] = 2
                    q.invoke(f'LD A,$03\nLD [$2000],A\nLD D,${stage:02X}\nCALL $7E8D')
                    values[version] = q.word(0xd5c8)
                    assert q.m[0xff70] == 2
                assert values['026'] == values['original'], (stage, chapter, personal, values)
                records.append(dict(stage=stage, chapter=chapter, personal=personal, values=values))
    q = probes['026']
    migration = []
    damaged = [54778, 60159, 53241, 51639]
    ordinary = [0, 73, 108, 121, 140, 176, 200, 235, 262, 500, 60000, 65535]
    bases = [121, 140, 176, 200, 235, 262]
    for base in damaged + ordinary:
        for chapter in list(range(7)) + [255]:
            for personal in (-170, -2, 0, 3, 100, 500):
                for bank in (1, 7):
                    q.word(0xd5c8, base + personal)
                    q.word(0xd5d0, personal)
                    q.m[6, 0xd60a] = chapter
                    q.m[0xff70] = bank
                    q.m[0xce09] = chapter
                    before = q.ram6()
                    _, a, flags, final_bank = q.invoke('LD A,$39\nLD [$2000],A\nCALL $6E40')
                    expected = ((bases[chapter] if base in damaged and chapter < 6 else base) + personal) & 65535
                    after = bytearray(before)
                    after[0x5c8:0x5ca] = expected.to_bytes(2, 'little')
                    assert q.ram6() == after, (base, chapter, personal, bank)
                    assert final_bank == bank and a == chapter and bool(flags & 0x80) == (chapter % 2 == 0)
                    migration.append(dict(base=base, chapter=chapter, personal=personal, bank=bank, result=expected))
    commands = []
    for version in ('025', '026'):
        q = probes[version]
        q.p.hook_register(3, 0x54e7, q.finish, None)
        for row in range(4):
            q.m[0xffd5] = row
            q.m[0xcff9] = 0xff
            q.m[0xcbe4] = 7
            result = q.invoke('LD A,$03\nLD [$2000],A\nCALL $54DD', expected_sp=0xcfee)
            assert result[1] == row and q.m[0xcff9] == row
            assert q.m[0xcbe4] == (7 if row == 0 else 0)
            commands.append(dict(version=version, row=row, sp=result[0], remembered=q.m[0xcff9], actors=q.m[0xcbe4]))
    for q in probes.values():
        q.p.stop(save=False)
    report = dict(scope='Controlled CPU calls, not natural story progression',
                  interventions='In-memory fixed ROM harness 3B00/3B70/3B80; IRQ disabled; SP=CFF0; explicit WRAM score inputs',
                  rom_sha256={v: sha256(path.read_bytes()).hexdigest() for v, path in paths.items()},
                  native_calculation=records, migration=migration, command_continuations=commands)
    (WORK / 'controlled-scores.json').write_text(json.dumps(report, indent=2) + '\n')
    print(dict(native_cases=len(records), migration_cases=len(migration), command_cases=len(commands),
               prior_mismatches=sum(x['values']['025'] != x['values']['original'] for x in records),
               report=str(WORK / 'controlled-scores.json')))


if __name__ == '__main__':
    main()
