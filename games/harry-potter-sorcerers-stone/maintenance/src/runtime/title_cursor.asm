; Bank 05:4191..41B5. Wrap within the visible entries (2 or 3).
; Retain BC; HL and A have the original store-at-41B6 contract.
    PUSH BC
    CP A,$40
    LD A,$FF
    JR Z,direction_ready
    LD A,$01
direction_ready:
    LD HL,$CD55
    ADD A,[HL]
    LD B,A
    LD A,[$CB40]
    INC A
    LD C,A
    LD A,B
    CP A,$FF
    JR NZ,check_down
    LD A,C
    JR done
check_down:
    CP C
    JR C,done
    JR Z,done
    XOR A
done:
    POP BC
    NOP
    NOP
    NOP
