; Read the three-byte directory entry in bank 26 and copy through bit 7.
    PUSH BC
    PUSH DE
    PUSH HL
    DI
    LD A,$26
    LD [$2000],A
    LD A,[HL+]
    LD B,A
    LD A,[HL+]
    LD C,A
    LD A,[HL]
    LD H,A
    LD A,C
    LD L,A
copy:
    DI
    LD A,B
    LD [$2000],A
    LD A,[HL+]
    LD [DE],A
    PUSH AF
    LD A,$01
    LD [$2000],A
    EI
    NOP
    POP AF
    INC DE
    CP A,$80
    JR C,copy
    POP HL
    POP DE
    POP BC
    LD A,$7F
    CP A,$7F
    RET
