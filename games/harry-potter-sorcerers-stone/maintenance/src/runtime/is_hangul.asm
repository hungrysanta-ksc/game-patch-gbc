; A is the unflagged code; Z iff escape in the English-US route.
    CP A,$01
    RET NZ
    LD A,[$CDDC]
    CP A,$20
    RET
