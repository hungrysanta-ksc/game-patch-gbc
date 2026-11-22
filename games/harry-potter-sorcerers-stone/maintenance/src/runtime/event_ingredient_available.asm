; Only verified A-trigger ingredient scripts are listed. Their native gate is
; quest == required quest AND completion variable != 1 (not item count).
; Preserve the actor pointer and current WRAM bank. No persistent scratch RAM.
    LD A,[$FFD8]
    LD D,A
    INC BC
    LD A,[BC]
    DEC BC
    LD E,A
    PUSH BC
    LD B,$09
    LD HL,$63C0
next:
    LD A,[HL+]
    CP D
    JR NZ,skip_three
    LD A,[HL+]
    CP E
    JR NZ,skip_two
    LD A,[HL+]
    LD C,A
    LD A,[HL]
    LD L,A
    LD H,$D5
    LD A,[$FF70]
    PUSH AF
    LD A,$06
    LD [$FF70],A
    LD E,$00
    LD A,[$D5D5]
    CP C
    JR NZ,restore
    LD A,[HL]
    CP A,$01
    JR Z,restore
    LD E,$01
restore:
    POP AF
    LD [$FF70],A
    POP BC
    LD A,E
    OR A
    RET
skip_three:
    INC HL
skip_two:
    INC HL
    INC HL
    DEC B
    JR NZ,next
    POP BC
    XOR A
    RET
