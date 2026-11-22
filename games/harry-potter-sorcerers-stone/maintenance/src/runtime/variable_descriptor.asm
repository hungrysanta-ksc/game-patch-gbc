; $3630 entry, original HL descriptor offset and DE output destination.
; Only US-English string slots use a three-byte deferred descriptor.
    CALL $300A
    LD A,[$CDDC]
    CP A,$20
    JR NZ,decode
    LD A,D
    CP A,$C2
    JR NZ,decode
    LD A,E
    CP A,$3A
    JR Z,reference
    CP A,$4A
    JR Z,reference
    CP A,$5A
    JR NZ,decode
reference:
    PUSH HL
    PUSH DE
    LD A,$02
    LD [DE],A
    INC DE
    LD A,L
    LD [DE],A
    INC DE
    LD A,H
    OR A,$80
    LD [DE],A
    POP DE
    POP HL
    LD A,$7F
    CP A,$7F
    RET
decode:
    JP $3FD7
