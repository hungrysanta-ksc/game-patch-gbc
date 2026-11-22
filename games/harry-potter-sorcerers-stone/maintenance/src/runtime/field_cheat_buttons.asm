; Called with Z set when the native field handler is unavailable.
; CE16 was the hold counter for this same debug shortcut. Its low two
; bits count input polls, with Select (04) or Start (08) in bits 2/3.
    LD HL,$CE16
    JR Z,clear
    LD A,[$CB17]
    OR A
    JR NZ,clear
    LD A,[$FFA4]
    AND A,$0C
    CP A,$0C
    JR NZ,single
    LD A,[$FFA5]
    AND A,$0C
    JR Z,clear
    LD A,$0C
    JR dispatch
single:
    LD A,[$FFA4]
    AND A,$F0
    JR NZ,clear
    LD A,[$FFA5]
    AND A,$0C
    JR Z,check_pending
    OR A,$03
    LD [HL],A
    XOR A
    RET
check_pending:
    LD A,[HL]
    OR A
    RET Z
    LD A,[$FFA4]
    AND A,$0C
    JR Z,send_single
    DEC [HL]
    LD A,[HL]
    AND A,$03
    JR Z,send_single
    XOR A
    RET
send_single:
    LD A,[HL]
    AND A,$0C
dispatch:
    PUSH AF
    XOR A
    LD [HL],A
    POP AF
    RET
clear:
    XOR A
    LD [HL],A
    RET
