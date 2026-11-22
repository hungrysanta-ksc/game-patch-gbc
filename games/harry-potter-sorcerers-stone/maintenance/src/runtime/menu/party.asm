; Start menu compositor. WRAM1 offscreen map tail is backed up in private WRAM7 renderer padding while used.
    PUSH BC
    PUSH DE
    PUSH HL
    LD A,[$FF70]
    PUSH AF
    LD A,$01
    LD [$FF70],A
    LD HL,$DBD0
    LD DE,$DFD0
    LD B,$30
save:
    LD A,[HL+]
    LD C,A
    LD A,$07
    LD [$FF70],A
    LD A,C
    LD [DE],A
    INC DE
    LD A,$01
    LD [$FF70],A
    DEC B
    JR NZ,save
    LD A,$88
    LD [$DBE0],A
    LD A,$D8
    LD [$DBE1],A
    XOR A
    LD [$DBE2],A
    LD [$DBE6],A
    ; HP1 stores a single playable combatant. Native status screen 04:611B/616E.
    LD A,[$CDFB]
    LD [$DBE5],A
    LD BC,$CDE0
    LD A,$90
    CALL member
    LD HL,$DFD0
    LD DE,$DBD0
    LD B,$30
restore:
    LD A,$07
    LD [$FF70],A
    LD A,[HL]
    LD C,A
    XOR A
    LD [HL+],A
    INC A
    LD [$FF70],A
    LD A,C
    LD [DE],A
    INC DE
    DEC B
    JR NZ,restore
    POP AF
    LD [$FF70],A
    POP HL
    POP DE
    POP BC
    JP $3424
member:
    LD E,A
    LD A,[$DBE2]
    CP A,$03
    RET Z
    INC A
    LD [$DBE2],A
    LD A,C
    LD [$DBE3],A
    LD A,B
    LD [$DBE4],A
    XOR A
    LD [$DBFA],A
    CALL rowaddr
    LD A,E
    LD B,$05
name:
    LD [HL+],A
    INC A
    DEC B
    JR NZ,name
    LD A,$8F
    LD [HL+],A
    LD [HL+],A
    LD [HL+],A
    LD [HL+],A
    LD A,$95
    LD [HL+],A
    PUSH HL
    CALL clearbuf
    LD A,[$DBE5]
    LD L,A
    LD H,$00
    LD DE,$DBF3
    CALL number
    LD DE,$DBF0
    POP HL
    LD B,$02
    CALL pairs
    CALL upload
    LD A,$01
    CALL stat
    LD A,$03
    CALL stat
    RET
rowaddr:
    LD A,[$DBE0]
    LD L,A
    LD A,[$DBE1]
    LD H,A
    RET
stat:
    PUSH AF
    LD HL,$DBE3
    LD C,[HL]
    INC HL
    LD B,[HL]
    LD L,A
    LD H,$00
    ADD HL,BC
    LD A,[HL+]
    LD [$DBF6],A
    LD A,[HL+]
    LD [$DBF7],A
    INC HL
    INC HL
    LD A,[HL+]
    LD [$DBF4],A
    LD A,[HL]
    LD [$DBF5],A
    CALL rowaddr
    POP AF
    CP A,$01
    LD A,$96
    JR Z,which
    INC A
which:
    LD [$DBFA],A
    LD [HL+],A
    LD A,$8F
    LD [HL+],A
    PUSH HL
    CALL meter
    LD C,A
    POP HL
    LD B,$03
bar:
    LD A,C
    CP A,$08
    JR C,last
    SUB A,$08
    LD C,A
    LD A,$08
    JR fragment
last:
    LD C,$00
fragment:
    ADD A,$98
    LD [HL+],A
    DEC B
    JR NZ,bar
    LD A,$8F
    LD [HL+],A
    PUSH HL
    CALL clearbuf
    LD A,[$DBF6]
    LD L,A
    LD A,[$DBF7]
    LD H,A
    LD DE,$DBF3
    CALL number
    LD A,$0A
    LD [DE],A
    DEC DE
    LD A,[$DBF4]
    LD L,A
    LD A,[$DBF5]
    LD H,A
    CALL number
    POP HL
    LD DE,$DBE8
    LD B,$06
    CALL pairs
    JP upload
clearbuf:
    LD HL,$DBE8
    LD B,$0C
    LD A,$0B
clear:
    LD [HL+],A
    DEC B
    JR NZ,clear
    RET
{number_formatter}
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
; 24-step remainder accumulation for floor(24*current/max); handle zero and overflow.
meter:
    LD HL,$DBF6
    LD C,[HL]
    INC HL
    LD B,[HL]
    LD A,B
    OR C
    RET Z
    LD HL,$DBF4
    LD E,[HL]
    INC HL
    LD D,[HL]
    LD A,E
    SUB C
    LD A,D
    SBC A,B
    LD A,$18
    JR NC,meterdone
    LD [$DBF9],A
    XOR A
    LD [$DBF8],A
    LD HL,$0000
meterloop:
    ADD HL,DE
    JR C,submax
    LD A,L
    SUB C
    LD A,H
    SBC A,B
    JR C,meterskip
submax:
    LD A,L
    SUB C
    LD L,A
    LD A,H
    SBC A,B
    LD H,A
    LD A,[$DBF8]
    INC A
    LD [$DBF8],A
meterskip:
    LD A,[$DBF9]
    DEC A
    LD [$DBF9],A
    JR NZ,meterloop
    LD A,[$DBF8]
meterdone:
    RET
upload:
    CALL rowaddr
    LD B,$0C
tile:
    LD A,B
    LD [$DBFC],A
    PUSH BC
    PUSH HL
    LD A,[HL]
    LD C,A
    ; Use the native dark plum palette for text, teal for MP and green for SP.
    LD B,$0A
    CP A,$96
    JR C,install
    LD A,[$DBFA]
    CP A,$96
    JR NZ,install
    LD B,$0B
install:
    LD A,[$DBE6]
    LD [HL],A
    LD DE,$0400
    ADD HL,DE
    LD [HL],B
    LD L,A
    LD H,$00
    ADD HL,HL
    ADD HL,HL
    ADD HL,HL
    ADD HL,HL
    LD DE,$9000
    ADD HL,DE
    LD D,H
    LD E,L
    LD L,C
    LD H,$00
    ADD HL,HL
    ADD HL,HL
    ADD HL,HL
    ADD HL,HL
    LD BC,$5000
    ADD HL,BC
    ; Stage one aligned 2bpp tile. Add a frame without overwriting live tiles.
    PUSH DE
    LD DE,$DBD0
    LD B,$10
copytile:
    LD A,[HL+]
    LD [DE],A
    INC DE
    DEC B
    JR NZ,copytile
    LD A,[$DBFA]
    OR A
    JR NZ,nothead
    XOR A
    LD [$DBD0],A
    LD A,$FF
    LD [$DBD1],A
nothead:
    CP A,$97
    JR NZ,notfoot
    XOR A
    LD [$DBDE],A
    LD A,$FF
    LD [$DBDF],A
notfoot:
    LD A,[$DBFC]
    CP A,$0C
    JR NZ,notleft
    LD DE,$7F80
    CALL edge
notleft:
    LD A,[$DBFC]
    CP A,$01
    JR NZ,notright
    LD DE,$FE01
    CALL edge
notright:
    POP DE
    LD HL,$DBD0
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
    LD A,[$DBE6]
    INC A
    LD [$DBE6],A
    POP HL
    INC HL
    POP BC
    DEC B
    JP NZ,tile
    LD DE,$0014
    ADD HL,DE
    LD A,L
    LD [$DBE0],A
    LD A,H
    LD [$DBE1],A
    RET
edge:
    LD HL,$DBD0
    LD B,$08
edgepixel:
    LD A,[HL]
    AND D
    LD [HL+],A
    LD A,[HL]
    OR E
    LD [HL+],A
    DEC B
    JR NZ,edgepixel
    RET
