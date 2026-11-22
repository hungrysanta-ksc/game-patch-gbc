; Bank 1, WRAM7. Restore bank 1 for each interrupt window.
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
    LD A,$26
    LD [$2000],A
    LD A,[HL+]
    LD [DE],A
    INC DE
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
