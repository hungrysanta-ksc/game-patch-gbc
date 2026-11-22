; Bank 39, after a validated game load. No new persistent or scratch RAM.
; Native 03:7E8D/7F00 sets Gryffindor = chapter base + personal points.
; Repair only a base equal to one of the four overwritten table words.
    LD A,[$FF70]
    PUSH AF
    LD A,$06
    LD [$FF70],A
    LD A,[$D60A]
    CP A,$06
    JR NC,done
    LD HL,$D5D0
    LD E,[HL]
    INC HL
    LD D,[HL]
    LD HL,$D5C8
    LD A,[HL+]
    SUB E
    LD C,A
    LD A,[HL]
    SBC A,D
    LD B,A
    LD HL,$6F00
    LD A,$04
next:
    PUSH AF
    LD A,[HL+]
    CP C
    JR NZ,low_mismatch
    LD A,[HL+]
    CP B
    JR Z,repair
    JR mismatch
low_mismatch:
    INC HL
mismatch:
    POP AF
    DEC A
    JR NZ,next
    JR done
repair:
    POP AF
    LD A,[$D60A]
    LD HL,$6F08
    CALL $319D
    ADD HL,DE
    LD A,L
    LD [$D5C8],A
    LD A,H
    LD [$D5C9],A
done:
    POP AF
    LD [$FF70],A
    LD A,[$CE09]
    BIT 0,A
    JP $3424
