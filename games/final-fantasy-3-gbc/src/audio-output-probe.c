/* Diagnostic only: candidate output object versus the generic channel path.
 * Compare every ordered register/value byte, not only a rolling hash. */
#pragma bank 9
#include <gb/cgb.h>
#include <gbdk/platform.h>
#include "audio-engine.h"
#include "audio-output.h"
FF3AudioState ff3_state;
volatile uint8_t state_ready,state_start,state_status,state_failure;
volatile uint16_t state_index;
volatile uint32_t state_case;
extern uint8_t reference_pop_seen;
void reference_reset(void);void reference_write(uint8_t,uint8_t);
void reference_sweep(void);void reference_flush(uint8_t);void reference_restore(void);
static uint8_t trace[2][64],counts[2],selected;
uint16_t ff3_pitch_lookup(uint16_t t) NONBANKED {uint8_t saved=CURRENT_BANK,lo,hi;const uint8_t *p=(const uint8_t*)(0x4000u+t*2);if(t>=2048){state_failure=10;return 0;}SWITCH_ROM(6);lo=*p++;hi=*p;SWITCH_ROM(saved);return lo|((uint16_t)hi<<8);}
uint8_t ff3_noise_lookup(uint8_t t) NONBANKED {uint8_t saved=CURRENT_BANK,v;if(t>=16){state_failure=11;return 0;}SWITCH_ROM(6);v=*(const uint8_t*)(0x5000u+t);SWITCH_ROM(saved);return v;}
void ff3_gb_write(uint8_t r,uint8_t v) NONBANKED {uint8_t n=counts[selected];if(n>=64){state_failure=12;return;}trace[selected][n++]=r;trace[selected][n++]=v;counts[selected]=n;}
static void run(void) BANKED {uint16_t rng=0x4317;uint8_t j,r,v,pop;
 for(state_index=0;state_index<8192;state_index++){
  if(!(state_index&63)){ff3_backend_reset();reference_reset();for(j=0;j<24;j++)ff3_state.apu[j]=0;}
  for(j=0;j<8;j++){
   rng=(uint16_t)((rng>>1)^((rng&1)?0xb400u:0));r=(state_index+j*7)%24;v=(uint8_t)rng;
   ff3_state.apu[r]=v;ff3_backend_write(r,v);reference_write(r,v);
   if(ff3_pop_seen!=reference_pop_seen){state_failure=1;state_status=2;return;}
  }
  ff3_backend_sweep();reference_sweep();
  if(state_index&4){ff3_backend_restore();reference_restore();}
  counts[0]=counts[1]=0;pop=(state_index>>3)&1;
  selected=0;ff3_backend_flush(pop);selected=1;reference_flush(pop);
  if(counts[0]!=counts[1])state_failure=2;
  for(j=0;j<counts[0];j++)if(trace[0][j]!=trace[1][j])state_failure=3;
  if(state_failure){state_status=2;return;}state_case++;
 }
 state_status=1;
}
void main(void) NONBANKED {cpu_fast();state_ready=0xa5;while(!state_start){__asm halt __endasm;}run();while(1){__asm halt __endasm;}}
