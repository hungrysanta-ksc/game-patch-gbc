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
static uint8_t published[864],g[16],erase[8],ink[16],expected[16],copies;
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
void main(void){uint8_t i,j,r,n,unique,id,old,v,owned;const uint8_t*p,*start;cpu_fast();SVBK_REG=1;ff3_memory_init();state_ready=0xa5;while(!state_start)wait_vbl_done();
 memset(g,0,16);memset(erase,0,8);g[0]=3;
 EXPECT(ff3_cell_mask(g,erase)==UNCHANGED&&g[0]==3);erase[0]=1;EXPECT(ff3_cell_mask(g,erase)==2&&g[0]==2);erase[0]=2;EXPECT(ff3_cell_mask(g,erase)==1&&!g[0]);
 /* Every bit position, both planes and mask truth values; check every row
  * and untouched byte, including a zero plane and a surviving other row. */
 for(i=0;i<8;i++)for(j=0;j<8;j++)for(r=0;r<8;r++){
  memset(g,0,16);memset(erase,0,8);g[j*2]=(r&1)?1u<<i:0;g[j*2+1]=(r&2)?1u<<i:0;erase[j]=(r&4)?1u<<i:0;
  n=(r&4)&&(r&3);EXPECT(ff3_cell_mask(g,erase)==(n?1:0));
  for(id=0;id<16;id++)EXPECT(g[id]==((id==j*2&&(r&1)&&!n)||(id==j*2+1&&(r&2)&&!n)?1u<<i:0));
 }state_case++;state_index=0;
 /* All 4x4 pixel-color pairs, 64 positions and both ownership choices.
  * The independent expected pixels include clearing an owned zero. */
 for(i=0;i<8;i++)for(j=0;j<8;j++)for(old=0;old<4;old++)for(v=0;v<4;v++)for(owned=0;owned<2;owned++){
  memset(g,0,16);memset(ink,0,16);memset(erase,0,8);memset(expected,0,16);
  g[j*2]=(old&1)?1u<<i:0;g[j*2+1]=(old&2)?1u<<i:0;
  ink[j*2]=(v&1)?1u<<i:0;ink[j*2+1]=(v&2)?1u<<i:0;erase[j]=owned?1u<<i:0;
  n=owned?v:old;expected[j*2]=(n&1)?1u<<i:0;expected[j*2+1]=(n&2)?1u<<i:0;
  EXPECT(ff3_cell_paint(g,ink,erase)==(n==old?0:n?2:1));EXPECT(!memcmp(g,expected,16));
 }state_case++;state_index=0;
 SWITCH_ROM(17);p=paint_reference;for(r=0;r<PAINT_REFERENCE_CASES;r++){
  memcpy(g,p,16);memcpy(ink,p+16,16);memcpy(erase,p+32,8);memcpy(expected,p+40,16);n=p[56];p+=57;
  EXPECT(ff3_cell_paint(g,ink,erase)==n);EXPECT(!memcmp(g,expected,16));
 }state_case++;state_index=0;
 ff3_cell_pool_reset();memset(g,0,16);first=0x8a00;EXPECT(ff3_cell_pool_begin(160,3,1));g[0]=1;
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
