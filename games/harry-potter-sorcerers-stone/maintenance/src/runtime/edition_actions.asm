; Cursor row 1..4 shares the original cheat menu's object coordinates.
    LD A,[$FFA5]
    AND A,$02
    JR Z,handle
    LD A,$02
    LD [$C0BB],A
    LD A,$0B
    JP $2448
handle:
    LD A,[$FFA5]
    AND A,$C0
    JR Z,confirm
    CP A,$40
    LD A,[$FFD5]
    JR Z,up
    INC A
    CP A,$05
    JR C,move
    LD A,$01
    JR move
up:
    DEC A
    JR NZ,move
    LD A,$04
move:
    LD [$FFD5],A
    RET
confirm:
    LD A,[$FFA5]
    AND A,$01
    RET Z
    LD A,[$FFD5]
    CP A,$03
    JR Z,spells
    LD B,A
    LD A,[$FF70]
    PUSH AF
    LD A,$06
    LD [$FF70],A
    LD A,B
    CP A,$04
    JR Z,cards
    CALL {flags}
    XOR B
    OR A,$A0
    LD [$D577],A
    JR restore
cards:
    CALL {grant_cards}
restore:
    POP AF
    LD [$FF70],A
    JR refresh
spells:
    LD A,$2E
    LD [$FFBD],A
    LD A,$6C
    LD [$FFBE],A
    CALL $337A
refresh:
    LD A,$15
    CALL $393E
    JP $4CC2
