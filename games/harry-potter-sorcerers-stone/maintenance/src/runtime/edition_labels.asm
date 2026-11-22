    LD A,[$FF70]
    PUSH AF
    LD A,$06
    LD [$FF70],A
    CALL {flags}
    AND A,$01
    LD HL,{xp}
    JR Z,xp_label
    LD HL,{xp_on}
xp_label:
    CALL {draw}
    CALL {flags}
    AND A,$02
    LD HL,{money}
    JR Z,money_label
    LD HL,{money_on}
money_label:
    CALL {draw}
    LD HL,$CDFE
    LD A,[HL+]
    AND [HL]
    INC HL
    CP A,$FF
    JR NZ,no_spells
    LD A,[HL]
    AND A,$01
    JR Z,no_spells
    LD HL,{spells_done}
    JR spell_label
no_spells:
    LD HL,{spells}
spell_label:
    CALL {draw}
    LD HL,$D50A
    LD B,$65
scan:
    LD A,[HL+]
    OR A
    JR Z,missing
    DEC B
    JR NZ,scan
    LD HL,{cards_done}
    JR card_label
missing:
    LD HL,{cards}
card_label:
    CALL {draw}
    POP AF
    LD [$FF70],A
    JP $0020
