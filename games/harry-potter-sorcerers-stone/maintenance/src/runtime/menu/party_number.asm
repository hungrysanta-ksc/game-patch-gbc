; Format unsigned 16-bit HL backwards into DE; divide by ten without truncation.
number:
    LD B,$10
    XOR A
divide:
    ADD HL,HL
    RLA
    CP A,$0A
    JR C,bitdone
    SUB A,$0A
    INC L
bitdone:
    DEC B
    JR NZ,divide
    LD [DE],A
    DEC DE
    LD A,H
    OR L
    JR NZ,number
    RET
