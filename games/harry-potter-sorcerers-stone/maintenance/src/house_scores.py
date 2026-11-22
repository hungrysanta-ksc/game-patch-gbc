"""Preserve native score tables and migrate the exact v011..v025 corruption."""
from src.source import ROOT


def install(add, machine, original):
    def remote(name, address, text):
        add(name, 0x39 * 0x4000 + address - 0x4000,
            machine(name, text, address), intent='machine-code')

    def hook(name, offset, address, expected):
        body = machine(name, 'CALL $3A78', 0x4000 + offset % 0x4000)
        body += address.to_bytes(2, 'little')
        assert len(body) == len(bytes.fromhex(expected))
        add(name, offset, body, expected=bytes.fromhex(expected),
            intent='machine-code-and-inline-address')

    # Replace LDH A,[D5]; OR A; JR Z,54E7. The dispatch clobbers HL/DE,
    # which both native continuations overwrite before reading. Preserve BC.
    # A zero command skips 58FB; other commands retain the original path.
    hook('battle-command-confirm', 0xD4DD, 0x6E00, 'f0d5b72805')
    remote('remember-command', 0x6E00,
           'LD A,[$FFD5]\nLD [$CFF9],A\nOR A\nJR NZ,done\n'
           'POP HL\nLD HL,$54E7\nPUSH HL\ndone:\nJP $33EF')

    # Run only after SRAM checksums have been validated and SRAM disabled.
    # Reproduce LD A,[CE09]; BIT 0,A for the original post-load branch.
    hook('loaded-house-score-repair', 0x11898, 0x6E40, 'fa09cecb47')
    remote('repair-house-score', 0x6E40,
           (ROOT / 'src/runtime/repair_house_score.asm').read_text())

    # 03:7E5F..7E66 used to be overwritten by the cursor helper. Match only
    # its four exact little-endian words after subtracting personal points.
    damaged = bytes.fromhex('fad5ffeaf9cfb7c9')
    assert original[0xFE5F:0xFE67] == b'\xff' * 8
    chapter_bases = original[0xFE81:0xFE8D]
    assert chapter_bases.hex() == '79008c00b000c800eb000601'
    add('damaged-house-score-signatures', 0x39 * 0x4000 + 0x2F00, damaged)
    add('native-chapter-house-scores', 0x39 * 0x4000 + 0x2F08, chapter_bases)
