    LD A,D
    ADD A,$0C
    LD [HL+],A
    ; At the left screen edge place a flipped arrow on the object's right.
    LD B,$08
    LD A,E
    CP A,$08
    JR C,left_edge
    ; Nudge toward the object every 16 frames without storing animation state.
    LD A,[$FFC2]
    AND A,$10
    LD A,E
    JR Z,positioned
    SUB A,$02
    JR positioned
left_edge:
    ADD A,$09
    LD B,$28
positioned:
    LD [HL+],A
    LD A,$06
    LD [HL+],A
