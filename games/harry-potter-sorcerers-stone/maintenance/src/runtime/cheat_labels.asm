; Native header, tilemap layout and line renderer are set up by 01:4CC2.
    LD A,[$FF70]
    PUSH AF
    LD A,$07
    LD [$FF70],A
    LD A,[$CDFB]
    CP A,$63
    LD HL,{level}
    JR NZ,level_row
    LD HL,{level_done}
level_row:
    CALL draw
    LD HL,$CDFE
    LD A,[HL+]
    CP A,$FF
    JR NZ,not_learned
    LD A,[HL+]
    CP A,$FF
    JR NZ,not_learned
    LD A,[HL]
    AND A,$01
    JR Z,not_learned
    LD HL,{spells_done}
    JR spell_row
not_learned:
    LD HL,{spells}
spell_row:
    CALL draw
    POP AF
    LD [$FF70],A
    JP $0020
draw:
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
    JP $6CB3
