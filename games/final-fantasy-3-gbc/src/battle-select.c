/* Line-by-line control-flow port: 32/9B8C..9EAC; 34/89EE..8A7F;
 * 3F/FBC6..FBEE. Tables below are extracted from this ROM, never redrawn. */
#include "battle-select.h"
#include "battle-select-tables.h"
static uint8_t valid_cell(const Ff3Target *s,const Ff3TargetEnv *e){uint8_t i=e->layout[(s->b0&1)*4+s->af];return i!=255&&e->monsters[i]!=255;}
static void inc_cell(Ff3Target *s){s->b0=(s->b0+1)&1;if(!s->b0)s->af++;}
static void dec_cell(Ff3Target *s){s->b0=(s->b0-1)&1;if(s->b0)s->af--;}
static void monster(Ff3Target *s,const Ff3TargetEnv *e){s->ad=ff3_target_bits[e->layout[s->b0*4+s->af]];s->ae=s->b1=0;}
static void party(Ff3Target *s,const Ff3TargetEnv *e){s->b2&=3;while(e->party[s->b2]==255||e->excluded[s->b2])s->b2=(s->b2+1)&3;s->af=3;s->b0=1;s->ae=ff3_party_bits[s->b2];s->ad=0;s->b1=4;}
static void all_party(Ff3Target *s,const Ff3TargetEnv *e){uint8_t i;s->ad=s->ae=0;s->b1=5;for(i=0;i<4;i++)s->ae=(s->ae<<1)|(e->party[i]!=255&&!e->excluded[i]);s->ae<<=4;}
static void all_monsters(Ff3Target *s,const Ff3TargetEnv *e){uint8_t i;s->ad=s->ae=s->af=s->b0=s->b2=0;s->b1=1;for(i=0;i<8;i++)s->ad=(s->ad<<1)|(e->monsters[i]!=255);}
static void group(Ff3Target *s,const Ff3TargetEnv *e,uint8_t mode){uint8_t i,type=e->monsters[e->layout[s->b0*4+s->af]];s->b1=mode;s->ad=s->ae=0;for(i=0;i<8;i++)s->ad=(s->ad<<1)|(e->monsters[i]==type);}
/* Names refer to source routines, not screen direction (back attack swaps it). */
static void sub9c80(Ff3Target *s,const Ff3TargetEnv *e){
 if(s->b1==5){party(s,e);return;}
 if(s->b1==4){s->af=3;s->b0=1;while(!valid_cell(s,e))dec_cell(s);monster(s,e);return;}
 if(s->b1!=0&&s->b1!=2&&s->b1!=3)return;
 if(!s->af){s->b0=s->af=0;all_monsters(s,e);return;}
 s->af--;if(valid_cell(s,e)){monster(s,e);return;}
 s->b0=1;for(;;){if(valid_cell(s,e)){monster(s,e);return;}dec_cell(s);if(s->af==255){s->b0=s->af=0;all_monsters(s,e);return;}}
}
static void sub9cdc(Ff3Target *s,const Ff3TargetEnv *e){
 if(s->b1==1){s->af=s->b0=0;while(!valid_cell(s,e))inc_cell(s);monster(s,e);return;}
 if(s->b1==4){all_party(s,e);return;}
 if(s->b1!=0&&s->b1!=2&&s->b1!=3)return;
 if(s->af==3){party(s,e);return;}s->af++;
 if(valid_cell(s,e)){monster(s,e);return;}s->b0=0;
 for(;;){if(valid_cell(s,e)){monster(s,e);return;}inc_cell(s);if(s->af==4){party(s,e);return;}}
}
static void up(Ff3Target *s,const Ff3TargetEnv *e){
 if(s->b1==3){monster(s,e);return;}
 if(s->b1==4){do{s->b2=(s->b2-1)&3;}while(e->party[s->b2]==255||e->excluded[s->b2]);party(s,e);return;}
 if(s->b1)return;
 if(s->b0){s->b0--;if(valid_cell(s,e)){monster(s,e);return;}s->b0++;}group(s,e,2);
}
static void down(Ff3Target *s,const Ff3TargetEnv *e){
 if(s->b1==2){monster(s,e);return;}
 if(s->b1==4){do{s->b2=(s->b2+1)&3;}while(e->party[s->b2]==255||e->excluded[s->b2]);party(s,e);return;}
 if(s->b1)return;
 if(!s->b0){s->b0++;if(valid_cell(s,e)){monster(s,e);return;}s->b0--;}group(s,e,3);
}
uint8_t ff3_target_valid(const Ff3TargetEnv *e){uint8_t i,a=0,b=0;for(i=0;i<8;i++){if(e->layout[i]!=255){if(e->layout[i]>=8)return 0;if(e->monsters[e->layout[i]]!=255)a=1;}}for(i=0;i<4;i++)if(e->party[i]!=255&&!e->excluded[i])b=1;return a&&b;}
void ff3_target_begin(Ff3Target *s,const Ff3TargetEnv *e,uint8_t flags){s->af=s->b0=s->b2=0;s->b3=flags&1;s->b1=(flags&2)?5:4;sub9c80(s,e);}
void ff3_target_input(Ff3Target *s,const Ff3TargetEnv *e,uint8_t buttons){uint8_t old[5],i;
 old[0]=s->ad;old[1]=s->ae;old[2]=s->af;old[3]=s->b0;old[4]=s->b1;
 if(buttons&240)s->sound=0x98;
 switch(buttons){
 case 128:if(e->back)sub9c80(s,e);else sub9cdc(s,e);break;
 case 64:if(e->back)sub9cdc(s,e);else sub9c80(s,e);break;
 case 32:down(s,e);break;
 case 16:up(s,e);break;
 case 1:s->sound=0x85;if(s->ad){s->b4=s->ad;s->b5=0xc0;}else{s->b4=s->ae&240;s->b5=0x40;}
  for(i=0;i<8;i++)if(s->b4==ff3_target_bits[i]){s->b5&=0xbf;break;}
  s->selected=s->ad;s->ad=s->ae=0;break;
 case 2:s->ad=s->ae=s->b4=s->b5=s->selected=0;break;
 }
 /* 9B8C rejects multi-target modes for an attack. B2, B4/B5 and the sound
  * request are deliberately NOT restored: that is the original stack scope. */
 if(!s->b3&&(s->b1==1||s->b1==2||s->b1==3||s->b1==5)){s->ad=old[0];s->ae=old[1];s->af=old[2];s->b0=old[3];s->b1=old[4];}
}
uint8_t ff3_command_cursor(uint8_t row,uint8_t missing,uint8_t buttons){uint8_t key=buttons&((uint8_t)(~buttons)+1);if(key==16){if(!row)return 3;row--;if(row==2&&missing)row--;}
 else if(key==32){if(row==3)return 0;row++;if(row==2&&missing)row++;}return row;}
uint8_t ff3_input_repeat(uint8_t previous,uint8_t held,uint8_t *counter){if(!(previous|held)){*counter=8;return 0;}if(previous&held){(*counter)--;if(!*counter){*counter=4;return held;}}return (~previous)&held;}
