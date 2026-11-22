; B counts down from four. Select a bank 39 label before staging it in
; WRAM7 for the bank 01 text renderer.
    LD A,$06
    LD [$FF70],A
    LD A,B
    CP A,$02
    JR C,cards
    JR Z,spells
    CP A,$03
    JR Z,sickles
    CALL {flags}
    AND A,$01
    LD HL,{xp}
    JR Z,copy
    LD HL,{xp_on}
    JR copy
sickles:
    CALL {flags}
    AND A,$02
    LD HL,{money}
    JR Z,copy
    LD HL,{money_on}
    JR copy
spells:
    LD HL,$CDFE
    LD A,[HL+]
    AND [HL]
    INC HL
    CP A,$FF
    JR NZ,need_spells
    LD A,[HL]
    AND A,$01
    JR Z,need_spells
    LD HL,{spells_done}
    JR copy
need_spells:
    LD HL,{spells}
    JR copy
cards:
    LD HL,$D50A
    LD B,$65
check_card:
    LD A,[HL+]
    OR A
    JR Z,need_cards
    DEC B
    JR NZ,check_card
    LD HL,{cards_done}
    JR copy
need_cards:
    LD HL,{cards}
copy:
    LD A,$07
    LD [$FF70],A
    LD DE,$D400
next:
    LD A,[HL+]
    LD [DE],A
    INC DE
    BIT 7,A
    JR Z,next
    LD HL,$D400
    JP $3389
