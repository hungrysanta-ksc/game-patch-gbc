    LD A,$07
    LD [$FF70],A
    LD DE,$D400
copy:
    LD A,[HL+]
    LD [DE],A
    INC DE
    BIT 7,A
    JR Z,copy
    LD HL,$D400
    CALL $6F9E
    LD HL,$D400
    CALL $6468
    CALL $6CB3
    LD A,$06
    LD [$FF70],A
    RET
