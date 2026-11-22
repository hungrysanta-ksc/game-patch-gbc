    PUSH HL
    CALL $675C
    LD E,$00
loop:
    LD A,[BC]
    AND A,$7F
    CALL $DF80
    JR Z,hangul
    LD A,[BC]
    AND A,$7F
    CP A,$5F
    JR Z,paragraph
    CP A,$20
    JR Z,boundary
    CP A,$2D
    JR NZ,metric
boundary:
    LD A,E
    OR A
    JR NZ,word_boundary
metric:
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
done:
    POP HL
    RET
paragraph:
    LD A,$01
    LD [$C237],A
word_boundary:
    XOR A
    JR done
