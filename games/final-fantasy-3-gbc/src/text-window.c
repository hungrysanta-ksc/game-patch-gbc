#pragma bank 14
#include <gb/cgb.h>
#include <string.h>
#include "text-window.h"
uint8_t text_visible,text_more,text_error,text_page,text_cache_count;
uint16_t text_offset,text_cells[160],text_cache[128];
static FF3Asset message;
static uint8_t tile[16],row[20];
static const uint16_t palette[4]={RGB(1,2,8),RGB(1,2,8),RGB(12,15,23),RGB(31,31,31)};
static uint8_t fail(uint8_t error){text_error=error;text_visible=0;text_more=0;VBK_REG=0;HIDE_WIN;return 0;}
static uint8_t word(uint16_t *value){uint8_t bytes[2];if(!ff3_asset_read(&message,text_offset,bytes,2))return fail(TEXT_FORMAT);*value=bytes[0]|((uint16_t)bytes[1]<<8);text_offset+=2;return 1;}
static uint8_t cache(uint16_t glyph){uint8_t i;for(i=0;i<text_cache_count;i++)if(text_cache[i]==glyph)return i;if(text_cache_count==128)return 255;text_cache[text_cache_count]=glyph;return text_cache_count++;}
static uint8_t page(void){uint8_t x=0,y=1,i,j,slot,lcdc;uint16_t w,arg,at,glyph;FF3Asset font;
 text_more=0;text_cache_count=0;
 for(i=0;i<160;i++)text_cells[i]=255;
 for(i=0;i<20;i++){text_cells[i]=0xf8;text_cells[140+i]=0xfd;}
 for(i=1;i<7;i++){text_cells[i*20]=0xfa;text_cells[i*20+19]=0xfb;}
 text_cells[0]=0xf7;text_cells[19]=0xf9;text_cells[140]=0xfc;text_cells[159]=0xfe;
 while(1){
  at=text_offset;if(!word(&w))return 0;
  if(w==0||w==10)break;
  /* NES 01 advances two tile rows, 09 one. GBC automatic wrapping and page
   * replacement are explicit viewport adaptations; NES scrolling timing waits. */
  if(w==1||w==9){x=0;y+=w==1?2:1;if(y>=7){text_more=1;break;}continue;}
  if(w==20){if(!word(&arg))return 0;if(arg>=18)return fail(TEXT_LAYOUT);x=(uint8_t)arg;continue;}
  if(w==6||w==11||w==14)continue; /* original 3F/EFA2, EFEC, F000 fallthrough */
  if(w>=35&&w<=39){if(!word(&arg))return 0;continue;}
  if(w<0x8000)return fail(TEXT_UNSUPPORTED);
  glyph=w&0x7fff;if(glyph<0x70||glyph>=2606)return fail(TEXT_GLYPH);
  if(x==18){x=0;y+=2;}if(y>=7){text_offset=at;text_more=1;break;}
  text_cells[y*20+1+x++]=glyph;
 }
 // Avoid a spurious empty page when the last line exactly fills the window.
 if(text_more){at=text_offset;if(!word(&w))return 0;if(w==0||w==10)text_more=0;else text_offset=at;}
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
uint8_t ff3_text_open(uint16_t id) BANKED {HIDE_WIN;text_visible=0;text_error=0;text_page=0;text_offset=0;if(!ff3_asset_open(FF3_KOREAN_TEXT,id,&message))return fail(TEXT_ASSET);if(message.length&1)return fail(TEXT_FORMAT);return page();}
uint8_t ff3_text_open_source(uint16_t source_id) BANKED {
 FF3Asset index;uint8_t record[4];uint16_t lo=0,hi,mid,id,pointer;
 ff3_text_close();text_error=0;text_page=0;text_offset=0;
 if(source_id>=1712)return fail(TEXT_SOURCE);
 if(!ff3_asset_open(FF3_TEXT_POINTERS,0,&index)||!ff3_asset_read(&index,source_id*2,record,2))return fail(TEXT_ASSET);
 pointer=record[0]|((uint16_t)record[1]<<8);if(pointer<0x0d60||pointer>=0xe000)return fail(TEXT_SOURCE);
 if(!ff3_asset_open(FF3_TEXT_BINDINGS,0,&index))return fail(TEXT_ASSET);
 if(index.length&3)return fail(TEXT_FORMAT);hi=index.length/4;
 while(lo<hi){mid=lo+(hi-lo)/2;if(!ff3_asset_read(&index,mid*4,record,4))return fail(TEXT_ASSET);id=record[0]|((uint16_t)record[1]<<8);
  if(id==source_id)return ff3_text_open(record[2]|((uint16_t)record[3]<<8));
  if(id<source_id)lo=mid+1;else hi=mid;
 }return fail(TEXT_UNTRANSLATED);
}
uint8_t ff3_text_next(void) BANKED {if(!text_visible)return fail(TEXT_FORMAT);if(!text_more){ff3_text_close();return 1;}return page();}
void ff3_text_close(void) BANKED {HIDE_WIN;text_visible=0;text_more=0;}
