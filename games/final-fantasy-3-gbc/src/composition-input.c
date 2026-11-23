#pragma bank 13
#include <string.h>
#include "composition-input.h"
static uint8_t origin_x,origin_y;
static FF3CompositionDirty *result;
static const FF3CompositionInput *previous,*current;
static uint8_t *occupied,collisions;
void (*ff3_composition_idle)(void);
static void service(void){if(ff3_composition_idle)ff3_composition_idle();}
static void count_mask(void) __naked {__asm
 ld a,(_result)
 ld l,a
 ld a,(_result+1)
 ld h,a
 ld de,#0
 ld b,#128
93001$:
 ld a,(hl+)
 or a
 jr z,93003$
93002$:
 ld c,a
 inc de
 dec a
 and c
 jr nz,93002$
93003$:
 dec b
 jr nz,93001$
 ld (hl),e
 inc hl
 ld (hl),d
 ret
 __endasm;
}
static void region(uint8_t x,uint8_t y,uint8_t w,uint8_t h){
 static int8_t dx,dy;static uint8_t row,col,run,left,bit,at,mask;
 dx=(x-origin_x)&127;dy=(y-origin_y)&127;
 if(dx>=64)dx-=128;if(dy>=64)dy-=128;
 if(dx<0){if(-dx>=w)return;w+=dx;dx=0;}if(dy<0){if(-dy>=h)return;h+=dy;dy=0;}
 if(dx>=21||dy>=19)return;if(dx+w>21)w=21-dx;if(dy+h>19)h=19-dy;
 x=origin_x+dx;y=origin_y+dy;
 /* OR at most four byte spans per row, rather than visiting 399 cells. */
 for(row=0;row<h;row++){
  col=x;left=w;while(left){bit=col&7;run=8-bit;if(run>left)run=left;
   at=(((y+row)&31)<<2)+((col&31)>>3);mask=(uint8_t)((255u>>(8-run))<<bit);
   if(collisions){result->tiles[at]|=occupied[at]&mask;occupied[at]|=mask;}else result->tiles[at]|=mask;
   col+=run;left-=run;
  }
 }
}
static void rectangle(const FF3CompositionActor *a){
 if(a->visible)region(a->x>>3,a->y>>3,(a->x&7)?3:2,(a->y&7)?3:2);
}
static uint8_t actor_changes(void){
 static uint8_t i,order;static const FF3CompositionActor *a,*b;
 order=0;
 for(i=0,a=previous->actors,b=current->actors;i<14;i++,a++,b++){
  if(a->visible!=b->visible||((a->visible||b->visible)&&(a->x!=b->x||a->y!=b->y||memcmp(a->shape,b->shape,12)))){
   rectangle(a);rectangle(b);result->objects=1;
  }
  if((a->visible||b->visible)&&a->order!=b->order){order=1;result->objects=1;}
  if(i&1)service();
 }
 return order;
}
static void order_changes(void){
 static uint8_t i;static const FF3CompositionActor *a;
 /* Linear occupancy passes replace quadratic rectangle-pair comparisons.
  * A shared tile is conservatively dirty even if opaque pixels do not overlap.
  * The cache's canonical input still decides whether composition is needed. */
 collisions=1;memset(occupied,0,128);
 for(i=0,a=previous->actors;i<14;i++,a++){rectangle(a);if(i&1)service();}
 memset(occupied,0,128);
 for(i=0,a=current->actors;i<14;i++,a++){rectangle(a);if(i&1)service();}
 collisions=0;
}
void ff3_composition_dirty(const FF3CompositionInput *before,const FF3CompositionInput *after,FF3CompositionDirty *out,uint8_t *scratch) BANKED {
 static uint8_t x,y,oldx,oldy;
 /* Separate passes and explicit scratch avoid SDCC's large nested-pointer
  * stack frame. Scratch is main-thread only and never shared with the IRQ. */
 previous=before;current=after;result=out;occupied=scratch;collisions=0;memset(out,0,sizeof(*out));origin_x=after->camera_x>>3;origin_y=after->camera_y>>3;
 if(before->valid&&!memcmp(before,after,sizeof(*after)))return;
 out->full=!before->valid||before->epoch!=after->epoch;
 out->scroll=out->full||before->camera_x!=after->camera_x||before->camera_y!=after->camera_y;
 out->objects=out->scroll;
 if(out->full){region(origin_x,origin_y,21,19);out->count=399;out->objects=1;return;}
 oldx=before->camera_x>>3;oldy=before->camera_y>>3;
 if((((origin_x-oldx)&127)>=21&&((oldx-origin_x)&127)>=21)||(((origin_y-oldy)&127)>=19&&((oldy-origin_y)&127)>=19)){
  region(origin_x,origin_y,21,19);out->count=399;return;
 }
 /* Only entering columns/rows. Fine scroll changes no world tile identity. */
 if(oldx!=origin_x)for(x=0;x<21;x++)if(((origin_x+x-oldx)&127)>=21){region(origin_x+x,origin_y,1,19);service();}
 if(oldy!=origin_y)for(y=0;y<19;y++)if(((origin_y+y-oldy)&127)>=19){region(origin_x,origin_y+y,21,1);service();}
 if(actor_changes())order_changes();
 count_mask();
}
