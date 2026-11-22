    PUSH BC
    PUSH HL
    LD E,$00
loop:
    LD A,[BC]
    AND A,$7F
    CALL $DF80
    JR Z,hangul
    LD A,[BC]
    AND A,$7F
    LD HL,$DD00
    RST $08
    LD A,[HL]
    ADD A,E
    LD E,A
    LD A,[$C1E9]
    ADD A,E
    LD E,A
    JR consume
hangul:
    INC BC
    INC BC
    INC BC
    LD A,$08
    ADD A,E
    LD E,A
consume:
    LD A,[BC]
    INC BC
    RLA
    JR NC,loop
    DEC E
    POP HL
    POP BC
    RET
