; Bank 39. Pick the saved descriptor from the native MP/learned-filtered
; list at CB29. Each three-byte entry contains cost, descriptor lo, hi.
    LD HL,$CB29
    LD B,$00
count:
    INC HL
    LD A,[HL+]
    OR [HL]
    INC HL
    JR Z,counted
    INC B
    LD A,B
    CP A,$11
    JR C,count
counted:
    LD A,B
    SUB A,$04
    JR NC,max_ready
    XOR A
max_ready:
    LD [$CBE8],A
    LD A,[$CFFD]
    LD E,A
    LD A,[$CFFE]
    LD D,A
    LD HL,$CB29
    LD B,$00
scan:
    INC HL
    LD A,[HL+]
    LD C,A
    LD A,[HL+]
    OR C
    JR Z,reset
    LD A,C
    CP E
    JR NZ,next
    DEC HL
    LD A,[HL+]
    CP D
    JR Z,found
next:
    INC B
    LD A,B
    CP A,$11
    JR C,scan
reset:
    XOR A
    LD [$CFFD],A
    LD [$CFFE],A
    LD [$CBEB],A
    INC A
    JP $33EF
found:
    LD A,B
    CP A,$04
    JR NC,scroll
    INC A
    JP $33EF
scroll:
    SUB A,$03
    LD [$CBEB],A
    LD A,$04
    JP $33EF
