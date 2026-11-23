#pragma bank 9
#include <string.h>
#include "exploration.h"
#include "game-state.h"
#include "platform.h"
#include "exploration-config.h"
volatile FF3Exploration __at(0xdb70) field;
typedef char field_reservation[sizeof(FF3Exploration)<=80?1:-1];
void ff3_field_front(void) BANKED {
 uint8_t x=7,y=7,d=field.direction;
 if(d&1)x=8;else if(d&2)x=6;else if(d&4)y=8;else y=6;
 field.target_x=(field.x+x)&63;field.target_y=(field.y+y)&63;
}
/* E3F1: reserved position blocks. The second physical-position pass merely
 * sets the contact flag; it deliberately returns carry clear. */
uint8_t ff3_field_touch(void) BANKED {
 uint8_t i,z,x,y;field.slot=0xff;
 for(i=0;i<192;i+=16){z=object_part2[i+6];if(z&&field.z&&z!=field.z)continue;
  if(object_part1[i]&&object_part1[i+2]==field.target_x&&object_part1[i+3]==field.target_y){object_part1[i+11]&=3;object_part1[i+13]=1;field.slot=i;return 1;}}
 for(i=0;i<192;i+=16){z=object_part2[i+6];if(z&&field.z&&z!=field.z)continue;if(!object_part1[i])continue;
  x=object_part1[i+4];y=object_part1[i+5];if(object_part1[i+8]&128)x=(x+1)&63;else if(object_part1[i+9]&128)y=(y+1)&63;
  if(x==field.target_x&&y==field.target_y){object_part1[i+13]=1;field.slot=i;return 0;}}
 return 0;
}
/* E494: half-tile rounding and elevation-3 exception are specific to talk. */
uint8_t ff3_field_talk(void) BANKED {
 uint8_t i,z,x,y;field.slot=0xff;
 for(i=0;i<192;i+=16){z=object_part2[i+6];if(z&&z!=3&&field.z&&z!=field.z)continue;if(!object_part1[i])continue;
  x=(object_part1[i+4]+(object_part1[i+6]>=8))&63;y=(object_part1[i+5]+(object_part1[i+7]>=8))&63;
  if(x==field.target_x&&y==field.target_y){if(!(object_part1[i+1]&0x30))object_part1[i+13]|=128;field.slot=i;return 1;}}
 return 0;
}
static uint8_t blocked(void){field.property=0;field.trigger=0;field.next=field.current;return 0;}
/* E3B4..E3EF, independently callable for original-code fixtures. */
uint8_t ff3_field_terrain(void) BANKED {
 uint8_t k=field.next&7;if(!k){field.z=0;return 1;}if(k>=4)return 1;
 if(k==3||(k|field.z)==3)return blocked();field.z|=k;return 1;
}
static void properties(void){uint8_t t;
 t=((field.target_x|field.target_y)&32)?map_workspace.properties[3]:map_workspace.tiles[(uint16_t)field.target_y*32+field.target_x];
 if(t>=128){field.error=1;return;}
 field.next=map_workspace.collision[(uint16_t)t*2];field.property=map_workspace.collision[(uint16_t)t*2+1];
}
/* E58F/E5BB/E5F9/E630: negative movement changes the tile at the first pixel. */
void ff3_field_pixel(void) BANKED {
 uint8_t d=field.direction,s=field.speed;if(!s)return;
 if(d&1){field.subx=(field.subx+s)&15;if(!field.subx){field.speed=0;field.x=(field.x+1)&63;}}
 else if(d&2){if(!field.subx)field.x=(field.x-1)&63;field.subx=(field.subx-s)&15;if(!field.subx)field.speed=0;}
 else if(d&4){field.suby=(field.suby+s)&15;if(!field.suby){field.speed=0;field.y=(field.y+1)&63;}}
 else{if(!field.suby)field.y=(field.y-1)&63;field.suby=(field.suby-s)&15;if(!field.suby)field.speed=0;}
 if((field.subx|field.suby)==8)field.current=((field.next&4)&&(field.z&1))?0:field.next&0x34;
 if(!field.speed)field.steps++;
}
void ff3_field_init(void) BANKED {
 memset((void*)&field,0,sizeof(field));field.world=FIELD_WORLD;field.map=FIELD_MAP;field.rate=FIELD_RATE;
 field.x=(FIELD_START_X-7)&63;field.y=(FIELD_START_Y-7)&63;field.direction=8;field.face=0xff;
 field.target_x=FIELD_START_X;field.target_y=FIELD_START_Y;properties();field.z=field.next&3;field.current=field.next&0x34;field.next=field.current;field.property=0;
}
void ff3_field_tick(void) BANKED {
 uint8_t d,r;field.ticks++;
 if(field.speed){ff3_field_pixel();if(field.speed)return;}
 /* E32E checks the previously latched A before D219 polls directions. */
 if(field.pressed&0x80){field.pressed=0;ff3_field_front();
  if(ff3_field_talk()){field.face=field.slot;field.mode=1;field.talks++;return;}
  properties();if(field.next&128)field.error=2;field.next=field.current;return;
 }
 field.pressed=field.keys&~field.previous;field.previous=field.keys;
 /* B item/guest, Start menu and Select party cycling need their own original
  * consumers. Never reinterpret them as ordinary-NPC dialogue. */
 if(field.pressed&0x70){field.error=3;return;}
 d=field.keys&15;if(!d)return;field.direction=d;ff3_field_front();
 if(ff3_field_touch()){blocked();field.blocked++;return;}
 properties();if(field.error)return;
 if(field.next&128){field.error=2;return;}
 if(field.next&64){r=ff3_field_random((FF3FieldRng*)&field.rng_index);if(r<field.rate){field.error=4;return;}}
 if(!ff3_field_terrain()){field.blocked++;return;}
 /* Poison/floor damage and guest following are pending consumers. */
 if(((ff3_game_state[0x102]|ff3_game_state[0x142]|ff3_game_state[0x182]|ff3_game_state[0x1c2])&2)||((field.next&8)&&!field.property)){field.error=5;return;}
 ff3_game_state[0x21]&=0xbf;field.speed=1;
}
