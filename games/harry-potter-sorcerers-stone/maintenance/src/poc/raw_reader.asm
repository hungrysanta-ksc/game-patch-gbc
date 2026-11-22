; HP1 development-only raw stream discriminator. All other input uses $3633.
; Called after the original descriptor resolver. Preserve native HL/DE/BC.
entry:
    LD A,[$4000]
    CP A,$25
    JR NZ,native
    LD A,H
    CP A,$65
    JR C,native
    PUSH BC
    PUSH DE
    PUSH HL
copy:
    LD A,[HL+]
    LD [DE],A
    INC DE
    CP A,$80
    JR C,copy
    POP HL
    POP DE
    POP BC
    LD A,$7F
    CP A,$7F
    RET
native:
    JP $3633
