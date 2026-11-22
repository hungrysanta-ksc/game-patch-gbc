; Bank 39. Validate the previous command using the same card bitset and
; item flags as bank 4. No native menu builder runs while the root is open.
    LD A,[$FF70]
    PUSH AF
    LD A,$06
    LD [$FF70],A
    LD A,[$CFF9]
    CP A,$01
    JR Z,cards
    CP A,$02
    JR Z,items
    CP A,$04
    JR NC,reset
    JR done
cards:
    LD HL,$D570
    LD B,$00
card_id:
    LD A,B
    CALL $3256
    JR Z,next_card
    CALL $4DB0
    JR NZ,done
next_card:
    INC B
    LD A,B
    CP A,$33
    JR C,card_id
    XOR A
    LD [$CFF8],A
    JR reset
items:
    LD HL,$4C00
    LD D,$D0
item_id:
    LD A,[HL+]
    CP A,$FF
    JR Z,no_items
    LD E,A
    LD A,[DE]
    OR A
    JR Z,item_id
    JR done
no_items:
    XOR A
    LD [$CFFC],A
reset:
    XOR A
    LD [$CFF9],A
done:
    POP AF
    LD [$FF70],A
    LD A,[$CFF9]
    JP $348A
