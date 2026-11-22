    ; Match the developer grant of two of each card and every combination.
    LD HL,$D50A
    LD B,$65
next:
    LD A,[HL]
    CP A,$02
    JR NC,owned
    LD A,$02
    LD [HL],A
owned:
    INC HL
    DEC B
    JR NZ,next
    LD HL,$D570
    LD BC,$0006
    LD A,$FF
    CALL $112F
    LD A,$07
    LD [HL],A
    RET
