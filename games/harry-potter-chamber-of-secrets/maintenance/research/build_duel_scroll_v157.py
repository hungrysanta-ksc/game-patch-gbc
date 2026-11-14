"""Reserve six fixed-WRAM bytes above the stack for per-character battle cursors."""
from pathlib import Path
from hashlib import sha256
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.sm83_poc_assembler import assemble, decode_machine, reassemble_decoded

DIGESTS = {
    'debug': 'f728e5ac6a87f478e03d7cb5ebee19a6273d0f4bd516dec7194739cd30a25cf3',
    'normal': 'cf197c208f31dcc755b4b03771cb2630454a6a9c204a534c2959ce815b1fde31',
}

def build(mode):
    path = next(Path('out/internal-v156').glob(f'*{mode}*.gbc'))
    source = path.read_bytes()
    assert sha256(source).hexdigest() == DIGESTS[mode]
    rom = bytearray(source)
    # A push first decrements SP. Reserve CFF9..CFFE at both stack initializers.
    # Move initialization, reads and writes together, leaving D096..D09B to the raster effect.
    groups = [
        ([0x163, 0x16c], 'LD SP,$CFFF', 'LD SP,$CFF9'),
        ([0x1588d1, 0x15890c, 0x158941], 'LD HL,$D096', 'LD HL,$CFF9'),
        ([0x158d17, 0x158d69], 'LD HL,$D099', 'LD HL,$CFFC'),
    ]
    for offsets, old, new in groups:
        data = assemble(new, origin=0)
        assert reassemble_decoded(decode_machine(data, origin=0), origin=0) == data
        for at in offsets:
            assert rom[at:at+len(data)] == assemble(old, origin=0)
            rom[at:at+len(data)] = data
    rom[334:336] = bytes(2)
    rom[334:336] = (sum(rom) & 65535).to_bytes(2,'big')
    return path.name.replace('156','157'), rom

if __name__ == '__main__':
    files = [build(mode) for mode in DIGESTS]
    folder = Path('out/internal-v157')
    folder.mkdir(exist_ok=True)
    for name, rom in files:
        (folder/name).write_bytes(rom)
