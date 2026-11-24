#include "battle-items.h"
void ff3_item_begin(Ff3ItemCursor *s){s->row=s->selected=0;s->column=s->scroll=1;}
/* 35/AE9D..AF9C and B198..B1AE. Unlike the command menu, this compares
 * exact button bytes. Scroll endpoints only; six-frame PPU motion is a
 * separate renderer consumer, not an instantaneous-animation claim. */
uint8_t ff3_item_input(Ff3ItemCursor *s,uint8_t key){
 if(key==16){if(!s->column){if(s->row==1)return 0;s->row--;}if(s->row)s->row--;}
 else if(key==32){if(s->row==3)return 0;if(!s->column)s->row++;s->row++;}
 else if(key==64){if(!s->column)return 0;if(s->scroll==s->column)s->scroll--;if(!--s->column)s->row|=1;}
 else if(key==128){if(s->column==8)return 0;if(s->scroll!=7&&s->scroll!=s->column)s->scroll++;s->column++;}
 else if(key==1){if(!s->selected){s->selected=1;s->saved_row=s->row;s->saved_column=s->column;}
  else if(s->row==s->saved_row&&s->column==s->saved_column)return FF3_ITEM_USE;
  else if((!s->column)!=(!s->saved_column))return FF3_ITEM_EQUIP;
  else return FF3_ITEM_ERROR;
 }else if(key==2){if(s->selected)s->selected--;else return FF3_ITEM_CLOSE;}
 return FF3_ITEM_STAY;
}
