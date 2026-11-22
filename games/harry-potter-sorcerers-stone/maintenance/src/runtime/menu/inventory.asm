; Shared by field and battle. The entry stubs supply HL = scroll offset,
; DE = private item byte (id+1). Return row in FFD5; WRAM bank 6 is active.
    LD A,[DE]
    OR A
    JR Z,missing
    DEC A
    LD C,A
    PUSH HL
    LD HL,$D10C
    LD A,[$D108]
    LD B,A
scan:
    LD A,B
    OR A
    JR Z,absent
    LD A,[HL]
    CP C
    JR Z,found
    INC HL
    INC HL
    INC HL
    INC HL
    DEC B
    JR scan
absent:
    POP HL
missing:
    XOR A
    LD [DE],A
    LD [HL],A
    LD [$FFD5],A
    RET
found:
    POP HL
    LD A,[$D108]
    SUB B
    LD C,A
    LD A,[$D109]
    OR A
    JR Z,missing
    LD B,A
    LD A,C
    CP B
    JR C,first_page
    SUB B
    INC A
    LD [HL],A
    LD A,B
    DEC A
    JR set
first_page:
    LD B,A
    XOR A
    LD [HL],A
    LD A,B
set:
    LD [$FFD5],A
    RET
