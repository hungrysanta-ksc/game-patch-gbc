#include <gb/cgb.h>
#include <string.h>
#include "memory.h"
volatile uint8_t memory_busy,memory_fault;
uint8_t memory_bridge[FF3_WRAM_CHUNK];
static uint8_t transfer_bank,transfer_count,transfer_write;
static uint16_t transfer_offset,transfer_buffer,transfer_remaining;
static void fixed_transfer(void) __naked;
/* This is the only mapped interval. No call, push/pop, SP-relative access or
 * interrupt is possible until SVBK=1 again. Inspect emitted code in build. */
void ff3_wram_transfer(void) NONBANKED __naked {
 __asm
 ; Do not carry a masked timer into GBDK's OAM DMA / initial field VBlank
 ; batch. Wait with the caller's IE/IME intact for the last three visible
 ; lines to pass. The 16-byte copy is shorter than two scanlines.
91020$:
 ldh a,(_LY_REG)
 cp #141
 jr c,91021$
 cp #144
 jr c,91020$
91021$:
 ; Mask IE rather than using SDCC's CRITICAL (which emits DI/EI and does not
 ; preserve a caller's disabled IME). Save/restore IE on the bank-1 stack.
 ldh a,(_IE_REG)
 push af
 xor a
 ldh (_IE_REG),a
 ld a,(_transfer_offset)
 ld e,a
 ld a,(_transfer_offset+1)
 add #0xd0
 ld d,a
 ld a,(_transfer_buffer)
 ld l,a
 ld a,(_transfer_buffer+1)
 ld h,a
 ld a,(_transfer_count)
 ld b,a
 ld a,(_transfer_write)
 or a
 jr z,91002$
 ld a,(_transfer_bank)
 ldh (_SVBK_REG),a
91000$:
 ld a,(hl+)
 ld (de),a
 inc de
 dec b
 jr nz,91000$
 jr 91004$
91002$:
 ld a,(_transfer_bank)
 ldh (_SVBK_REG),a
91003$:
 ld a,(de)
 ld (hl+),a
 inc de
 dec b
 jr nz,91003$
91004$:
 ld a,#1
 ldh (_SVBK_REG),a
 pop af
 ldh (_IE_REG),a
 ret
 __endasm;
}
uint8_t ff3_wram_copy(uint8_t bank,uint16_t offset,void *buffer,uint16_t count,uint8_t write) NONBANKED {
 uint8_t *p=buffer;uint16_t address=(uint16_t)buffer;
 if(memory_busy||(SVBK_REG&7)!=1||bank<2||bank>7||write>1||offset>4096||count>4096-offset||address<0xc000||address>0xe000||count>0xe000u-address)return 0;
 memory_busy=1;transfer_bank=bank;transfer_offset=offset;transfer_write=write;
 /* Most audio snapshots already reside in fixed RAM. Stream them directly
  * with the same bounded leaf, avoiding two copies and C stack spills per
  * 16-byte chunk. Bank-1/stack buffers keep the bridge path below. */
 if(address<0xd000&&count<=0xd000-address){transfer_buffer=address;transfer_remaining=count;fixed_transfer();memory_busy=0;return 1;}
 transfer_buffer=(uint16_t)memory_bridge;
 while(count){transfer_count=count>FF3_WRAM_CHUNK?FF3_WRAM_CHUNK:(uint8_t)count;
  if(write)memcpy(memory_bridge,p,transfer_count);ff3_wram_transfer();
  if(!write)memcpy(p,memory_bridge,transfer_count);
  p+=transfer_count;count-=transfer_count;transfer_offset+=transfer_count;
 }
 memory_busy=0;return 1;
}
static void fixed_transfer(void) __naked {
 __asm
91030$:
 ld a,(_transfer_remaining+1)
 or a
 jr nz,91031$
 ld a,(_transfer_remaining)
 or a
 ret z
 cp #16
 jr c,91032$
91031$:
 ld a,#16
91032$:
 ld (_transfer_count),a
 call _ff3_wram_transfer
 ; All arithmetic/calls below see bank 1 and run with the caller's IE/IME.
 ld a,(_transfer_count)
 ld c,a
 ld hl,#_transfer_offset
 add (hl)
 ld (hl+),a
 jr nc,91033$
 inc (hl)
91033$:
 ld a,c
 ld hl,#_transfer_buffer
 add (hl)
 ld (hl+),a
 jr nc,91034$
 inc (hl)
91034$:
 ld a,(_transfer_remaining)
 sub c
 ld (_transfer_remaining),a
 jr nc,91030$
 ld hl,#_transfer_remaining+1
 dec (hl)
 jr 91030$
 __endasm;
}
/* Boot-only watermark: fill below the current SP, preserving the caller's
 * live frames. The next calls overwrite the marker naturally. */
static void mark_stack(void) __naked {
 __asm
 push bc
 ld hl,#0
 add hl,sp
 ld b,h
 ld c,l
 __endasm;
#ifdef FF3_EXPLORATION
 __asm ld hl,#0xdcb0 __endasm;
#else
 __asm ld hl,#0xdb70 __endasm;
#endif
 __asm
91010$:
 ld a,h
 cp b
 jr nz,91011$
 ld a,l
 cp c
 jr z,91012$
91011$:
 ld (hl),#0x5a
 inc hl
 jr 91010$
91012$:
 pop bc
 ret
 __endasm;
}
void ff3_memory_init(void) NONBANKED {memory_busy=memory_fault=0;mark_stack();}
