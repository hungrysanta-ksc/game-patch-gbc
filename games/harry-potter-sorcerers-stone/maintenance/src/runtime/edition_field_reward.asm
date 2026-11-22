; BC holds the positive reward. Return the displayed and credited amount in HL.
    LD H,B
    LD L,C
    LD A,[$FF70]
    PUSH AF
    LD A,$06
    LD [$FF70],A
    LD A,[$D577]
    AND A,$FE
    CP A,$A2
    JR NZ,done
    ADD HL,HL
    JR C,limit
    ADD HL,BC
    JR NC,done
limit:
    LD HL,$FFFF
done:
    POP AF
    LD [$FF70],A
    JP $348A
