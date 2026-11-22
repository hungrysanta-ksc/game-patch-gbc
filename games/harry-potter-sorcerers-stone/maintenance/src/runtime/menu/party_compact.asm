; Eight tiles per row. WRAM7:DFD0..DFFF is reserved renderer padding.
; DFD0 is the DMA tile, DFE0 the decimal buffer, DFF0 the eight tile recipes.
    PUSH BC
    PUSH DE
    PUSH HL
    LD A,[$FF70]
    PUSH AF
    LD A,$07
    LD [$FF70],A
    XOR A
    LD [$DFF8],A
    LD HL,$DFF0
    LD A,$90
    LD [HL+],A
    INC A
    LD [HL+],A
    LD A,$8F
    LD [HL+],A
    LD [HL+],A
    LD [HL+],A
    LD A,$95
    LD [HL+],A
    CALL clear_digits
    LD A,[$CDFB]
    LD L,A
    LD H,$00
    LD DE,$DFEB
    CALL number
    LD DE,$DFE8
    LD HL,$DFF6
    LD B,$02
    CALL pairs
    LD HL,$D88B
    CALL upload_row
    LD HL,$CDE1
    LD A,$96
    CALL stat
    LD HL,$D8AB
    CALL upload_row
    LD HL,$CDE3
    LD A,$97
    CALL stat
    LD HL,$D8CB
    CALL upload_row
    LD HL,$DFD0
    LD BC,$0030
    CALL $112E
    POP AF
    LD [$FF70],A
    POP HL
    POP DE
    POP BC
    JP $3424

clear_digits:
    LD HL,$DFE0
    LD A,$0B
    LD B,$0C
blank:
    LD [HL+],A
    DEC B
    JR NZ,blank
    RET

stat:
    LD [$DFF0],A
    PUSH HL
    CALL clear_digits
    POP HL
    LD C,[HL]
    INC HL
    LD B,[HL]
    INC HL
    INC HL
    INC HL
    LD E,[HL]
    INC HL
    LD D,[HL]
    PUSH BC
    PUSH DE
    LD H,B
    LD L,C
    LD DE,$DFEB
    CALL number
    LD A,$0A
    LD [DE],A
    DEC DE
    POP HL
    PUSH HL
    CALL number
    ; Normally allocate 16 pixels to the gauge and 40 to the readout.
    ; An 11-character value (65535/65535) borrows one tile from the gauge.
    LD A,[$DFE1]
    CP A,$0B
    LD A,$10
    JR Z,width_ready
    LD A,$08
width_ready:
    LD [$DFEF],A
    POP DE
    POP BC
    CALL meter
    LD HL,$DFF1
    LD C,A
    CP A,$08
    JR C,low_fill
    LD A,$08
low_fill:
    ADD A,$98
    LD [HL+],A
    LD A,[$DFEF]
    CP A,$08
    JR Z,wide_number
    LD A,C
    SUB A,$08
    JR NC,high_fill
    XOR A
high_fill:
    ADD A,$98
    LD [HL+],A
    LD DE,$DFE2
    LD B,$05
    JR pairs
wide_number:
    LD DE,$DFE0
    LD B,$06
pairs:
    LD A,[DE]
    INC DE
    LD C,A
    ADD A,A
    ADD A,C
    ADD A,A
    ADD A,A
    LD C,A
    LD A,[DE]
    INC DE
    ADD A,C
    LD [HL+],A
    DEC B
    JR NZ,pairs
    RET

{number_formatter}

; DE=current, BC=maximum. Return floor(width*current/maximum), saturated.
meter:
    LD A,B
    OR C
    RET Z
    LD A,E
    SUB C
    LD A,D
    SBC A,B
    LD A,[$DFEF]
    RET NC
    LD [$DFED],A
    XOR A
    LD [$DFEC],A
    LD HL,$0000
meter_loop:
    ADD HL,DE
    JR C,subtract
    LD A,L
    SUB C
    LD A,H
    SBC A,B
    JR C,meter_next
subtract:
    LD A,L
    SUB C
    LD L,A
    LD A,H
    SBC A,B
    LD H,A
    LD A,[$DFEC]
    INC A
    LD [$DFEC],A
meter_next:
    LD A,[$DFED]
    DEC A
    LD [$DFED],A
    JR NZ,meter_loop
    LD A,[$DFEC]
    RET

upload_row:
    LD DE,$DFF0
    LD B,$08
upload_tile:
    PUSH BC
    LD A,[DE]
    INC DE
    PUSH DE
    LD C,A
    LD A,[$DFF8]
    LD B,A
    INC A
    LD [$DFF8],A
    LD A,$01
    LD [$FF70],A
    LD [HL],B
    INC HL
    PUSH HL
    DEC HL
    LD DE,$0400
    ADD HL,DE
    ; Retain the menu's palette and priority, select VRAM bank 1.
    LD A,[HL]
    OR A,$08
    LD [HL],A
    LD A,$07
    LD [$FF70],A
    LD L,C
    LD H,$00
    ADD HL,HL
    ADD HL,HL
    ADD HL,HL
    ADD HL,HL
    LD DE,$5000
    ADD HL,DE
    LD DE,$DFD0
    LD A,B
    LD C,A
    LD B,$10
stage:
    LD A,[HL+]
    LD [DE],A
    INC DE
    DEC B
    JR NZ,stage
    LD L,C
    LD H,$00
    ADD HL,HL
    ADD HL,HL
    ADD HL,HL
    ADD HL,HL
    LD DE,$9000
    ADD HL,DE
    LD D,H
    LD E,L
    LD HL,$DFD0
    LD A,[$FF4F]
    PUSH AF
    LD A,$01
    LD [$FF4F],A
    LD A,[$FF40]
    AND A,$80
    JR NZ,hblank
    LD C,$00
    CALL $0028
    JR transferred
hblank:
    LD C,$01
    CALL $1D9C
transferred:
    POP AF
    LD [$FF4F],A
    POP HL
    POP DE
    POP BC
    DEC B
    JP NZ,upload_tile
    RET
