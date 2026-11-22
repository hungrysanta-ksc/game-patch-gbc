; State 44. The native cursor object uses rows 1 and 2 of its bank 06
; coordinate table. Keep its index in range before the next sprite frame.
    LD A,[$FFA5]
    AND A,$02
    JR NZ,leave
    LD A,[$FFA5]
    AND A,$C0
    JR Z,confirm
    CP A,$40
    LD A,$01
    JR Z,move
    INC A
move:
    LD [$FFD5],A
    RET
confirm:
    LD A,[$FFA5]
    AND A,$01
    RET Z
    LD A,[$FFD5]
    CP A,$02
    JR Z,spells
    LD A,[$CDFB]
    CP A,$63
    RET Z
    ; Cap experience as the game does, then use its victory level-up
    ; loop. It recalculates base and equipment stats and refills SP/MP.
    LD HL,$CDF9
    LD A,$FE
    LD [HL+],A
    INC A
    LD [HL],A
    LD A,$37
    LD [$FFBD],A
    LD A,$62
    JR apply
spells:
    ; 06:6C2E sets the four completed rank counters and the 17 learned
    ; bits. Enter after the separate card flag write at 06:6C29.
    LD A,$2E
    LD [$FFBD],A
    LD A,$6C
apply:
    LD [$FFBE],A
    CALL $337A
    LD A,$15
    CALL $393E
    JP $4CC2
leave:
    LD A,$02
    LD [$C0BB],A
    LD A,$0B
    JP $2448
