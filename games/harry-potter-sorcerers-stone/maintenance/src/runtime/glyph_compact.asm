; Replaces the first four bytes of native $656D.
    LD A,[$C1AE]
    AND A,$7F
    CALL $DF80
    JR Z,hangul
    PUSH BC
    LD A,[$C1AE]
    AND A,$7F
    JP $6573
hangul:
    LD A,[BC]
    AND A,$1F
    LD E,A
    INC BC
    LD A,[BC]
    AND A,$1F
    LD L,A
    LD H,$00
    ADD HL,HL
    ADD HL,HL
    ADD HL,HL
    ADD HL,HL
    ADD HL,HL
    LD D,$00
    ADD HL,DE
    INC BC
    LD A,[BC]
    PUSH AF
    AND A,$03
    RLCA
    RLCA
    ADD A,H
    LD H,A
    INC BC
    POP AF
    AND A,$80
    OR A,$01
    LD [$C1AE],A
    PUSH BC
    ADD HL,HL
    ADD HL,HL
    ADD HL,HL
    ; Each 1024-glyph block starts at $6000 to leave bank tags intact.
    LD A,H
    RLCA
    RLCA
    RLCA
    AND A,$03
    ADD A,$27
    LD B,A
    LD A,H
    AND A,$1F
    OR A,$60
    LD H,A
    LD DE,$DD80
    LD C,$08
    DI
    LD A,B
    LD [$2000],A
copy:
    LD A,[HL+]
    LD [DE],A
    INC DE
    DEC C
    JR NZ,copy
    LD A,$01
    LD [$2000],A
    EI
    NOP
    LD A,$08
    LD HL,$C1E9
    SUB [HL]
    LD [$DD01],A
    LD HL,$DD80
    JP $6579
