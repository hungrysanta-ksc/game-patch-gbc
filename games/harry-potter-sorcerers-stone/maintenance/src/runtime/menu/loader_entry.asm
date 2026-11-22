; Bank 1, WRAM7. Restore bank 1 for each interrupt window.
    CALL $114A
    PUSH AF
    PUSH BC
    PUSH DE
    PUSH HL
    LD HL,$7000
    LD DE,$DD80
    LD BC,$0280
    CALL $3A89
    POP HL
    POP DE
    POP BC
    POP AF
    RET
