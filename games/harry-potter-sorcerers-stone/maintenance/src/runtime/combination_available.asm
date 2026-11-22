; Mirror 06:62F6's availability lookup without granting or consuming it.
; The four-byte row is indexed by the current deck in CE03.
; A learned combination can still be discovered at an unconsumed location.
; Only the current deck's FF sentinel suppresses this marker, as in the award.
    INC BC
    LD A,[BC]
    DEC BC
    LD HL,$D855
    CALL $317D
    LD A,[$FF70]
    PUSH AF
    LD A,$06
    LD [$FF70],A
    LD A,[$CE03]
    RST $08
    LD E,A
    POP AF
    LD [$FF70],A
    LD A,E
    CP A,$FF
    RET
