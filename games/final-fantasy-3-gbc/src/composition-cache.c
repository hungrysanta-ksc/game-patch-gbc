#include <gb/cgb.h>
#include <string.h>
#include "platform.h"
#include "memory.h"
#include "text-vblank.h"
#include "composition-kernel.h"
#include "composition-cache.h"
#include "cache-assets.h"
void ff3_native_begin(void) NONBANKED;
void ff3_native_service(void) NONBANKED;
uint16_t __at(0xd000) cache_keys[128];
uint8_t __at(0xd100) cache_pins[128];
uint16_t __at(0xd180) cache_previous[360];
uint8_t __at(0xd450) cache_slots[360];
uint8_t __at(0xd5b8) cache_attrs[360];
uint8_t __at(0xd720) cache_masks[128];
uint8_t __at(0xd800) cache_input[FF3_CELL_INPUT_MAX];
uint16_t __at(0xdba0) cache_objkeys0[40];
uint16_t __at(0xdca0) cache_objkeys1[40];
volatile uint8_t cache_ready,cache_request,cache_page,cache_error;
volatile uint8_t cache_phase;
volatile uint16_t cache_frames,cache_hits,cache_misses,cache_evictions,cache_composed,cache_static,cache_dirty;
static uint8_t active_page,active_group=255,hand;
/* Immutable input IDs index a bounded lookup table. Eviction removes its
 * backlink before replacing the slot; zero means absent, slot+1 means hit. */
static uint8_t lookup[CACHE_JOB_COUNT];
static uint16_t dirty_maps[2]={1023,1023};
static uint8_t object_slots[40],object_planes[40];
static CacheFrame frame;
static CacheJob job;
static uint16_t offset(uint8_t slot){return (uint16_t)(slot&63)*48;}
static uint8_t storage(uint8_t slot){return 3+(slot>>6);}
static uint8_t acquire(uint16_t key){uint8_t i,slot;
 if(lookup[key]){slot=lookup[key]-1;if(cache_keys[slot]!=key){cache_error=7;return 0;}cache_hits++;cache_pins[slot]|=2;return slot;}
 for(i=0;i<128;i++){slot=hand;hand=(hand+1)&127;if(!cache_pins[slot])break;}
 if(i==128){cache_error=1;return 0;}
 if(cache_keys[slot]!=65535u){lookup[cache_keys[slot]]=0;cache_evictions++;}cache_misses++;
 SWITCH_ROM(7);memcpy(&job,&cache_jobs[key],sizeof(job));
 if(job.size>FF3_CELL_INPUT_MAX){cache_error=2;return 0;}
 SWITCH_ROM(job.bank);
 if(job.is_static){if(job.size!=48){cache_error=2;return 0;}memcpy(text_staging,job.data,48);cache_static++;}
 else{memcpy(cache_input,job.data,job.size);ff3_native_service();cache_error=ff3_compose_cell(cache_input,job.size,text_staging);cache_composed++;if(cache_error)return 0;}
 ff3_native_service();cache_masks[slot]=0;for(i=0;i<16;i++){if(text_staging[16+i])cache_masks[slot]|=1;if(text_staging[32+i])cache_masks[slot]|=2;}
 if(!ff3_wram_copy(storage(slot),offset(slot),text_staging,48,1)){cache_error=3;return 0;}
 ff3_text_copy(0,0x8000u+(uint16_t)slot*16,text_staging,16);
 cache_keys[slot]=key;cache_pins[slot]=2;lookup[key]=slot+1;return slot;
}
static void maps(uint8_t page){uint8_t bank,row,n,rows,block=0;uint16_t address,bytes,bit;
 for(bank=0;bank<2;bank++)for(row=0;row<18;row+=4){
  bit=1u<<block++;if(!(dirty_maps[page]&bit))continue;
  rows=row<16?4:2;bytes=(uint16_t)rows*32;memset(text_staging,0,bytes);
  for(n=0;n<rows;n++)memcpy(text_staging+(uint16_t)n*32,(bank?cache_attrs:cache_slots)+(uint16_t)(row+n)*20,20);
  address=(page?0x9c00u:0x9800u)+(uint16_t)row*32;ff3_text_copy(bank,address,text_staging,bytes);dirty_maps[page]&=~bit;
  ff3_native_service();
 }
}
static void objects(uint8_t page){uint16_t cell,key,*keys=page?cache_objkeys1:cache_objkeys0;uint8_t slot,p,mask,count=0,batch,first,n,dirty=0,*oam=page?cache_oam1:cache_oam0;
 memset(oam,0,160);
 for(cell=0;cell<360;cell++){slot=cache_slots[cell];mask=cache_masks[slot];if(mask)for(p=0;p<2;p++)if(mask&(1<<p)){
  if(count>=40){cache_error=4;return;}
  oam[count*4]=((cell/20)*8)+16;oam[count*4+1]=((cell%20)*8)+8;oam[count*4+2]=page*64+count;oam[count*4+3]=8+p;
  key=cache_keys[slot]*2+p;if(keys[count]!=key){dirty|=1<<(count>>4);keys[count]=key;}
  object_slots[count]=slot;object_planes[count]=p;count++;
 }if((cell&15)==15)ff3_native_service();}
 for(first=0;first<count;first+=16){if(!(dirty&(1<<(first>>4))))continue;batch=count-first;if(batch>16)batch=16;
  for(n=0;n<batch;n++){slot=object_slots[first+n];p=object_planes[first+n];if(!ff3_wram_copy(storage(slot),offset(slot)+16+(uint16_t)p*16,text_staging+(uint16_t)n*16,16,0)){cache_error=3;return;}ff3_native_service();}
  ff3_text_copy(1,0x8000u+(uint16_t)(page*64+first)*16,text_staging,(uint16_t)batch*16);
 }
}
static void show(void){uint16_t cell,key,bit;uint8_t row,col,i,slot,attr,attrs_changed=0,page=active_page^1;
 if(cache_page>=CACHE_FRAME_COUNT){cache_error=5;cache_request=0;return;}
 cache_phase=1;
 SWITCH_ROM(7);memcpy(&frame,&cache_frames_data[cache_page],sizeof(frame));cache_dirty=0;
 SWITCH_ROM(frame.bank);
 if(frame.group==active_group&&!memcmp(frame.jobs,cache_previous,720)&&!memcmp(frame.attrs,cache_attrs,360)){cache_frames++;cache_phase=0;cache_request=0;return;}
 for(i=0;i<128;i++)cache_pins[i]&=1;
 for(row=0,cell=0;row<18;row++){
  /* Most source NPC steps affect one or two rows. Keep unchanged rows pinned
   * without decoding and branching over every input and attribute again. */
  if(!memcmp(frame.jobs+cell,cache_previous+cell,40)&&!memcmp(frame.attrs+cell,cache_attrs+cell,20)){
   for(col=0;col<20;col++,cell++)cache_pins[cache_slots[cell]]|=2;
   ff3_native_service();continue;
  }
  for(col=0;col<20;col++,cell++){
  key=frame.jobs[cell];attr=frame.attrs[cell];if(cache_attrs[cell]!=attr){attrs_changed=1;bit=1u<<(5+(row>>2));dirty_maps[0]|=bit;dirty_maps[1]|=bit;}cache_attrs[cell]=attr;
  if(key>=CACHE_JOB_COUNT){cache_error=6;break;}
  if(key!=cache_previous[cell]){cache_dirty++;slot=acquire(key);if(cache_error)break;if(cache_slots[cell]!=slot){bit=1u<<(row>>2);dirty_maps[0]|=bit;dirty_maps[1]|=bit;}cache_slots[cell]=slot;cache_previous[cell]=key;SWITCH_ROM(frame.bank);ff3_native_service();}
  else cache_pins[cache_slots[cell]]|=2;
  }
  if(cache_error)break;
  ff3_native_service();
 }
 if(!cache_error&&!cache_dirty&&!attrs_changed&&frame.group==active_group){for(i=0;i<128;i++)cache_pins[i]>>=1;cache_frames++;cache_phase=0;cache_request=0;return;}
 if(!cache_error){cache_phase=2;maps(page);cache_phase=3;objects(page);}
 if(!cache_error){cache_phase=4;SWITCH_ROM(frame.bank);memcpy(cache_palette,frame.palette,80);ff3_cache_publish(page,frame.group!=active_group);active_page=page;active_group=frame.group;for(i=0;i<128;i++)cache_pins[i]>>=1;cache_frames++;}
 cache_phase=0;
 cache_request=0;
}
void main(void){ff3_platform_init();ff3_memory_init();cpu_fast();DISPLAY_OFF;
 memset(cache_keys,255,sizeof(cache_keys));memset(cache_previous,255,sizeof(cache_previous));memset(cache_pins,0,sizeof(cache_pins));memset(cache_attrs,0,sizeof(cache_attrs));memset(cache_slots,0,sizeof(cache_slots));memset(cache_oam0,0,160);memset(cache_oam1,0,160);memset(cache_objkeys0,255,80);memset(cache_objkeys1,255,80);
 memset((void*)0xd7f0,0xa7,16);memset((void*)0xd94d,0xa7,3);memset((void*)0xdcf0,0xa7,16);
 _shadow_OAM_base=0xdb;SCX_REG=SCY_REG=0;WX_REG=167;*(volatile uint8_t*)0xff6c=0;
 ff3_text_video_init();ff3_cache_video_init();text_idle=ff3_native_service;LCDC_REG=0x93;ff3_native_begin();cache_ready=0xa5;
 while(1){ff3_native_service();if(cache_request)show();else {__asm halt __endasm;}}
}
