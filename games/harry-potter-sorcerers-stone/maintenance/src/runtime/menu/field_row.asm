; Bank 4. Exactly the availability test used by the native root menu.
    LD A,[$CFFA]
    CP A,$06
    JR NC,reset
    LD HL,$5BC6
    RST $08
    CP A,$FF
    JR Z,valid
    CALL $689E
    OR A
    JR Z,reset
valid:
    LD A,[$CFFA]
    RET
reset:
    XOR A
    LD [$CFFA],A
    RET
