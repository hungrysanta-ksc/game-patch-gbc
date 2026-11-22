#include "field-event.h"
#ifdef __SDCC
/* Pinned SM83 ABI: DE=start, A=value, BC=pointer result. Keep the 1024-byte
 * first-match rule; avoid the compiler's per-iteration stack spill. */
static uint8_t *first(uint8_t *p,uint8_t value) __naked {__asm
 ld h,d
 ld l,e
 ld d,a
 ld bc,#1024
92001$:
 ld a,(hl+)
 cp d
 jr z,92002$
 dec bc
 ld a,b
 or c
 jr nz,92001$
 ret
92002$:
 dec hl
 ld b,h
 ld c,l
 ret
 __endasm;}
#else
static uint8_t *first(uint8_t *p,uint8_t value){uint16_t n=1024;do{if(*p==value)return p;p++;}while(--n);return 0;}
#endif
/* 3F/E8CE..E8DA: unconditional map song path. Conditional songs are rejected
 * by the scene build. Request bytes are preserved, including F8/7D's $37. */
void ff3_field_music(uint8_t song){ff3_field_request(3,song);ff3_field_request(2,1);}
static void sound(uint8_t arg){if(arg&128)ff3_field_request(9,arg);else if(arg==0x7e)ff3_field_request(2,2);else if(arg==0x7f)ff3_field_request(2,4);else if(arg==0x7d){ff3_field_request(3,0x37);ff3_field_request(2,12);}else ff3_field_music(arg);}
/* D219 byte lengths; B58F shake+SFX; B938/B947 seventeen VBlank waits;
 * B71C sound; B8A6 first-match passage; B7A3 end. Unsupported commands fail. */
void ff3_field_tick(FF3FieldEvent *s){uint8_t op,from;uint8_t *match;if(s->done||s->error)return;
 if(s->shaking){s->shake=s->phase&2;if(++s->phase==17)s->shaking=0;return;}
 op=ff3_field_script(s->pc++);
 switch(op){case 0xd0:ff3_field_request(9,0xd8);s->phase=0;s->shaking=1;break;
 case 0xf8:sound(ff3_field_script(s->pc++));break;
 case 0xd6:case 0xd7:from=op==0xd6?0x5b:0x5c;match=first(s->map,from);if(match){*match+=2;s->revision++;}break;
 case 0xff:s->done=1;break;default:s->error=1;}
}
