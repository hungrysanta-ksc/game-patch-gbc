    LD A,[$CDDC]
    CP A,$20
    JR NZ,native
    LD A,H
    AND A,$C0
    CP A,$C0
    JR Z,native
    JP $DDA0
native:
    JP $3633
