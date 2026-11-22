; Replaces metric-copy CALL $114A; bank1 and WRAM7 are active.
    CALL $114A
    PUSH AF
    PUSH BC
    PUSH DE
    PUSH HL
    LD HL,$7000
    LD DE,$DD80
    LD BC,$0280
copy:
    DI
    LD A,$01
    LD [$3000],A
    XOR A
    LD [$2000],A
    LD A,[HL+]
    LD [DE],A
    INC DE
    XOR A
    LD [$3000],A
    LD A,$01
    LD [$2000],A
    EI
    NOP
    DEC BC
    LD A,B
    OR C
    JR NZ,copy
    POP HL
    POP DE
    POP BC
    POP AF
    RET
