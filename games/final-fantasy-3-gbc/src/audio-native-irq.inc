static void dispatch_due(void) __naked {
 __asm
 ld a,#1
 ld (_native_irq_busy),a
 xor a
 ld (_irq_wait),a
90100$:
 ld a,(_native_head)
 ld b,a
 ld a,(_native_tail)
 cp b
 jp nz,90101$
 ld a,(_native_playing)
 or a
 jp z,90199$
 ld hl,#_native_underruns
 inc (hl)
 jp nz,90199$
 inc hl
 inc (hl)
 jp 90199$
90101$:
 ld l,b
 ld h,#0
 add hl,hl
 add hl,hl
 add hl,hl
 add hl,hl
 add hl,hl
 add hl,hl
 ld de,#_native_queue
 add hl,de
 ld a,(hl+)
 ld c,a
 ld (_irq_due),a
 ld a,(hl+)
 ld b,a
 ld a,(_native_clock)
 sub c
 ld e,a
 ld a,(_native_clock+1)
 sbc b
 bit 7,a
 jp z,90107$
 ; All event gaps are at most 34 ticks. Skip dispatch until the head is due.
 ld a,e
 cpl
 inc a
 ld (_irq_wait),a
 jp 90199$
90107$:
 ld d,a
 ld a,(_native_max_late+1)
 cp d
 jp c,90102$
 jp nz,90103$
 ld a,(_native_max_late)
 cp e
 jp nc,90103$
90102$:
 ld a,e
 ld (_native_max_late),a
 ld a,d
 ld (_native_max_late+1),a
90103$:
 ld a,(hl+)
 ld (_irq_write_count),a
 ld a,(hl+)
 ld (_irq_flags),a
 ld de,#_native_consumed
 ld b,#12
90104$:
 ld a,(hl+)
 ld (de),a
 inc de
 dec b
 jp nz,90104$
 inc hl
 inc hl
 ld a,(_irq_write_count)
 ld b,a
 or a
 jp z,90106$
90105$:
 ld a,(hl+)
 add #0x10
 ld c,a
 ld a,(hl+)
 ldh (c),a
 dec b
 jp nz,90105$
90106$:
90120$:
 ld a,(_native_head)
 inc a
 and #15
 ld (_native_head),a
 ld a,(_irq_flags)
 or a
 jp z,90100$
 xor a
 ldh (_TAC_REG),a
 ldh (_NR12_REG),a
 ldh (_NR22_REG),a
 ldh (_NR32_REG),a
 ldh (_NR42_REG),a
 ld (_native_playing),a
 inc a
 ld (_native_done),a
90199$:
 xor a
 ld (_native_irq_busy),a
 ret
 __endasm;
}
static void clock_irq(void) __naked {__asm
 push af
 push hl
 ld a,#1
 ld (_native_irq_busy),a
 ld hl,#_native_clock
 inc (hl)
 jp nz,90200$
 inc hl
 inc (hl)
90200$:
 ld a,(_irq_wait)
 or a
 jp z,90201$
 dec a
 ld (_irq_wait),a
 jp z,90201$
 xor a
 ld (_native_irq_busy),a
 jp 90202$
90201$:
 push bc
 push de
 call _dispatch_due
 pop de
 pop bc
90202$:
 pop hl
 pop af
 reti
 __endasm;}
ISR_VECTOR(VECTOR_TIMER, clock_irq)
