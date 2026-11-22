; A is the combination ID, WRAM6 is selected. Match bank 4:5365.
    PUSH HL
    PUSH BC
    LD HL,$4D00
    CALL $3185
    LD B,$03
piece:
    LD A,[HL+]
    PUSH HL
    LD HL,$D50A
    RST $08
    POP HL
    OR A
    JR Z,done
    DEC B
    JR NZ,piece
    LD A,$01
    OR A
done:
    POP BC
    POP HL
    RET
