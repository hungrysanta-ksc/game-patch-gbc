    LD A,[$CDDC]
    CP A,$20
    JR NZ,native
    LD A,H
    CP A,$C0
    JR NC,native
    JP $DDA0
native:
    JP $3633
