#pragma bank 13
#include <gb/cgb.h>
#include <string.h>
#include "memory.h"
#include "text-vblank.h"
#include "text-window.h"
#include "composition-kernel.h"
#include "composition-window.h"
#include "scene-assets.h"
void ff3_native_service(void) NONBANKED;
/* Closed-window ownership: keys borrow text cells; cell input borrows the
 * glyph lookup. Neither overlaps staging. Map/field bytes remain untouched.
 * Bank 6: previous keys [0,798), slots [800,1199), attrs [1200,1599),
 * saved keys [1600,1856). Banks 3..5: 51/51/26 cached 80-byte results. */
uint16_t __at(0xd800) scene_keys[128];
uint8_t __at(0xda60) scene_input[256];
uint16_t __at(0xdca0) scene_objkeys0[40];
uint16_t __at(0xdda0) scene_objkeys1[40];
uint8_t scene_pins[128],scene_masks[128];
volatile uint8_t scene_ready,scene_request,scene_page,scene_error,scene_phase;
volatile uint16_t scene_frames,scene_hits,scene_misses,scene_evictions,scene_composed;
static uint8_t active_page,active_frame=255,hand,palette_loaded,window_owned;
/* Exact immutable diagnostic IDs. The live-key producer remains a separate
 * boundary; this table is bounded by the linked fixed-WRAM budget. */
static uint8_t lookup[SCENE_JOB_COUNT];
static uint16_t dirty_maps[2]={1023,1023},row_keys[21],new_keys[21];
static uint8_t row_slots[21],row_attrs[21],new_attrs[21],object_slots[40],object_planes[40];
static SceneFrame frame;
static SceneJob job;
static void copy(uint16_t offset,void *p,uint16_t n,uint8_t write){if(!ff3_wram_copy(6,offset,p,n,write))scene_error=3;}
static uint8_t storage(uint8_t slot){return 3+slot/51;}
static uint16_t offset(uint8_t slot){return (uint16_t)(slot%51)*80;}
static uint8_t acquire(uint16_t key){uint8_t i,slot;
 if(lookup[key]){slot=lookup[key]-1;if(scene_keys[slot]!=key){scene_error=6;return 0;}scene_hits++;scene_pins[slot]|=2;return slot;}
 for(i=0;i<128;i++){slot=hand;hand=(hand+1)&127;if(!scene_pins[slot])break;}
 if(i==128){scene_error=1;return 0;}
 if(scene_keys[slot]!=65535u){lookup[scene_keys[slot]]=0;scene_evictions++;}scene_misses++;
 ff3_scene_rom_copy(7,scene_jobs+key,&job,sizeof(job));
 if(job.size>256){scene_error=2;return 0;}
 if(job.is_static){if(job.size!=80){scene_error=2;return 0;}ff3_scene_rom_copy(job.bank,job.data,text_staging,80);}
 else{ff3_scene_rom_copy(job.bank,job.data,scene_input,job.size);ff3_native_service();scene_error=ff3_compose_cell(scene_input,job.size,text_staging);scene_composed++;if(scene_error)return 0;}
 ff3_native_service();scene_masks[slot]=0;
 for(i=0;i<64;i++)if(text_staging[16+i])scene_masks[slot]|=1<<(i>>4);
 if(!ff3_wram_copy(storage(slot),offset(slot),text_staging,80,1)){scene_error=3;return 0;}
 ff3_text_copy(0,0x9000u+(uint16_t)slot*16,text_staging,16);
 scene_keys[slot]=key;scene_pins[slot]=2;lookup[key]=slot+1;return slot;
}
static void maps(uint8_t page){uint8_t bank,row,n,rows,block=0;uint16_t bytes,bit;
 for(bank=0;bank<2;bank++)for(row=0;row<19;row+=4){
  bit=1u<<block++;if(!(dirty_maps[page]&bit))continue;rows=row<16?4:3;bytes=(uint16_t)rows*32;memset(text_staging,0,bytes);
  for(n=0;n<rows;n++)copy((bank?1200:800)+(uint16_t)(row+n)*21,text_staging+(uint16_t)n*32,21,0);
  ff3_text_copy(bank,(page?0x9c00u:0x9800u)+(uint16_t)row*32,text_staging,bytes);dirty_maps[page]&=~bit;ff3_native_service();
 }
}
static void objects(uint8_t page){uint16_t cell,key,*keys=page?scene_objkeys1:scene_objkeys0;uint8_t slot,p,mask,count=0,batch,first,n,row,col,dirty=0,*oam=page?scene_oam1:scene_oam0;
 memset(oam,0,160);
 for(row=0;row<19;row++){copy(800+(uint16_t)row*21,row_slots,21,0);
  for(col=0;col<21;col++){slot=row_slots[col];mask=scene_masks[slot];for(p=0;p<4;p++)if(mask&(1<<p)){
   if(count>=40){scene_error=4;return;}oam[count*4]=row*8+16-frame.y;oam[count*4+1]=col*8+8-frame.x;oam[count*4+2]=page*64+count;oam[count*4+3]=8+p;
   key=scene_keys[slot]*4+p;if(keys[count]!=key){dirty|=1<<(count>>4);keys[count]=key;}object_slots[count]=slot;object_planes[count]=p;count++;
  }}ff3_native_service();
 }
 for(first=0;first<count;first+=16){if(!(dirty&(1<<(first>>4))))continue;batch=count-first;if(batch>16)batch=16;
  for(n=0;n<batch;n++){slot=object_slots[first+n];p=object_planes[first+n];if(!ff3_wram_copy(storage(slot),offset(slot)+16+(uint16_t)p*16,text_staging+(uint16_t)n*16,16,0)){scene_error=3;return;}ff3_native_service();}
  ff3_text_copy(1,0x8000u+(uint16_t)(page*64+first)*16,text_staging,(uint16_t)batch*16);
 }
}
static void show(void){uint16_t key,cell,bit;uint8_t row,col,i,slot,attr,page=active_page^1;
 if(window_owned||scene_page>=SCENE_FRAME_COUNT){scene_error=5;return;}if(scene_page==active_frame){scene_frames++;return;}
 scene_phase=1;ff3_scene_rom_copy(7,scene_frames_data+scene_page,&frame,sizeof(frame));
 for(i=0;i<128;i++)scene_pins[i]&=1;
 for(row=0,cell=0;row<19;row++){
  copy(cell*2,row_keys,42,0);copy(800+cell,row_slots,21,0);copy(1200+cell,row_attrs,21,0);
  ff3_scene_rom_copy(frame.bank,frame.jobs+cell,new_keys,42);ff3_scene_rom_copy(frame.bank,frame.attrs+cell,new_attrs,21);
  if(!memcmp(row_keys,new_keys,42)&&!memcmp(row_attrs,new_attrs,21)){
   for(col=0;col<21;col++)scene_pins[row_slots[col]]|=2;
   cell+=21;ff3_native_service();continue;
  }
  for(col=0;col<21;col++,cell++){
   key=new_keys[col];attr=new_attrs[col];if(key>=SCENE_JOB_COUNT){scene_error=6;return;}
   if(attr!=row_attrs[col]){row_attrs[col]=attr;bit=1u<<(5+(row>>2));dirty_maps[0]|=bit;dirty_maps[1]|=bit;}
   if(key!=row_keys[col]){slot=acquire(key);if(scene_error)return;if(slot!=row_slots[col]){bit=1u<<(row>>2);dirty_maps[0]|=bit;dirty_maps[1]|=bit;}row_slots[col]=slot;row_keys[col]=key;ff3_native_service();}
   else scene_pins[row_slots[col]]|=2;
  }
  cell-=21;copy(cell*2,row_keys,42,1);copy(800+cell,row_slots,21,1);copy(1200+cell,row_attrs,21,1);cell+=21;ff3_native_service();
 }
 scene_phase=2;maps(page);scene_phase=3;objects(page);if(scene_error)return;
 scene_phase=4;ff3_scene_rom_copy(frame.bank,frame.palette,scene_palette,96);ff3_scene_publish(page,!palette_loaded,frame.x,frame.y);
 active_page=page;active_frame=scene_page;palette_loaded=1;for(i=0;i<128;i++)scene_pins[i]>>=1;scene_frames++;
}
static void open(void){
 if(window_owned||active_frame==255){scene_error=9;return;}
 /* Drain composition, normalize the active map to 9800, then lend 9C00 and
  * the glyph buffers to text. The BG never consumes bank-1 9000 font tiles. */
 scene_phase=5;if(active_page){maps(0);objects(0);ff3_scene_publish(0,0,frame.x,frame.y);active_page=0;}
 copy(1600,scene_keys,256,1);window_owned=1;
 if(!ff3_text_open_source(SCENE_TEXT_SOURCE))scene_error=10;
}
static void close(void){
 if(!window_owned){scene_error=9;return;}scene_phase=7;ff3_text_close();copy(1600,scene_keys,256,0);dirty_maps[1]=1023;window_owned=0;
}
void ff3_scene_run(void) BANKED {
 if(scene_request==1)show();else if(scene_request==2)open();else if(scene_request==3){scene_phase=6;if(!window_owned||!text_more||!ff3_text_next())scene_error=10;}else if(scene_request==4)close();else scene_error=9;
 scene_phase=0;scene_request=0;
}
void ff3_scene_begin(void) BANKED {uint8_t row;
 memset(scene_keys,255,256);memset(row_keys,255,42);memset(row_slots,0,21);memset(row_attrs,0,21);
 for(row=0;row<19;row++){copy((uint16_t)row*42,row_keys,42,1);copy(800+(uint16_t)row*21,row_slots,21,1);copy(1200+(uint16_t)row*21,row_attrs,21,1);}
 memset(scene_objkeys0,255,80);memset(scene_objkeys1,255,80);
}
