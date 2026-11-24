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
 __endasm;
#ifdef FF3_ITEM_WINDOW
 /* Fixed-size diagnostic copy: no loop overhead in the audio deadline. */
 __asm
 .rept 11
 ld a,(hl+)
 ld (de),a
 inc de
 .endm
 ld a,(hl+)
 ld (de),a
 __endasm;
#else
 __asm
 ld b,#12
90104$:
 ld a,(hl+)
 ld (de),a
 inc de
 dec b
 jp nz,90104$
 __endasm;
#endif
#ifdef FF3_SCENE
 __asm
 ld a,(hl+)
 ld (_scene_target_shake),a
 ld a,(hl+)
 ld (_scene_target_revision),a
 __endasm;
#else
 __asm
 inc hl
 inc hl
 __endasm;
#endif
 __asm
 ld a,(_irq_write_count)
 __endasm;
#ifdef FF3_ITEM_WINDOW
 /* Emit the remainder, then groups of four. Preserve APU order and values
  * with bounded loop overhead for a worst-case 23-write packet. */
 __asm
 ld d,a
 and #3
 ld b,a
 jr z,90125$
90124$:
 ld a,(hl+)
 ld c,a
 ld a,(hl+)
 ldh (c),a
 dec b
 jr nz,90124$
90125$:
 ld a,d
 srl a
 srl a
 ld b,a
 or a
 jr z,90106$
90105$:
 ld a,(hl+)
 ld c,a
 ld a,(hl+)
 ldh (c),a
 ld a,(hl+)
 ld c,a
 ld a,(hl+)
 ldh (c),a
 ld a,(hl+)
 ld c,a
 ld a,(hl+)
 ldh (c),a
 ld a,(hl+)
 ld c,a
 ld a,(hl+)
 ldh (c),a
 dec b
 jr nz,90105$
 __endasm;
#else
 __asm
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
 __endasm;
#endif
 __asm
90106$:
90120$:
 ld a,(_native_head)
 inc a
 and #15
 ld (_native_head),a
 ld a,(_irq_flags)
 or a
 __endasm;
#ifdef FF3_ITEM_WINDOW
 /* prepare() merges coincident VM/sweep/restore deadlines into one packet.
  * Deadlines are strictly increasing; the next timer edge can discover the
  * following wait instead of rescanning another packet in this interrupt. */
 __asm
 jp z,90199$
 __endasm;
#else
 __asm
 jp z,90100$
 __endasm;
#endif
 __asm
 xor a
#ifndef FF3_EXPLORATION
 ldh (_TAC_REG),a
#endif
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
 __endasm;
#ifdef FF3_ITEM_WINDOW
 __asm
 .globl _item_audio_irq_begin
_item_audio_irq_begin:
 __endasm;
#endif
 __asm
 push af
 __endasm;
#ifndef FF3_ITEM_WINDOW
 __asm
 push hl
 __endasm;
#endif
#ifdef FF3_ITEM_WINDOW
 /* STAT may preempt the packet writer, but neither TIM nor VBL may reenter
  * it. The raster ISR preserves AF and touches no queue, bank, or WRAM. */
 __asm
 ldh a,(_IE_REG)
 push af
 and #2
 ldh (_IE_REG),a
 ei
 push hl
 __endasm;
#endif
 __asm
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
 __endasm;
#ifdef FF3_ITEM_WINDOW
 __asm
 di
 pop hl
 pop af
 ldh (_IE_REG),a
 __endasm;
#endif
 __asm
 __endasm;
#ifndef FF3_ITEM_WINDOW
 __asm
 pop hl
 __endasm;
#endif
 __asm
 pop af
 __endasm;
#ifdef FF3_ITEM_WINDOW
 __asm
 .globl _item_audio_irq_end
_item_audio_irq_end:
 __endasm;
#endif
 __asm
 reti
 __endasm;}
ISR_VECTOR(VECTOR_TIMER, clock_irq)
