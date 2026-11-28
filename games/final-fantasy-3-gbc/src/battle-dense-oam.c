#pragma bank 124
#include <gb/cgb.h>
#include <string.h>
#include "battle-dense-oam.h"
/* 33/AD59..ADA3 retains all 32 numeral objects for 32 NMIs. GBC only has
 * 40 OAM records. Keep those 32 fixed, and reuse the remaining eight AFTER
 * their last visible line. Each planned HBlank writes one complete record;
 * no frame alternation, partial glyph, OAM DMA during drawing, or palette
 * approximation. The original logical OAM remains in freeze's backup. */
volatile uint8_t dense_state,dense_error,dense_count,dense_index;
uint8_t dense_initial[32],dense_records[144];
static uint16_t cursor;
extern uint8_t __at(0xd740) animation_lines[144];
extern uint8_t terrain_scroll;
void ff3_native_service(void) NONBANKED;
uint8_t ff3_dense_begin(uint8_t*o,uint8_t count) BANKED {
 uint8_t order[32],slots[8],i,j,k,best,line,when,last=8,n,t,*q,*r;
 dense_state=dense_count=dense_index=dense_error=0;if(count>32)return 0;
 memset(animation_lines,0,144);memset(dense_initial,0,32);
 for(i=0;i<count;i++){ff3_native_service();q=o+i*4;if(q[0]<16||q[0]>152||!q[2])return 0;order[i]=i;
  for(j=0;j<8;j++)if(++animation_lines[q[0]-16+j]>8)return 0;
 }
 /* Stable Y order; ties preserve source OAM order. Choose hardware slots
  * in original priority order for the first eight records. */
 for(i=1;i<count;i++){ff3_native_service();t=order[i];j=i;while(j&&o[order[j-1]*4]>o[t*4]){order[j]=order[j-1];j--;}order[j]=t;}
 n=count<8?count:8;for(i=0;i<n;i++)slots[i]=order[i];
 for(i=1;i<n;i++){t=slots[i];j=i;while(j&&slots[j-1]>t){slots[j]=slots[j-1];j--;}slots[j]=t;}
 for(i=0;i<n;i++)memcpy(dense_initial+i*4,o+slots[i]*4,4);
 for(i=8;i<count;i++){q=o+order[i]*4;best=255;when=255;
  for(j=0;j<8;j++){ff3_native_service();r=o+slots[j]*4;line=r[0]-7;if(line<12)line=12;if(line<last+4)line=last+4;
   if(q[0]<19||line>q[0]-19)continue;
   /* Preserve priority for any simultaneously intersecting rectangles. */
   for(k=0;k<8;k++)if(k!=j){r=o+slots[k]*4;if(r[0]<q[0]+8&&q[0]<r[0]+8&&r[1]<q[1]+8&&q[1]<r[1]+8&&((slots[k]<order[i])!=(k<j)))break;}
   if(k==8&&line<when){best=j;when=line;}
  }
  if(best==255){dense_error=1;return 0;}
  r=dense_records+dense_count*6;r[0]=when;r[1]=128+best*4;memcpy(r+2,q,4);dense_count++;last=when;slots[best]=order[i];ff3_native_service();
 }
 memcpy(o+128,dense_initial,32);memset(o,0,128);dense_state=1;return 1;
}
void ff3_dense_stop(void) NONBANKED {if(dense_state==2)dense_state=3;else{dense_state=0;LYC_REG=11;}}
/* The C indexed copy cost more than one timer period. This fixed 32-byte
 * transfer uses 640 copy cycles and permits only the audio consumer. */
static void initial_oam(void) NONBANKED __naked {
 __asm
 ldh a,(_IE_REG)
 push af
 ld a,#4
 ldh (_IE_REG),a
 ei
 ld hl,#_dense_initial
 ld de,#0xfe80
 .rept 32
 ld a,(hl+)
 ld (de),a
 inc e
 .endm
 di
 pop af
 ldh (_IE_REG),a
 ret
 __endasm;
}
/* Called on every battle VBlank, even when a gated frame is held. OAM is
 * safely writable throughout this tiny transfer; no mapped WRAM pointer. */
void ff3_dense_vblank(uint8_t pending) NONBANKED {
 if(!dense_error&&dense_state>=2&&dense_index!=dense_count)dense_error=5;
 if(dense_state==3&&pending){dense_state=0;LYC_REG=11;return;}
 if(dense_state==1&&pending)dense_state=2;
 if(dense_state<2)return;
 if(LY_REG<144||LY_REG>151){dense_error=4;return;}
 initial_oam();dense_index=0;LYC_REG=11;
}
static void write_one(void) NONBANKED __naked {
 __asm
 ld a,(_cursor)
 ld l,a
 ld a,(_cursor+1)
 ld h,a
 ld a,(hl+)
 ld e,a
 ld d,#0xfe
 ldh a,(_IE_REG)
 push af
 ld a,#4
 ldh (_IE_REG),a
 /* Enter a fresh HBlank. Arriving near the end of an existing mode 0
  * does not reserve enough time for all four writes before mode 2.
  * Permit only TIMA while waiting; its consumer preserves registers and
  * never touches OAM, banks or this plan. Mask again for the final transfer. */
94099$:
 ei
 ldh a,(_STAT_REG)
 and #3
 cp #3
 jr nz,94099$
 di
 ldh a,(_STAT_REG)
 and #3
 cp #3
 jr nz,94099$
 /* Recheck after any timer preemption, against the actual first row. */
 ldh a,(_LY_REG)
 /* HBlank immediately before the first visible row is still safe: the
  * new record is complete before that row's mode-2 OAM scan begins. */
 add a,#16
 cp (hl)
 jr c,94100$
 ld a,#3
 ld (_dense_error),a
 jr 94101$
94100$:
 ldh a,(_STAT_REG)
 and #3
 jr nz,94100$
 .rept 4
 ld a,(hl+)
 ld (de),a
 inc e
 .endm
94101$:
 pop af
 ldh (_IE_REG),a
 ret
 __endasm;
}
/* Fixed OAM dispatch, like the original short NMI consumer. The indexed C
 * path spent about one scanline before arming the next IRQ. Keep its exact
 * count/deadline semantics, and leave audio-aware HBlank work to write_one. */
void ff3_dense_lcd(void) NONBANKED __naked {
 __asm
 ldh a,(_LYC_REG)
 cp #11
 jr nz,94200$
 ld a,(_terrain_scroll)
 ldh (_SCX_REG),a
 ld a,(_dense_count)
 or a
 ret z
 ld a,(_dense_records)
 ldh (_LYC_REG),a
 ret
94200$:
 ld a,(_dense_index)
 ld hl,#_dense_count
 cp (hl)
 jr c,94201$
 ld a,#2
 ld (_dense_error),a
 ret
94201$:
 ld e,a
 add a,a
 add a,e
 add a,a
 ld e,a
 ld d,#0
 ld hl,#_dense_records
 add hl,de
 inc hl
 ld a,l
 ld (_cursor),a
 ld a,h
 ld (_cursor+1),a
 ld a,(_dense_index)
 inc a
 ld (_dense_index),a
 ld b,a
 ld a,(_dense_count)
 cp b
 jr z,94202$
 ld de,#5
 add hl,de
 ld a,(hl)
 jr 94203$
94202$:
 ld a,#11
94203$:
 ldh (_LYC_REG),a
 jp _write_one
 __endasm;
}
