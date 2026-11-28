/* Native SM83 unit probe. Uses the real banked directory copier, with a
 * transfer recorder instead of an LCD driver. Live video/audio is checked
 * separately in the combined dungeon ROM. Generated source fixtures stay private. */
#include <gb/gb.h>
#include <gb/cgb.h>
#include <string.h>
#include "battle-cell-pool.h"
#include "memory.h"
#include "text-vblank.h"
#include "cell-pool-reference.h"
volatile uint8_t state_ready,state_status,state_failure,state_start;
volatile uint32_t state_case;
volatile uint16_t state_index;
uint8_t __at(0xd950) text_staging[256];
static uint8_t published[864],g[16],erase[8],copies;
static uint16_t first;
void ff3_native_service(void) NONBANKED {}
void ff3_text_copy(uint8_t bank,uint16_t address,const uint8_t*data,uint16_t n) NONBANKED {
 if(bank!=1||address<first||address+n>first+864||!n||n>256||(n&15)){state_failure=2;return;}
 memcpy(published+address-first,data,n);copies++;
}
#define EXPECT(c) do {if(!(c)){state_failure=1;goto done;}state_index++;}while(0)
#ifdef FF3_CELL_POOL_NEGATIVE
#define UNCHANGED 1
#else
#define UNCHANGED 0
#endif
void main(void){uint8_t i,j,r,n,unique,id;const uint8_t*p,*start;cpu_fast();SVBK_REG=1;ff3_memory_init();state_ready=0xa5;while(!state_start)wait_vbl_done();
 memset(g,0,16);memset(erase,0,8);g[0]=3;
 EXPECT(ff3_cell_mask(g,erase)==UNCHANGED&&g[0]==3);erase[0]=1;EXPECT(ff3_cell_mask(g,erase)==2&&g[0]==2);erase[0]=2;EXPECT(ff3_cell_mask(g,erase)==1&&!g[0]);state_case++;state_index=0;
 ff3_cell_pool_reset();first=0x8a00;EXPECT(ff3_cell_pool_begin(160,3,1));g[0]=1;
 EXPECT(ff3_cell_pool_tile(g)==160);EXPECT(ff3_cell_pool_tile(g)==160&&cell_pool_reused==1);
 /* Same rotate-XOR signature: [1,0,...] and [0,2,0,...]. */
 g[0]=0;g[1]=2;EXPECT(ff3_cell_pool_tile(g)==161&&cell_pool_reused==1);g[1]=0;g[0]=3;EXPECT(ff3_cell_pool_tile(g)==162);state_case++;state_index=0;
 g[0]=1;EXPECT(ff3_cell_pool_tile(g)==160&&cell_pool_written==3);g[0]=4;EXPECT(!ff3_cell_pool_tile(g)&&cell_pool_error==4);state_case++;state_index=0;
 ff3_cell_pool_reset();memset(published,0,864);copies=0;first=0x8c00;EXPECT(ff3_cell_pool_begin(192,54,1));
 for(i=0;i<54;i++){g[0]=i+1;EXPECT(ff3_cell_pool_tile(g)==192+i);}EXPECT(ff3_cell_pool_tile(g)==245&&cell_pool_reused==1);EXPECT(ff3_cell_pool_finish());
 EXPECT(copies==4&&cell_pool_written==54&&cell_pool_peak==54);for(i=0;i<54;i++)for(j=0;j<16;j++)EXPECT(published[(uint16_t)i*16+j]==(j?0:i+1));EXPECT(!memory_fault);state_case++;state_index=0;
 first=0x8800;EXPECT(ff3_cell_pool_begin(128,1,1));EXPECT(ff3_cell_pool_tile(g)==128&&cell_pool_written==55&&cell_pool_reused==1);EXPECT(ff3_cell_pool_finish());state_case++;state_index=0;
 EXPECT(ff3_cell_pool_begin(128,1,1));EXPECT(!ff3_cell_pool_begin(129,1,1)&&cell_pool_error==1);state_case++;state_index=0;
 ff3_cell_pool_reset();EXPECT(!ff3_cell_pool_begin(127,1,1));ff3_cell_pool_reset();EXPECT(!ff3_cell_pool_begin(255,2,1));ff3_cell_pool_reset();EXPECT(!ff3_cell_pool_begin(128,55,1));ff3_cell_pool_reset();EXPECT(!ff3_cell_pool_begin(128,0,1));state_case++;state_index=0;
 ff3_cell_pool_reset();EXPECT(!ff3_cell_pool_tile(g)&&cell_pool_error==2);ff3_cell_pool_reset();EXPECT(!ff3_cell_pool_finish()&&cell_pool_error==5);state_case++;
 ff3_cell_pool_reset();first=0x8800;EXPECT(ff3_cell_pool_begin(128,2,0));EXPECT(ff3_cell_pool_tile(g)==128);EXPECT(ff3_cell_pool_tile(g)==129&&cell_pool_reused==0&&cell_pool_written==2);EXPECT(ff3_cell_pool_finish());state_case++;
 SWITCH_ROM(17);p=pool_reference;for(r=0;r<POOL_REFERENCE_CASES;r++){
  state_index=0;n=*p++;unique=*p++;start=p;ff3_cell_pool_reset();first=0x8a00;EXPECT(ff3_cell_pool_begin(160,54,1));
  for(i=0;i<n;i++){memcpy(g,p,16);p+=16;id=*p++;EXPECT(ff3_cell_pool_tile(g)==id);}
  EXPECT(ff3_cell_pool_finish());EXPECT(cell_pool_written==unique&&cell_pool_reused==n-unique);
  for(i=0;i<n;i++){id=start[16];EXPECT(!memcmp(published+(uint16_t)(id-160)*16,start,16));start+=17;}state_case++;
 }
 done:state_status=state_failure?2:1;while(1)wait_vbl_done();
}
