; Double a signed little-endian 8.8 component with carry into the high byte.
    LD A,[HL]
    ADD A,[HL]
    INC HL
    LD [DE],A
    INC DE
    LD A,[HL+]
    RLA
    LD [DE],A
    INC DE
    RET
