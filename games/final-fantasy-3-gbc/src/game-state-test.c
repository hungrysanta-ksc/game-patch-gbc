#include <stdio.h>
#include <string.h>
#include "game-state.h"
#ifdef STATE_HOST
#include <stdlib.h>
static FILE *fixture;
static uint8_t byte(void){int v=fgetc(fixture);if(v<0){fprintf(stderr,"Truncated state fixture\n");exit(3);}return (uint8_t)v;}
#else
#include <gb/cgb.h>
static uint8_t bank=11;static const uint8_t *position=(const uint8_t*)0x4000;
static uint8_t byte(void){uint8_t v=*position++;if(position==(const uint8_t*)0x8000){bank++;SWITCH_ROM(bank);position=(const uint8_t*)0x4000;}return v;}
#endif
volatile uint8_t state_ready,state_status,state_failure,state_command,state_slot,state_result,state_start;
volatile uint32_t state_case;
volatile uint16_t state_index,state_offset;
uint8_t state_buffer[1024];
static FF3BattleRng battle;
static FF3FieldRng field;
static uint8_t zp[256],counter[3],pos[4];
static void read_bytes(uint8_t *p,uint16_t n){uint16_t i;for(i=0;i<n;i++)p[i]=byte();}
static void fail(uint8_t kind,uint16_t index){if(!state_failure){state_failure=kind;state_index=index;}}
static void compare(const uint8_t *p,uint16_t n,uint8_t kind){uint16_t i;for(i=0;i<n;i++){uint8_t expected=byte();if(p[i]!=expected){
#ifdef STATE_HOST
 if(!state_failure)printf("Expected %02x actual %02x\n",expected,p[i]);
#endif
 fail(kind,i);}}}
static void run(void){uint8_t op,a,b,c,result,ok;
 while((op=byte())!=0){
  switch(op){
   case 1:memset(state_buffer,byte(),1024);ff3_state_init(state_buffer);compare(state_buffer,1024,1);break;
   case 2:read_bytes(state_buffer,1024);read_bytes(pos,4);ff3_state_seal(state_buffer,pos);compare(state_buffer,1024,2);break;
   case 3:read_bytes(state_buffer,1024);result=ff3_state_valid(state_buffer);compare(&result,1,3);break;
   case 4:field.index=byte();field.direction=byte();result=ff3_field_random(&field);compare(&result,1,4);compare(&field.index,1,4);compare(&field.direction,1,4);break;
   case 5:read_bytes(zp,256);a=byte();b=byte();ff3_battle_seed(&battle,zp,a,b);compare(battle.table,256,5);compare(battle.counter,3,5);break;
   case 6:a=byte();b=byte();c=byte();read_bytes(battle.counter,3);result=0xa5;ok=ff3_battle_random(&battle,a,b,c,&result);compare(&ok,1,6);compare(&result,1,6);compare(battle.counter,3,6);break;
   case 7:read_bytes(state_buffer,1024);read_bytes(counter,3);read_bytes(pos,4);ff3_save_menu_prepare(state_buffer,counter,pos);compare(state_buffer,1024,7);compare(counter,3,7);break;
   case 8:read_bytes(counter,3);ff3_save_count_commit(counter);compare(counter,3,8);break;
   default:fail(9,op);
  }
#ifndef STATE_HOST
  if(CURRENT_BANK!=bank)fail(10,CURRENT_BANK);
#endif
  if(state_failure)break;state_case++;
 }
 state_status=state_failure?2:1;
 printf("STATE %lu ERROR %u INDEX %u\n",(unsigned long)state_case,state_failure,state_index);
}
#ifdef STATE_HOST
int main(int argc,char **argv){if(argc!=2)return 2;fixture=fopen(argv[1],"rb");if(!fixture)return 2;run();fclose(fixture);return state_failure?1:0;}
#else
void main(void){uint8_t ram_bank;cpu_fast();NR52_REG=0;SVBK_REG=1;rROMB1=0;DISABLE_RAM;SWITCH_ROM(bank);state_ready=0xa5;
 while(!state_start)wait_vbl_done();if(state_start==1)run();else state_status=1;
 while(1){if(state_command){
  if(state_command==1)state_result=ff3_save_write(state_slot,state_buffer);
  else if(state_command==2)state_result=ff3_save_read(state_slot,state_buffer);
  /* Negative-control write belongs only to this test ROM. */
  else if(state_command==3&&state_offset<3072){ENABLE_RAM;SWITCH_RAM(0);((volatile uint8_t*)0xa000)[state_offset]^=1;DISABLE_RAM;state_result=1;}
  else if(state_command==4&&state_offset<=31744u){ENABLE_RAM;SWITCH_RAM((uint8_t)(state_offset>>13));memcpy(state_buffer,(const void*)(0xa000u+(state_offset&8191u)),1024);SWITCH_RAM(0);DISABLE_RAM;state_result=1;}
  else if(state_command==5){ENABLE_RAM;for(ram_bank=0;ram_bank<4;ram_bank++){SWITCH_RAM(ram_bank);memset((void*)0xa000,0xcc,8192);}SWITCH_RAM(0);DISABLE_RAM;state_result=1;}
  else state_result=0;
  if(CURRENT_BANK!=bank){state_failure=10;state_status=2;}state_command=0;
 }wait_vbl_done();}
}
#endif
