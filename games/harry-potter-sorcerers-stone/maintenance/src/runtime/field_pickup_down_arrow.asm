    ; Position the triangle above the interaction point. Near the top
    ; edge flip it vertically and point up from below the object.
    LD B,$00
    LD A,D
    CP A,$0C
    JR NC,bob
    LD B,$40
    ADD A,$0F
bob:
    LD D,A
    LD A,[$FFC2]
    AND A,$10
    LD A,D
    JR Z,emit
    ADD A,$02
emit:
    LD [HL+],A
    LD A,E
    ADD A,$04
    LD [HL+],A
    LD A,[$CDD3]
    LD [HL+],A
