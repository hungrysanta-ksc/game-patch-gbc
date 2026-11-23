#pragma bank 14
#include <gb/cgb.h>
#include <string.h>
#include <stddef.h>
#include "text-window.h"
#include "text-vblank.h"
uint8_t text_visible,text_more,text_error,text_page,text_cache_count;
uint16_t text_offset,text_cache[128];
#ifdef FF3_TEXT_AUDIO
uint16_t __at(0xd800) text_cells[160];
#else
uint16_t text_cells[160];
#endif
FF3TextContext text_context;
typedef char context_abi[(sizeof(FF3TextContext)==8&&offsetof(FF3TextContext,item)==4)?1:-1];
typedef struct {FF3Asset message,parent[3];uint16_t parent_offset[3],pending[7],last;uint8_t depth,count,pos;} Reader;
static Reader reader,saved;static uint16_t saved_offset;
static uint8_t read_count,read_buffer[32],*read_cursor;
uint8_t __at(0xda60) text_lookup[256];
#define message reader.message
static void checkpoint(void){saved=reader;saved_offset=text_offset;}
static void rewind_word(void){reader=saved;text_offset=saved_offset;read_count=0;}
static const uint16_t palette[4]={RGB(1,2,8),RGB(1,2,8),RGB(12,15,23),RGB(31,31,31)};
static uint8_t fail(uint8_t error){text_error=error;text_visible=0;text_more=0;VBK_REG=0;ff3_text_video(0);text_transfer_busy=0;return 0;}
static uint8_t raw_word(uint16_t *value){uint16_t remaining;
 if(!read_count){
  if(text_offset>message.length||message.length-text_offset<2)return fail(TEXT_FORMAT);
  remaining=message.length-text_offset;read_count=remaining>32?32:(uint8_t)remaining;
  if(!ff3_asset_read(&message,text_offset,read_buffer,read_count))return fail(TEXT_FORMAT);read_cursor=read_buffer;
 }
 *value=*read_cursor++;*value|=(uint16_t)*read_cursor++<<8;read_count-=2;text_offset+=2;return 1;
}
static uint8_t lookup(uint16_t source_id,FF3Asset *out);
/* 8C2C..8D6D uses 24-, then 16-, then 8-bit arithmetic. Preserve even the
 * over-range rendering quirks; do not silently clamp or use sprintf. */
void ff3_text_number(uint32_t value,uint8_t digits,uint16_t *out) BANKED {
 uint32_t unit=1;uint8_t p,d,leading=1;for(p=1;p<digits;p++)unit*=10;
 for(p=digits;p;p--){if(p==4)value&=65535UL;if(p==2)value&=255;
  d=0;while(value>=unit&&(p<=2||d<9)){value-=unit;d++;}
  out[digits-p]=(leading&&p>1&&!d)?255:(d|128);if(d)leading=0;unit/=10;
 }
}
static uint8_t word(uint16_t *value){uint16_t op,arg,glyph;uint8_t slot,i,b[2];FF3Asset asset;uint32_t number;
 while(1){ff3_text_service();
  if(reader.pos<reader.count){glyph=reader.pending[reader.pos++];if(glyph!=255)reader.last=glyph;*value=0x8000|glyph;return 1;}
  if(!raw_word(&op))return 0;
  if((op==0||op==10)&&reader.depth){reader.depth--;message=reader.parent[reader.depth];text_offset=reader.parent_offset[reader.depth];read_count=0;continue;}
  if(op>=0x8000){glyph=op&0x7fff;if(glyph!=255&&glyph!=0xc9&&glyph!=0xc0)reader.last=glyph;*value=op;return 1;}
  if(op==64){if(!raw_word(&arg)||!raw_word(&glyph))return 0;if(reader.last<256||reader.last>=2606)return fail(TEXT_CONTEXT);
   i=(reader.last-256)&7;if(!ff3_asset_open(22,0,&asset)||!ff3_asset_read(&asset,(reader.last-256)>>3,b,1))return fail(TEXT_ASSET);
   reader.last=(b[0]&(1<<i))?arg:glyph;*value=0x8000|reader.last;return 1;
  }
  if(op==2||op==3||op==4||op==5||op==12||(op>=16&&op<=19)){
   if(!text_context.state)return fail(TEXT_UNSUPPORTED);
   reader.pos=reader.count=0;
   if(op==12||(op>=16&&op<=19)){
    if(op==12){slot=text_context.state[14];if(slot&63)return fail(TEXT_CONTEXT);slot>>=6;}
    else{slot=op-16;if(!raw_word(&arg))return 0;if(arg!=2)return fail(TEXT_UNSUPPORTED);}
    if(!text_context.names)return fail(TEXT_CONTEXT);
    for(i=0;i<6;i++){glyph=text_context.names[slot*6+i];if(glyph<112||glyph>=2606)return fail(TEXT_GLYPH);reader.pending[i]=glyph;}reader.count=6;continue;
   }
   if(op==2){reader.last=65535;if(!text_context.item)continue;if(reader.depth==3)return fail(TEXT_DEPTH);
    if(!lookup(1024u+text_context.item,&asset))return 0;reader.parent[reader.depth]=message;reader.parent_offset[reader.depth++]=text_offset;message=asset;text_offset=0;read_count=0;continue;
   }
   if(op==3){if(!ff3_asset_open(21,0,&asset)||!ff3_asset_read(&asset,(uint16_t)text_context.item*2,b,2))return fail(TEXT_ASSET);number=b[0]|((uint16_t)b[1]<<8);}
   else {uint8_t *p=op==4?text_context.variable_gil:text_context.state+0x1c;number=(uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16);}
   reader.count=op==5?7:6;ff3_text_number(number,reader.count,reader.pending);continue;
  }
  *value=op;return 1;
 }
}
/* Slot+1 hash entries retain first-use tile order. At most 128 of 256 entries
 * are occupied, so the bounded probe always finds an empty slot. */
static uint8_t cache(uint16_t glyph){uint8_t key=(uint8_t)glyph^(uint8_t)(glyph>>8),slot;
 ff3_text_service();
 while((slot=text_lookup[key])!=0){slot--;if(text_cache[slot]==glyph)return slot;key++;}
 if(text_cache_count==128)return 255;slot=text_cache_count++;text_cache[slot]=glyph;text_lookup[key]=slot+1;return slot;
}
static uint8_t page(void){uint8_t x=0,y=1,i,j,n,k,run,font_id=255;uint16_t w,arg,glyph,begin,elapsed;FF3Asset font;
 text_more=0;text_cache_count=0;memset(text_lookup,0,sizeof(text_lookup));
 for(i=0;i<160;i++)text_cells[i]=255;
 for(i=0;i<20;i++){text_cells[i]=0xf8;text_cells[140+i]=0xfd;}
 for(i=1;i<7;i++){text_cells[i*20]=0xfa;text_cells[i*20+19]=0xfb;}
 text_cells[0]=0xf7;text_cells[19]=0xf9;text_cells[140]=0xfc;text_cells[159]=0xfe;
 while(1){
  /* Only a glyph beyond the final row can require rewinding. Preserve the
   * reader before that word, rather than copying it for every character. */
  if(x==18&&y>=5)checkpoint();if(!word(&w))return 0;
  if(w==0||w==10)break;
  /* NES 01 advances two tile rows, 09 one. GBC automatic wrapping and page
   * replacement are explicit viewport adaptations; NES scrolling timing waits. */
  if(w==1||w==9){x=0;y+=w==1?2:1;if(y>=7){text_more=1;break;}continue;}
  if(w==20){if(!raw_word(&arg))return 0;if(arg>=18)return fail(TEXT_LAYOUT);x=(uint8_t)arg;continue;}
  if(w==6||w==11||w==14)continue; /* original 3F/EFA2, EFEC, F000 fallthrough */
  if(w>=35&&w<=39){if(!raw_word(&arg))return 0;continue;}
  if(w<0x8000)return fail(TEXT_UNSUPPORTED);
  glyph=w&0x7fff;if(glyph<0x70||glyph>=2606)return fail(TEXT_GLYPH);
  if(x==18){x=0;y+=2;}if(y>=7){rewind_word();text_more=1;break;}
  text_cells[y*20+1+x++]=glyph;
 }
 // Avoid a spurious empty page when the last line exactly fills the window.
 if(text_more){checkpoint();if(!word(&w))return 0;if(w==0||w==10)text_more=0;else rewind_word();}
 memset(text_staging,0,256);
 for(i=0;i<8;i++)for(j=0;j<20;j++){k=cache(text_cells[i*20+j]);if(k==255)return fail(TEXT_LAYOUT);text_staging[(uint16_t)i*32+j]=k;}
 /* One 128-glyph cache. Hide only the window during its replacement; the LCD,
  * map/NPC layers and timer remain running. No partially replaced page is shown. */
 ff3_text_video(0);begin=sys_time;text_transfer_busy=1;
 ff3_text_copy(0,0x9c00,text_staging,256);
 memset(text_staging,0x8f,256);ff3_text_copy(1,0x9c00,text_staging,256);
 for(i=0;i<text_cache_count;i+=n){
  n=text_cache_count-i;if(n>16)n=16;
  for(k=0;k<n;k+=run){
   ff3_text_service();glyph=text_cache[i+k];
   if(font_id!=(glyph>>10)){font_id=glyph>>10;if(!ff3_asset_open(FF3_TEXT_GLYPHS,font_id,&font))return fail(TEXT_ASSET);}
   run=1;while(k+run<n&&text_cache[i+k+run]==glyph+run&&(glyph&1023)+run<1024)run++;
   if(!ff3_asset_read(&font,(glyph&1023)*16,text_staging+(uint16_t)k*16,(uint16_t)run*16))return fail(TEXT_ASSET);
  }
  ff3_text_copy(1,0x9000u+(uint16_t)i*16,text_staging,(uint16_t)n*16);
 }
 ff3_text_palette(palette);ff3_text_video(1);elapsed=sys_time-begin;text_transfer_frames+=elapsed;if(elapsed>text_transfer_max_frames)text_transfer_max_frames=elapsed;
 text_transfer_busy=0;text_visible=1;text_page++;return 1;
}
uint8_t ff3_text_open(uint16_t id) BANKED {ff3_text_close();text_error=0;text_page=0;text_offset=0;read_count=0;memset(&reader,0,sizeof(reader));reader.last=65535;if(!ff3_asset_open(FF3_KOREAN_TEXT,id,&message))return fail(TEXT_ASSET);if(message.length&1)return fail(TEXT_FORMAT);return page();}
static uint8_t lookup(uint16_t source_id,FF3Asset *out){
 FF3Asset index;uint8_t record[4];uint16_t lo=0,hi,mid,id,pointer;
 if(source_id>=1712)return fail(TEXT_SOURCE);
 if(!ff3_asset_open(FF3_TEXT_POINTERS,0,&index)||!ff3_asset_read(&index,source_id*2,record,2))return fail(TEXT_ASSET);
 pointer=record[0]|((uint16_t)record[1]<<8);if(pointer<0x0d60||pointer>=0xe000)return fail(TEXT_SOURCE);
 if(!ff3_asset_open(FF3_TEXT_BINDINGS,0,&index))return fail(TEXT_ASSET);
 if(index.length&3)return fail(TEXT_FORMAT);hi=index.length/4;
 while(lo<hi){mid=lo+(hi-lo)/2;if(!ff3_asset_read(&index,mid*4,record,4))return fail(TEXT_ASSET);id=record[0]|((uint16_t)record[1]<<8);
  if(id==source_id){if(!ff3_asset_open(FF3_KOREAN_TEXT,record[2]|((uint16_t)record[3]<<8),out))return fail(TEXT_ASSET);if(out->length&1)return fail(TEXT_FORMAT);return 1;}
  if(id<source_id)lo=mid+1;else hi=mid;
 }return fail(TEXT_UNTRANSLATED);
}
uint8_t ff3_text_open_source(uint16_t source_id) BANKED {ff3_text_close();text_error=0;text_page=0;text_offset=0;read_count=0;memset(&reader,0,sizeof(reader));reader.last=65535;if(!lookup(source_id,&message))return 0;return page();}
uint8_t ff3_text_next(void) BANKED {if(!text_visible)return fail(TEXT_FORMAT);if(!text_more){ff3_text_close();return 1;}return page();}
void ff3_text_close(void) BANKED {ff3_text_video(0);text_visible=0;text_more=0;}
