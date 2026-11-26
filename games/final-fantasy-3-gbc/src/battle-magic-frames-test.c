#include <gb/gb.h>
#include <gb/cgb.h>
#include <string.h>
#include "battle-magic-frames.h"
#include "battle-select-fixture.h"
volatile uint8_t state_ready,state_status,state_failure,state_start;
volatile uint32_t state_case;
volatile uint16_t state_index;
static uint8_t bank=17,in[9],out[257],before[256];
static Ff3MagicSequence seq,saved;
static const uint8_t*position=(const uint8_t*)0x4000;
static uint8_t byte(void){uint8_t v;SWITCH_ROM(bank);v=*position++;if(position==(const uint8_t*)0x8000){bank++;position=(const uint8_t*)0x4000;}return v;}
void main(void){uint16_t i,n;uint8_t k,ok,decoded[2];cpu_fast();state_ready=0xa5;while(!state_start)wait_vbl_done();
 for(state_case=0;state_case<SELECT_CASES;state_case++){
  for(i=0;i<9;i++)in[i]=byte();memset(out,0xa5,sizeof(out));
  if(!in[0]){
   n=256;for(i=0;i<96;i++)out[160+i]=(uint8_t)(i*37+11);
   if(!ff3_magic_frame((Ff3MagicFrame*)(in+1),out)){state_failure=2;break;}
   memcpy(before,out,256);if(in[3])ff3_magic_priority(out);
  }else{
   n=6;if(!ff3_magic_begin(&seq,in[1],in[2])){state_failure=2;break;}
   decoded[0]=decoded[1]=0xa5;ok=0;
   for(k=0;k<=in[3];k++)ok=ff3_magic_next(&seq,decoded);
   out[0]=ok;out[1]=decoded[0];out[2]=decoded[1];out[3]=seq.index;out[4]=seq.length;out[5]=seq.index==seq.length+1;
  }
  for(i=0;i<n;i++)if(out[i]!=byte()&&!state_failure){state_failure=1;state_index=i;}
  for(i=n;i<257;i++)if(out[i]!=0xa5)state_failure=3;
  if(!in[0]){
   if(in[3])ff3_magic_priority(out);if(memcmp(before,out,256))state_failure=4;
   in[2]=2;if(ff3_magic_frame((Ff3MagicFrame*)(in+1),out)||memcmp(before,out,256))state_failure=5;
  }else{
   saved=seq;if(ff3_magic_begin(&seq,88,0)||ff3_magic_begin(&seq,0,1)||memcmp(&saved,&seq,sizeof(seq)))state_failure=6;
   seq.index=0;saved=seq;decoded[0]=37;decoded[1]=91;
   if(ff3_magic_next(&seq,decoded)!=255||memcmp(&saved,&seq,sizeof(seq))||decoded[0]!=37||decoded[1]!=91)state_failure=7;
  }
  if(state_failure)break;
 }
 state_status=state_failure?2:1;while(1)wait_vbl_done();
}
