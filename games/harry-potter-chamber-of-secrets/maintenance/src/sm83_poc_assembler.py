"""Narrow, deterministic SM83 assembler for declared patch PoC instruction forms.

This is deliberately not a general assembler.  It rejects any instruction that
is not part of the declared POC ISA subset, so a later hook cannot silently
turn opaque raw bytes into a machine-code write.
"""

from __future__ import annotations

import re


class AssemblyError(ValueError):
    pass


_FIXED = {
    "JP HL": b"\xE9",
    "ADD A,[HL]": b"\x86",
    "CP C": b"\xB9",
    "SUB [HL]": b"\x96",
    "CPL": b"\x2F",
    "RLA": b"\x17",
    "RST $08": b"\xCF",
    "ADD A,E": b"\x83",
    "NOP": b"\x00",
    "PUSH BC": b"\xC5",
    "PUSH DE": b"\xD5",
    "PUSH HL": b"\xE5",
    "PUSH AF": b"\xF5",
    "POP BC": b"\xC1",
    "POP DE": b"\xD1",
    "POP HL": b"\xE1",
    "POP AF": b"\xF1",
    "RET": b"\xC9",
    "RET NZ": b"\xC0",
    "RET Z": b"\xC8",
    "RET C": b"\xD8",
    "DI": b"\xF3",
    "EI": b"\xFB",
    "LD A,[HL+]": b"\x2A",
    "LD A,[HL]": b"\x7E",
    "LD A,[BC]": b"\x0A",
    "LD A,[DE]": b"\x1A",
    "LD A,H": b"\x7C",
    "LD A,L": b"\x7D",
    "LD A,B": b"\x78",
    "LD A,C": b"\x79",
    "LD A,D": b"\x7A",
    "LD A,E": b"\x7B",
    "LD H,A": b"\x67",
    "LD L,A": b"\x6F",
    "LD C,A": b"\x4F",
    "LD D,H": b"\x54",
    "LD E,L": b"\x5D",
    "LD D,A": b"\x57",
    "LD E,A": b"\x5F",
    "LD B,A": b"\x47",
    "LD [DE],A": b"\x12",
    "LD [BC],A": b"\x02",
    "LD [HL+],A": b"\x22",
    "LD [HL-],A": b"\x32",
    "LD [HL],A": b"\x77",
    "RRCA": b"\x0F",
    "RLCA": b"\x07",
    "SRL A": b"\xCB\x3F",
    "INC BC": b"\x03",
    "INC DE": b"\x13",
    "INC HL": b"\x23",
    "INC A": b"\x3C",
    "DEC HL": b"\x2B",
    "DEC [HL]": b"\x35",
    "ADD HL,DE": b"\x19",
    "ADD HL,HL": b"\x29",
    "DEC B": b"\x05",
    "DEC C": b"\x0D",
    "DEC A": b"\x3D",
    "OR [HL]": b"\xB6",
    "OR A": b"\xB7",
    "CP D": b"\xBA",
    "CP E": b"\xBB",
    "XOR A": b"\xAF",
}
# Menu tile compositor: additional one-byte SM83 register operations.
_FIXED.update({name: bytes([op]) for name,op in {
    "AND D":0xa2,"OR E":0xb3,"LD C,A":0x4f,"LD C,L":0x4d,"LD B,H":0x44,"LD B,[HL]":0x46,"LD C,[HL]":0x4e,
    "LD H,[HL]":0x66,"LD L,A":0x6f,"LD H,B":0x60,"LD L,C":0x69,"LD L,E":0x6b,
    "LD H,D":0x62,"LD D,[HL]":0x56,"LD E,[HL]":0x5e,"LD [HL],B":0x70,
    "LD A,[HL-]":0x3a,"LD [HL],C":0x71,"DEC DE":0x1b,"INC B":0x04,"INC C":0x0c,
    "INC L":0x2c,"ADD HL,BC":0x09,"ADD A,A":0x87,"ADD A,B":0x80,"ADD A,C":0x81,
    "OR L":0xb5,"OR C":0xb1,"CP B":0xb8,"SUB C":0x91,"SBC A,B":0x98,
}.items()})
# Game-native inline far-call descriptor: a single ABI operation, not free-form data.
_FIXED["MENU FARCALL $37:$4100"] = bytes.fromhex("cd f3 33 37 00 41")
_IMM8 = {"LD H":0x26,"LD C":0x0e,"LD D":0x16,"ADD A": 0xC6, "OR A": 0xF6, "LD E": 0x1E, "AND A": 0xE6, "CP A": 0xFE, "LD B": 0x06, "LD A": 0x3E, "SUB A": 0xD6, "SBC A": 0xDE}
_IMM16 = {"LD SP":0x31,"LD BC":0x01,"LD A,[": 0xFA, "LD HL": 0x21, "LD DE": 0x11, "LD [": 0xEA, "CALL": 0xCD}


def _clean_lines(source: str) -> list[str]:
    return [line.split(";", 1)[0].strip() for line in source.splitlines() if line.split(";", 1)[0].strip()]


def _number(token: str, labels: dict[str, int]) -> int:
    if token in labels:
        return labels[token]
    if token.startswith("$"):
        return int(token[1:], 16)
    raise AssemblyError(f"unsupported immediate {token!r}")


def _size(line: str) -> int:
    if line.endswith(":"):
        return 0
    if line.startswith("DB "):
        return len(line[3:].split(","))
    if (line.startswith("JR NZ,") or line.startswith("JR Z,") or
            line.startswith("JR NC,") or line.startswith("JR C,")):
        return 2
    if line.startswith("JR "):
        return 2
    if line in _FIXED:
        return len(_FIXED[line])
    if line.startswith("CALL "):
        return 3
    if line.startswith("JP NZ,") or line.startswith("JP Z,"):
        return 3
    if line.startswith("JP "):
        return 3
    if line.startswith("LD A,[") or line.startswith("LD ["):
        return 3
    if any(line.startswith(prefix + ",") for prefix in _IMM8):
        return 2
    if any(line.startswith(prefix + ",") for prefix in _IMM16 if not prefix.endswith("[")):
        return 3
    raise AssemblyError(f"unsupported instruction {line!r}")


def assemble(source: str, *, origin: int) -> bytes:
    """Assemble the declared subset, resolving labels in a strict two-pass flow."""
    lines = _clean_lines(source)
    labels: dict[str, int] = {}
    cursor = origin
    for line in lines:
        if line.endswith(":"):
            label = line[:-1]
            if label in labels:
                raise AssemblyError(f"duplicate label {label}")
            labels[label] = cursor
        else:
            cursor += _size(line)

    output = bytearray()
    cursor = origin
    for line in lines:
        if line.endswith(":"):
            continue
        if line.startswith("DB "):
            data = bytes(_number(token.strip(), labels) for token in line[3:].split(","))
        elif (line.startswith("JR NZ,") or line.startswith("JR Z,") or
              line.startswith("JR NC,") or line.startswith("JR C,") or line.startswith("JR ")):
            target_token = line.split(",", 1)[1].strip() if "," in line else line[len("JR "):].strip()
            target = _number(target_token, labels)
            delta = target - (cursor + 2)
            if not -128 <= delta <= 127:
                raise AssemblyError(f"JR target out of range: {target:#x}")
            opcode = (0x20 if line.startswith("JR NZ,") else
                      0x28 if line.startswith("JR Z,") else
                      0x30 if line.startswith("JR NC,") else
                      0x38 if line.startswith("JR C,") else 0x18)
            data = bytes((opcode, delta & 0xFF))
        elif line in _FIXED:
            data = _FIXED[line]
        elif line.startswith("CALL "):
            value = _number(line[len("CALL "):], labels)
            if not 0 <= value <= 0xFFFF:
                raise AssemblyError("16-bit immediate out of range")
            data = bytes((_IMM16["CALL"], value & 0xFF, value >> 8))
        elif line.startswith("JP NZ,") or line.startswith("JP Z,"):
            target = _number(line.split(",", 1)[1].strip(), labels)
            if not 0 <= target <= 0xFFFF:
                raise AssemblyError("16-bit immediate out of range")
            opcode = 0xC2 if line.startswith("JP NZ,") else 0xCA
            data = bytes((opcode, target & 0xFF, target >> 8))
        elif line.startswith("JP "):
            value = _number(line[len("JP "):], labels)
            if not 0 <= value <= 0xFFFF:
                raise AssemblyError("16-bit immediate out of range")
            data = bytes((0xC3, value & 0xFF, value >> 8))
        else:
            prefix, token = line.split(",", 1)
            token = token.strip()
            if line.startswith("LD A,[") and line.endswith("]"):
                value = _number(line[len("LD A,["):-1], labels)
                if not 0 <= value <= 0xFFFF:
                    raise AssemblyError("16-bit immediate out of range")
                data = bytes((_IMM16["LD A,["], value & 0xFF, value >> 8))
            elif line.startswith("LD [") and line.endswith("],A"):
                value = _number(line[len("LD ["):-3], labels)
                if not 0 <= value <= 0xFFFF:
                    raise AssemblyError("16-bit immediate out of range")
                data = bytes((_IMM16["LD ["], value & 0xFF, value >> 8))
            elif prefix in _IMM8:
                value = _number(token, labels)
                if not 0 <= value <= 0xFF:
                    raise AssemblyError("8-bit immediate out of range")
                data = bytes((_IMM8[prefix], value))
            elif prefix in _IMM16:
                value = _number(token, labels)
                if not 0 <= value <= 0xFFFF:
                    raise AssemblyError("16-bit immediate out of range")
                data = bytes((_IMM16[prefix], value & 0xFF, value >> 8))
            else:
                raise AssemblyError(f"unsupported instruction {line!r}")
        output.extend(data)
        cursor += len(data)
    return bytes(output)


def source_without_comments(source: str) -> str:
    """Return canonical source lines used as assembly provenance."""
    return "\n".join(_clean_lines(source)) + "\n"


def decode_machine(code: bytes, *, origin: int) -> tuple[tuple[str, int | None], ...]:
    """Decode the declared machine-code subset without treating data as code."""
    cursor = 0
    result: list[tuple[str, int | None]] = []
    fixed_decode = {value[0]: key for key, value in _FIXED.items() if len(value)==1}
    while cursor < len(code):
        opcode = code[cursor]
        address = origin + cursor
        if code[cursor:cursor+6] == _FIXED["MENU FARCALL $37:$4100"]:
            result.append(("MENU FARCALL $37:$4100", None)); cursor += 6
        elif opcode == 0xCB and cursor + 1 < len(code) and code[cursor + 1] == 0x3F:
            result.append(("SRL A", None))
            cursor += 2
        elif opcode in fixed_decode:
            result.append((fixed_decode[opcode], None))
            cursor += 1
        elif opcode in (0x18, 0x20, 0x28, 0x30, 0x38):
            if cursor + 1 >= len(code):
                raise AssemblyError("truncated JR")
            delta = code[cursor + 1]
            delta -= 0x100 if delta & 0x80 else 0
            result.append(({0x18: "JR", 0x20: "JR NZ", 0x28: "JR Z", 0x30: "JR NC", 0x38: "JR C"}[opcode], address + 2 + delta))
            cursor += 2
        elif opcode in _IMM8.values():
            if cursor + 1 >= len(code):
                raise AssemblyError("truncated 8-bit immediate")
            name = {value:key for key,value in _IMM8.items()}[opcode]
            result.append((name, code[cursor + 1]))
            cursor += 2
        elif opcode in (0x31, 0x01, 0xFA, 0xEA, 0x21, 0x11, 0xCD, 0xC3, 0xC2, 0xCA):
            if cursor + 2 >= len(code):
                raise AssemblyError("truncated 16-bit immediate")
            name = {0x31: "LD SP", 0x01: "LD BC", 0xFA: "LD A,[", 0xEA: "LD [", 0x21: "LD HL", 0x11: "LD DE", 0xCD: "CALL", 0xC3: "JP", 0xC2: "JP NZ", 0xCA: "JP Z"}[opcode]
            result.append((name, code[cursor + 1] | (code[cursor + 2] << 8)))
            cursor += 3
        else:
            raise AssemblyError(f"unsupported opcode {opcode:#04x} at {address:#06x}")
    return tuple(result)


def reassemble_decoded(decoded: tuple[tuple[str, int | None], ...], *, origin: int) -> bytes:
    """Reassemble a contiguous decode, proving the decoded instruction bytes."""
    output = bytearray()
    for mnemonic, operand in decoded:
        address = origin + len(output)
        if mnemonic in _FIXED and operand is None:
            output.extend(_FIXED[mnemonic])
        elif mnemonic in ("JR", "JR NZ", "JR Z", "JR NC", "JR C"):
            if operand is None:
                raise AssemblyError("JR target missing")
            delta = operand - (address + 2)
            if not -128 <= delta <= 127:
                raise AssemblyError("decoded JR target out of range")
            output.extend(({"JR": 0x18, "JR NZ": 0x20, "JR Z": 0x28, "JR NC": 0x30, "JR C": 0x38}[mnemonic], delta & 0xFF))
        elif mnemonic in _IMM8:
            if operand is None or not 0 <= operand <= 0xFF:
                raise AssemblyError("decoded 8-bit immediate invalid")
            output.extend((_IMM8[mnemonic], operand))
        elif mnemonic in _IMM16:
            if operand is None or not 0 <= operand <= 0xFFFF:
                raise AssemblyError("decoded 16-bit immediate invalid")
            output.extend((_IMM16[mnemonic], operand & 0xFF, operand >> 8))
        elif mnemonic in ("JP NZ", "JP Z"):
            if operand is None or not 0 <= operand <= 0xFFFF:
                raise AssemblyError("decoded conditional JP immediate invalid")
            output.extend(({"JP NZ": 0xC2, "JP Z": 0xCA}[mnemonic], operand & 0xFF, operand >> 8))
        elif mnemonic == "JP":
            if operand is None or not 0 <= operand <= 0xFFFF:
                raise AssemblyError("decoded JP immediate invalid")
            output.extend((0xC3, operand & 0xFF, operand >> 8))
        else:
            raise AssemblyError(f"unsupported decoded instruction {mnemonic!r}")
    return bytes(output)
