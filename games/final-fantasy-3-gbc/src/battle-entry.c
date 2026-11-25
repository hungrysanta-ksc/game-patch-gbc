#ifndef STATE_HOST
#pragma bank 16
#endif
#include "battle-entry.h"
#include "battle-entry-assets.h"
typedef char entry_abi[(sizeof(Ff3EntryDisplay)==39)?1:-1];
/* 2F/AE39,AE5E. These are next logical scroll values, not an already
 * applied GBC SCX. Original raster split/publication order is adapter-owned. */
static void scroll(Ff3EntryDisplay*s){
 if(s->menu_remaining){s->menu_scroll+=16;if(!--s->menu_remaining)s->menu_table&=254;}
 if(s->battle_type==0x88){if(s->enemy_scroll){s->enemy_scroll+=16;s->enemy_table|=1;}else s->enemy_table&=254;}
 else if(s->enemy_scroll)s->enemy_scroll-=16;
}
/* 33/BD45,BE89. Do not replace small/confused/dead movement with a lerp.
 * A destination hit retains the current pose and Y, exactly as the source. */
void ff3_entry_motion(Ff3EntryDisplay*s) FF3_STATE_BANKED {uint8_t i,f=s->frame;
 for(i=0;i<4;i++)if(s->x[i]!=s->destination[i]){
  if(s->status[i]&4){s->y[i]+=ff3_entry_toad_y[f&7];s->pose[i]=ff3_entry_toad_pose[f&7];s->x[i]-=2;}
  else {s->pose[i]=((f&4)>>2)+((s->status[i]&1)?10:1);
   if(!s->confused_position[i]&&(s->status[i]&8))s->pose[i]^=128;
   s->x[i]-=(s->status[i]&1)?1:2;}
 }s->frame++;
}
uint8_t ff3_entry_start(Ff3EntryDisplay*s) FF3_STATE_BANKED {uint8_t i,back=s->battle_type==0x88;
 if(s->phase)return 0;
 for(i=0;i<4;i++){
  s->x[i]=ff3_entry_initial[(back?8:0)+i];s->y[i]=ff3_entry_initial[(back?8:0)+4+i];
  s->destination[i]=ff3_entry_rows[(back?2:0)+(s->rows[i]&1)];
  if(s->status[i]&192){s->x[i]=s->destination[i];s->pose[i]=0;}
  else s->pose[i]=(s->status[i]&5)?11:2;
 }
 s->frame=0;s->enemy_scroll=back?16:240;s->mask=s->row=s->ticket=0;s->phase=FF3_ENTRY_INITIAL;return 1;
}
uint8_t ff3_entry_ack(Ff3EntryDisplay*s,uint8_t ticket) FF3_STATE_BANKED {uint8_t i;
 if(ticket!=s->ticket||s->phase<FF3_ENTRY_INITIAL||s->phase>=FF3_ENTRY_TAIL)return 0;
 if(s->phase==FF3_ENTRY_INITIAL){scroll(s);s->phase=FF3_ENTRY_TERRAIN;}
 else if(s->phase==FF3_ENTRY_TERRAIN){scroll(s);ff3_entry_motion(s);
  if(++s->row==4){s->row=0;if(++s->mask==7){ff3_entry_motion(s);s->phase=FF3_ENTRY_WALK;}}
 }else {for(i=0;i<4;i++)if(s->x[i]!=s->destination[i])break;
  if(i==4)s->phase=FF3_ENTRY_TAIL;else ff3_entry_motion(s);
 }s->ticket++;return 1;
}
uint8_t ff3_entry_terrain(const Ff3EntryDisplay*s,const uint8_t*terrain,uint8_t*out) FF3_STATE_BANKED {uint8_t i;
 if(s->phase!=FF3_ENTRY_TERRAIN||s->mask>=7||s->row>=4)return 0;
 terrain+=(uint16_t)s->row*64;
 for(i=0;i<64;i++)out[i]=terrain[i]&ff3_entry_masks[(s->mask<<3)+(i&7)];
 return 1;
}
