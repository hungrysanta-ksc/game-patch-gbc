; Player directional vector copy at 03:6EB7. FFA4 is held input.
    PUSH AF
    LD A,[$FFA4]
    AND A,$02
    JR Z,walk
    CALL $3AA4
    CALL $3AA4
    POP AF
    DEC HL
    LD A,[HL+]
    RET
walk:
    POP AF
    JP $124B
