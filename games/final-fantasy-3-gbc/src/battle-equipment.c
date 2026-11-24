#pragma bank 15
#include "battle-equipment.h"
/* B242 compares the incoming item against the other hand. Original IDs:
 * 46..49 harps, 4A..4E bows, 4F..56 arrows, 58..61 shields. */
static uint8_t pair_ok(uint8_t a,uint8_t b){uint8_t t;if(a<b){t=a;a=b;b=t;}
 if(!a)return 1;if(a>=0x62)return 0;
 if(a>=0x58)return !b||b>=0x58||b<0x46;
 if(a>=0x4f)return !b||(b>=0x4a&&b<0x4f);
 if(a>=0x46)return !b;return 1;
}
uint8_t ff3_equipment_swap(uint8_t *bag,uint8_t *e,Ff3ItemCursor *s,uint8_t eligible) BANKED {
 uint8_t reverse=s->column!=0,row=reverse?s->saved_row:s->row,col=reverse?s->column:s->saved_column;
 uint8_t br=reverse?s->row:s->saved_row,slot,hand,old,oldqty,id,qty,other,free=32,i,n;
 if(!col||col>8||br>3||(row!=1&&row!=3)||!eligible)return 0;
 slot=(col-1)*4+br;hand=row==1?3:5;old=e[hand];oldqty=e[hand+1];id=bag[slot];qty=bag[32+slot];
 /* Source compares duplicated initial hand IDs by value, not by selected
  * hand index. Equal two-hand IDs therefore retain the original behavior. */
 other=e[3]==old?e[5]:e[3];if(id>=0x62||!pair_ok(id,other))return 0;
 if(old==id){if(!id)return 0;e[hand]=e[hand+1]=0;n=qty+oldqty;bag[32+slot]=n>=100?99:n;}
 else if(qty==1||!id||(id>=0x4f&&id<0x57&&qty<21)){
  bag[slot]=old;bag[32+slot]=oldqty;e[hand]=id;e[hand+1]=qty;
 }else{
  for(i=0;i<32;i++)if(!bag[i]){free=i;break;}if(old&&free==32)return 0;
  if(old){bag[free]=old;bag[32+free]=oldqty;}
  n=id>=0x4f&&id<0x57?20:1;e[hand]=id;e[hand+1]=n;bag[32+slot]=qty-n;
 }
 /* B15B swaps columns back but leaves normalized rows after success. */
 if(reverse){i=s->row;s->row=s->saved_row;s->saved_row=i;}return 1;
}
