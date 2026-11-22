; Restore the last combination actually invoked in combat. The native
; list shows three per page, including learned combinations missing pieces.
    XOR A
    LD [$CBEB],A
    LD A,$01
    LD [$FFD1],A
    LD [$FFD5],A
    LD A,[$FFCC]
    ; Native 04:5270 routes these four field contexts back to the menu.
    CP A,$0F
    JP Z,$3424
    CP A,$10
    JP Z,$3424
    CP A,$14
    JP Z,$3424
    CP A,$15
    JP Z,$3424
    LD A,[$CFF8]
    OR A
    JP Z,$3424
    DEC A
    LD E,A
    LD A,[$FF70]
    PUSH AF
    LD A,$06
    LD [$FF70],A
    LD HL,$D570
    LD B,$00
    LD C,$00
scan:
    LD A,B
    CALL $3256
    JR Z,next
    CP E
    JR Z,found
    INC C
next:
    INC B
    LD A,B
    CP A,$33
    JR C,scan
    JR reset
found:
    CALL $4DB0
    JR Z,reset
    LD B,$00
    LD A,C
page:
    CP A,$03
    JR C,place
    SUB A,$03
    INC B
    INC B
    INC B
    JR page
place:
    INC A
    LD [$FFD1],A
    LD [$FFD5],A
    LD A,B
    LD [$CBEB],A
    JR done
reset:
    XOR A
    LD [$CFF8],A
done:
    POP AF
    LD [$FF70],A
    JP $3424
