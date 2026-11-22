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
    RET
