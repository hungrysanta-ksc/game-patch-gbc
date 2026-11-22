; Read the native per-deck discovery slot, then the learned-combination bit.
; Return Z for consumed/known rewards. No persistent RAM or HRAM scratch.
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
    LD E,$00
    CP A,$33
    JR NC,restore_bank
    LD HL,$D570
    CALL $3269
    AND [HL]
    JR NZ,restore_bank
    LD E,$01
restore_bank:
    POP AF
    LD [$FF70],A
    LD A,E
    OR A
    RET
