; Same completed-event rule as the original script, even if the player already
; owns its spell/recipe/item. FF in the quest column means no quest gate.
; Flag offsets are added to D5D5 as a full address (some flags are in D6xx).
    LD A,[$FFD8]
    LD D,A
    INC BC
    LD A,[BC]
    DEC BC
    LD E,A
    PUSH BC
    LD B,{row_count}
    LD HL,$6700
next:
    LD A,[HL+]
    CP D
    JR NZ,skip_three
    LD A,[HL+]
    CP E
    JR NZ,skip_two
    LD A,[HL+]
    LD C,A
    LD E,[HL]
    LD A,[$FF70]
    PUSH AF
    LD A,$06
    LD [$FF70],A
    LD A,C
    CP A,$FF
    JR Z,check_flag
    LD A,[$D5D5]
    CP C
    JR NZ,unavailable
check_flag:
    LD HL,$D5D5
    LD A,E
    RST $08
    CP A,$01
    JR Z,unavailable
    LD E,$01
    JR restore
unavailable:
    LD E,$00
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
