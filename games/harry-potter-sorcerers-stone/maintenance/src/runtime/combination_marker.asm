; The upper half of the flipped 8x16 pair contains the upward arrow.
; Shift below wall decorations, whose CGB background priority hides sprites.
    LD B,$40
    LD A,D
    ADD A,$18
    LD [HL+],A
    LD A,E
    ADD A,$04
    LD [HL+],A
    LD A,[$CDD3]
    LD [HL+],A
