; BC remains the field actor. Match Object70's quest gate at 00:0BE0.
; Shared caller already checked visibility and the actor's collectable bit.
    LD A,[$FF70]
    PUSH AF
    LD A,$06
    LD [$FF70],A
    LD A,[$D5D5]
    LD E,A
    POP AF
    LD [$FF70],A
    LD A,E
    CP A,$08
    RET Z
    CP A,$09
    RET
