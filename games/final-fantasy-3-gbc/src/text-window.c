#pragma bank 14
#include <gb/cgb.h>
#include <string.h>
#include <stddef.h>
#include "text-window.h"
uint8_t text_visible,text_more,text_error,text_page,text_cache_count;
uint16_t text_offset,text_cells[160],text_cache[128];
FF3TextContext text_context;
typedef char context_abi[(sizeof(FF3TextContext)==8&&offsetof(FF3TextContext,item)==4)?1:-1];
typedef struct {FF3Asset message,parent[3];uint16_t parent_offset[3],pending[7],last;uint8_t depth,count,pos;} Reader;
static Reader reader,saved;static uint16_t saved_offset;
#define message reader.message
static void checkpoint(void){saved=reader;saved_offset=text_offset;}
static void rewind_word(void){reader=saved;text_offset=saved_offset;}
static uint8_t tile[16],row[20];
static const uint16_t palette[4]={RGB(1,2,8),RGB(1,2,8),RGB(12,15,23),RGB(31,31,31)};
static uint8_t fail(uint8_t error){text_error=error;text_visible=0;text_more=0;VBK_REG=0;HIDE_WIN;return 0;}
static uint8_t raw_word(uint16_t *value){uint8_t bytes[2];if(!ff3_asset_read(&message,text_offset,bytes,2))return fail(TEXT_FORMAT);*value=bytes[0]|((uint16_t)bytes[1]<<8);text_offset+=2;return 1;}
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
 while(1){
  if(reader.pos<reader.count){glyph=reader.pending[reader.pos++];if(glyph!=255)reader.last=glyph;*value=0x8000|glyph;return 1;}
  if(!raw_word(&op))return 0;
  if((op==0||op==10)&&reader.depth){reader.depth--;message=reader.parent[reader.depth];text_offset=reader.parent_offset[reader.depth];continue;}
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
    if(!lookup(1024u+text_context.item,&asset))return 0;reader.parent[reader.depth]=message;reader.parent_offset[reader.depth++]=text_offset;message=asset;text_offset=0;continue;
   }
   if(op==3){if(!ff3_asset_open(21,0,&asset)||!ff3_asset_read(&asset,(uint16_t)text_context.item*2,b,2))return fail(TEXT_ASSET);number=b[0]|((uint16_t)b[1]<<8);}
   else {uint8_t *p=op==4?text_context.variable_gil:text_context.state+0x1c;number=(uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16);}
   reader.count=op==5?7:6;ff3_text_number(number,reader.count,reader.pending);continue;
  }
  *value=op;return 1;
 }
}
static uint8_t cache(uint16_t glyph){uint8_t i;for(i=0;i<text_cache_count;i++)if(text_cache[i]==glyph)return i;if(text_cache_count==128)return 255;text_cache[text_cache_count]=glyph;return text_cache_count++;}
static uint8_t page(void){uint8_t x=0,y=1,i,j,slot,lcdc;uint16_t w,arg,glyph;FF3Asset font;
 text_more=0;text_cache_count=0;
 for(i=0;i<160;i++)text_cells[i]=255;
 for(i=0;i<20;i++){text_cells[i]=0xf8;text_cells[140+i]=0xfd;}
 for(i=1;i<7;i++){text_cells[i*20]=0xfa;text_cells[i*20+19]=0xfb;}
 text_cells[0]=0xf7;text_cells[19]=0xf9;text_cells[140]=0xfc;text_cells[159]=0xfe;
 while(1){
  checkpoint();if(!word(&w))return 0;
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
 for(i=0;i<160;i++)if(cache(text_cells[i])==255)return fail(TEXT_LAYOUT);
 /* Pattern staging uses only bank-1 9000..97FF. The original map owns bank 0;
  * NPCs own bank-1 8000..8BFF. Palette 7 and map 9C00 belong to the window.
  * LCD-off uploads are diagnostic only: no audio/frame-budget claim here. */
 lcdc=LCDC_REG;DISPLAY_OFF;LCDC_REG|=0x40;
 for(i=0;i<text_cache_count;i++){
  glyph=text_cache[i];if(!ff3_asset_open(FF3_TEXT_GLYPHS,glyph>>10,&font)||!ff3_asset_read(&font,(glyph&1023)*16,tile,16)){LCDC_REG=lcdc;return fail(TEXT_ASSET);}
  // Make background opaque against NPC sprites: index 0 -> 1, with equal color.
  for(j=0;j<16;j+=2)tile[j]|=(uint8_t)~tile[j+1];
  VBK_REG=1;set_bkg_data(i,1,tile);
 }
 for(i=0;i<8;i++){
  for(j=0;j<20;j++){slot=cache(text_cells[i*20+j]);row[j]=slot;}
  VBK_REG=0;set_win_tiles(0,i,20,1,row);
  memset(row,0x8f,20);VBK_REG=1;set_win_tiles(0,i,20,1,row);
 }
 set_bkg_palette(7,1,palette);VBK_REG=0;WX_REG=7;WY_REG=80;
 text_visible=1;text_page++;LCDC_REG=lcdc|0xe0;return 1;
}
uint8_t ff3_text_open(uint16_t id) BANKED {HIDE_WIN;text_visible=0;text_error=0;text_page=0;text_offset=0;memset(&reader,0,sizeof(reader));reader.last=65535;if(!ff3_asset_open(FF3_KOREAN_TEXT,id,&message))return fail(TEXT_ASSET);if(message.length&1)return fail(TEXT_FORMAT);return page();}
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
uint8_t ff3_text_open_source(uint16_t source_id) BANKED {ff3_text_close();text_error=0;text_page=0;text_offset=0;memset(&reader,0,sizeof(reader));reader.last=65535;if(!lookup(source_id,&message))return 0;return page();}
uint8_t ff3_text_next(void) BANKED {if(!text_visible)return fail(TEXT_FORMAT);if(!text_more){ff3_text_close();return 1;}return page();}
void ff3_text_close(void) BANKED {HIDE_WIN;text_visible=0;text_more=0;}
