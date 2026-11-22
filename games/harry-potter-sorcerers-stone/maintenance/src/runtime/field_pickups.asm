; Append the pickup indicator after the native field sprites.
; 00:026C walks 23 actors starting at C371. Actor 07's interaction script
; calls 06:67E6, which looks up its slot in WRAM6 and consumes it with FF.
    PUSH BC
    LD A,[$FFCF]
    CP A,$0B
    JR Z,field
    CP A,$0C
    JR NZ,done
field:
    LD A,[$CB17]
    OR A
    JR NZ,done
    LD A,[$FFD8]
    CP A,$60
    JR NC,done
    LD BC,$C371
next_actor:
    LD A,[BC]
    CP A,$07
{additional_pickup_types}    JR NZ,advance
    PUSH BC
    CALL draw_if_available
    POP BC
advance:
    LD HL,$0051
    ADD HL,BC
    LD B,H
    LD C,L
    LD A,B
    CP A,$CA
    JR C,next_actor
    LD A,C
    CP A,$B8
    JR C,next_actor
done:
    POP BC
    JP $3389

draw_if_available:
    LD HL,$002E
    ADD HL,BC
    LD A,[HL-]
    AND A,$02
    RET NZ
    LD A,[HL]
    AND A,$10
    RET Z
{additional_pickup_availability}    INC BC
    LD A,[BC]
    DEC BC
    CP A,$04
    RET NC
    LD E,A
    LD HL,$D6D5
    LD A,[$FFD8]
    CALL $317D
    LD A,[$FF70]
    PUSH AF
    LD A,$06
    LD [$FF70],A
    LD A,E
    RST $08
    LD E,A
    POP AF
    LD [$FF70],A
    LD A,E
    CP A,$FF
    RET Z

draw_position:
    ; Compare full world coordinates so distant actors cannot wrap on screen.
    LD HL,$0006
    ADD HL,BC
    LD A,[$FF90]
    LD C,A
    LD A,[$FF91]
    LD B,A
    LD A,[HL+]
    SUB C
    LD E,A
    LD A,[HL+]
    SBC A,B
    OR A
    RET NZ
    LD A,E
    CP A,$A0
    RET NC
    INC HL
    LD A,[$FF92]
    LD C,A
    LD A,[$FF93]
    LD B,A
    LD A,[HL+]
    SUB C
    LD D,A
    LD A,[HL]
    SBC A,B
    OR A
    RET NZ
    LD A,D
    CP A,$90
    RET NC

    LD A,[$C0B9]
    OR A
    RET Z
    LD A,[$C0B7]
    CP A,$A0
    RET NC
    LD L,A
    LD H,$C0
{marker_sprite}
    LD A,B
    LD [HL+],A
    LD A,L
    LD [$C0B7],A
    LD HL,$C0B9
    DEC [HL]
    RET
