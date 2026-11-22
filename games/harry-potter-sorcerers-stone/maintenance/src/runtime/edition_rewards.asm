; B is the native number of potential doublings (one for XP, two for sickles).
; C selects the matching bit in both the native battle effects and cheat flags.
    LD A,[$FF70]
    PUSH AF
    LD A,$06
    LD [$FF70],A
    LD A,[$D577]
    LD D,A
    AND A,$FC
    CP A,$A0
    LD A,$00
    JR NZ,remember
    LD A,D
    AND C
remember:
    LD E,A
    POP AF
    LD [$FF70],A
    PUSH HL
    LD A,[HL+]
    LD H,[HL]
    LD L,A
    LD A,[$CC06]
    AND C
    JR Z,cheat
twice:
    ADD HL,HL
    JR C,limit
    DEC B
    JR NZ,twice
cheat:
    LD A,E
    OR A
    JR Z,save
    LD D,H
    LD E,L
    ADD HL,HL
    JR C,limit
    ADD HL,DE
    JR NC,save
limit:
    LD HL,$FFFF
    LD A,C
    CP A,$01
    JR NZ,save
    DEC HL
save:
    POP DE
    LD A,L
    LD [DE],A
    INC DE
    LD A,H
    LD [DE],A
    JP $348A
