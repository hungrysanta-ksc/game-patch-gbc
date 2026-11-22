; $3069 copier, called by native @ substitution at $30AC.
; A flagged descriptor is expanded directly into the caller's D400 buffer.
    LD A,[HL+]
    CP A,$02
    JR NZ,native
    LD A,[$CDDC]
    CP A,$20
    JR NZ,native_marker
    PUSH BC
    LD A,[HL+]
    LD C,A
    LD A,[HL+]
    AND A,$7F
    PUSH HL
    LD H,A
    LD A,C
    LD L,A
    CALL $DDA0
    CALL $3062
    POP HL
    POP BC
    RET
native_marker:
    LD A,$02
native:
    LD [DE],A
    BIT 7,A
    JP $306D
