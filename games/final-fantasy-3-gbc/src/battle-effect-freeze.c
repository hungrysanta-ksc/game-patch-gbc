#pragma bank 51
#include <gb/cgb.h>
#include <string.h>
#include "battle-effect-freeze.h"
#include "text-vblank.h"
#include "memory.h"
#include "battle-resident-bg.h"
/* Only the numeral owner may lend frozen party pixels to BG. OBJ patterns
 * remain in blocks 0/1. Signed BG addressing lends block 2 without evicting
 * enemy, terrain, party, status or window resources from their original slots. */
uint8_t effect_signed,effect_freeze_error;
volatile uint8_t effect_freeze_stage;
static uint8_t old_page,new_page,cells,retained,mixed;
uint16_t __at(0xd200) effect_pixels[64];
uint8_t __at(0xd280) effect_glyph[16];
uint8_t __at(0xd290) effect_encoded[16];
uint16_t __at(0xd2a0) effect_keys[112];
uint8_t __at(0xd870) effect_palettes[128];
extern uint8_t __at(0xd6a0) animation_base[160];
extern uint8_t __at(0xdc00) party_oam0[160];
extern uint8_t __at(0xdd00) party_oam1[160];
extern volatile uint8_t party_page,party_pending;
extern uint8_t next_page;
void ff3_native_service(void) NONBANKED;
static uint16_t color(uint8_t i){return effect_palettes[i*2]|((uint16_t)effect_palettes[i*2+1]<<8);}
/* A single bounded read in HBlank. A 0->2 boundary still leaves a full
 * 80-dot OAM search before VRAM closes; timer IRQs run between bytes. */
static void read_vram(uint8_t bank,uint16_t address,uint8_t*out,uint16_t count){uint8_t ok;uint16_t i=0;
 while(i<count){ok=0;while(STAT_REG&3);CRITICAL{if(!(STAT_REG&3)){VBK_REG=bank;out[i]=*(volatile uint8_t*)address;VBK_REG=0;ok=1;}}if(ok){i++;address++;if(!(i&15))ff3_native_service();}}
}
static void palettes(void){uint8_t i,ok;for(i=0;i<128;i++){ok=0;while(!ok){while(STAT_REG&3);CRITICAL{if(!(STAT_REG&3)){if(i<64){BCPS_REG=i;effect_palettes[i]=BCPD_REG;}else{OCPS_REG=i-64;effect_palettes[i]=OCPD_REG;}ok=1;}}}if(!(i&7))ff3_native_service();}}
static uint8_t store(uint16_t at,void*p,uint16_t n,uint8_t write){if(!ff3_wram_copy(3,at,p,n,write)){effect_freeze_error=1;return 0;}return 1;}
static void mirror(uint8_t bank,uint16_t from,uint16_t to,uint16_t bytes){uint16_t at;for(at=0;at<bytes;at+=256){read_vram(bank,from+at,text_staging,256);ff3_text_copy(bank,to+at,text_staging,256);ff3_native_service();}}
static uint8_t keep(const uint8_t*o){return o[0]&&o[2]&&(o[0]>=112||o[0]<16);}
static uint8_t gather(void){uint8_t i,x,y,xx,yy,j;uint16_t key;const uint8_t*o;cells=0;
 for(i=8;i<32;i++){ff3_native_service();o=animation_base+i*4;if(!o[0]||!o[2]||keep(o))continue;x=o[1]-8;y=o[0]-16;if(x>152||y>96){effect_freeze_error=2;return 0;}
  for(yy=y/8;yy<=(y+7)/8;yy++)for(xx=x/8;xx<=(x+7)/8;xx++){key=(uint16_t)yy*32+xx;for(j=0;j<cells&&effect_keys[j]!=key;j++);if(j==cells){if(cells==80){effect_freeze_error=3;return 0;}effect_keys[cells++]=key;}}}
 for(i=32;i<40;i++){ff3_native_service();o=animation_base+i*4;if(!o[0])continue;x=o[1]-8;y=o[0]-16;for(j=0;j<cells;j++){if(!(j&7))ff3_native_service();xx=(effect_keys[j]&31)*8;yy=(effect_keys[j]>>5)*8;if((uint16_t)x+8>xx&&x<(uint16_t)xx+8&&(uint16_t)y+8>yy&&y<(uint16_t)yy+8){effect_freeze_error=7;return 0;}}}
 return 1;
}
static uint8_t reverse_bits(uint8_t v){v=((v&0x55)<<1)|((v>>1)&0x55);v=((v&0x33)<<2)|((v>>2)&0x33);return(v<<4)|(v>>4);}
static uint8_t compose(uint16_t key,uint8_t tile){uint8_t t,a,x=key%32*8,y=key/32*8,xx,yy,i,j,p,found,v,bit,sy,sx,mask;uint16_t c;int16_t dx,dy;const uint8_t*o;
 read_vram(0,(old_page?0x9c00:0x9800)+key,&t,1);read_vram(1,(old_page?0x9c00:0x9800)+key,&a,1);read_vram((a>>3)&1,0x8000+(uint16_t)t*16,effect_glyph,16);
 /* The normal field behind a settled party is black. With aligned X and
  * one source palette, native bitplanes can be combined directly. Only
  * the terrain boundary needs the general exact-color cell converter. */
 v=0;for(i=0;i<16;i++)v|=effect_glyph[i];p=255;
 if(!v&&color((a&7)*4)==color(0)){
  found=1;for(i=8;i<32;i++){if(!(i&7))ff3_native_service();o=animation_base+i*4;if(!o[0]||!o[2]||keep(o))continue;dx=(int16_t)o[1]-8-x;dy=(int16_t)o[0]-16-y;if(dx<=-8||dx>=8||dy<=-8||dy>=8)continue;
   if(dx||(p!=255&&p!=(o[3]&7))||(o[3]&7)>2){found=0;break;}p=o[3]&7;}
  if(found&&p!=255){memset(effect_encoded,0,16);
   for(i=32;i>8;){i--;o=animation_base+i*4;if(!o[0]||!o[2]||keep(o)||o[1]-8!=x)continue;dy=(int16_t)o[0]-16-y;if(dy<=-8||dy>=8)continue;
    read_vram((o[3]>>3)&1,0x8000+(uint16_t)o[2]*16,effect_glyph,16);
    for(yy=0;yy<8;yy++){sy=yy-dy;if(sy>=8)continue;if(o[3]&64)sy=7-sy;t=effect_glyph[sy*2];a=effect_glyph[sy*2+1];if(o[3]&32){t=reverse_bits(t);a=reverse_bits(a);}mask=t|a;effect_encoded[yy*2]=(effect_encoded[yy*2]&~mask)|t;effect_encoded[yy*2+1]=(effect_encoded[yy*2+1]&~mask)|a;}ff3_native_service();}
   p+=4;goto encoded;
  }
 }
 for(yy=0;yy<8;yy++){ff3_native_service();for(xx=0;xx<8;xx++){sy=a&64?7-yy:yy;bit=a&32?xx:7-xx;v=((effect_glyph[sy*2]>>bit)&1)|(((effect_glyph[sy*2+1]>>bit)&1)<<1);effect_pixels[yy*8+xx]=color((a&7)*4+v);}}
 /* Reverse traversal retains the original earlier-OBJ priority. */
 for(i=32;i>8;){ff3_native_service();i--;o=animation_base+i*4;if(!o[0]||!o[2]||keep(o))continue;dx=(int16_t)o[1]-8-x;dy=(int16_t)o[0]-16-y;if(dx<=-8||dx>=8||dy<=-8||dy>=8)continue;
  read_vram((o[3]>>3)&1,0x8000+(uint16_t)o[2]*16,effect_glyph,16);
  for(yy=0;yy<8;yy++){ff3_native_service();sy=yy-dy;if(sy>=8)continue;if(o[3]&64)sy=7-sy;
   for(xx=0;xx<8;xx++){sx=xx-dx;if(sx>=8)continue;bit=o[3]&32?sx:7-sx;v=((effect_glyph[sy*2]>>bit)&1)|(((effect_glyph[sy*2+1]>>bit)&1)<<1);if(v)effect_pixels[yy*8+xx]=color(32+(o[3]&7)*4+v);}}
 }
 /* No color approximation. An unrepresentable mixed cell fails closed;
 * the caller must provide a residual plane before accepting that case. */
 for(p=0;p<(mixed?8:7);p++){found=1;for(i=0;i<64;i++){if(!(i&7))ff3_native_service();c=effect_pixels[i];for(j=0;j<4&&color(p*4+j)!=c;j++);if(j==4){found=0;break;}}if(found)break;}
 if(!found){if(mixed){effect_freeze_error=4;return 0;}p=7;v=0;for(i=0;i<64;i++){if(!(i&7))ff3_native_service();c=effect_pixels[i];for(j=0;j<v&&color(28+j)!=c;j++);if(j==v){if(v==4){effect_freeze_error=4;return 0;}effect_palettes[56+v*2]=c;effect_palettes[57+v*2]=c>>8;v++;}}mixed=1;}
 memset(effect_encoded,0,16);
 for(i=0;i<64;i++){if(!(i&7))ff3_native_service();c=effect_pixels[i];for(j=0;color(p*4+j)!=c;j++);mask=128>>(i&7);if(j&1)effect_encoded[(i>>3)*2]|=mask;if(j&2)effect_encoded[(i>>3)*2+1]|=mask;}
 encoded:if(!store(2816+(uint16_t)tile*16,effect_encoded,16,1))return 0;
 a=p;return store(1536+key,&tile,1,1)&&store(2112+key,&a,1,1);
}
uint8_t ff3_effect_freeze(void) BANKED {uint8_t bank,i;uint16_t at,size,j;effect_freeze_error=0;if(effect_signed)return 1;
 effect_freeze_stage=1;
 old_page=resident_page;new_page=old_page^1;if(resident_scroll){effect_freeze_error=5;return 0;}
 if(!store(1152,animation_base,160,1)||!gather())return 0;effect_freeze_stage=2;palettes();
 if(!store(1312,effect_palettes+32,32,1))return 0;memcpy(effect_palettes+32,effect_palettes+64,24);mixed=0;
 /* OBJ color zero is transparent, not its stored RGB value. The borrowed
  * BG palette must encode the field's actual transparent backdrop. */
 for(i=0;i<3;i++){effect_palettes[32+i*8]=effect_palettes[0];effect_palettes[33+i*8]=effect_palettes[1];}
 effect_freeze_stage=3;
 /* Save the actual inactive map, not a guessed copy of the active map. */
 for(bank=0;bank<2;bank++)for(at=0;at<576;at+=256){size=576-at;if(size>256)size=256;read_vram(bank,(new_page?0x9c00:0x9800)+at,text_staging,size);if(!store((uint16_t)bank*576+at,text_staging,size,1))return 0;read_vram(bank,(old_page?0x9c00:0x9800)+at,text_staging,size);if(bank)for(j=0;j<size;j++){if(!(j&31))ff3_native_service();if((text_staging[j]&7)>=4){effect_freeze_error=8;return 0;}}if(!store(1536+(uint16_t)bank*576+at,text_staging,size,1))return 0;}
 effect_freeze_stage=4;for(i=0;i<cells;i++){if(!compose(effect_keys[i],i))return 0;ff3_native_service();}effect_freeze_stage=5;
 /* At most eight retained original objects beside 32 damage glyphs. The
 * two lower party feet remain OBJ so all live UI rows stay independently writable. */
 retained=0;for(i=8;i<40;i++)if((i>=32||keep(animation_base+i*4))&&animation_base[i*4]){if(retained==8){effect_freeze_error=6;return 0;}memmove(animation_base+retained*4,animation_base+i*4,4);retained++;}
 memmove(animation_base+128,animation_base,retained*4);memset(animation_base,0,128);memset(animation_base+128+retained*4,0,(8-retained)*4);
 effect_freeze_stage=6;mirror(1,0x8000,0x9000,2048);mirror(0,0x8700,0x9700,256);effect_freeze_stage=7;
 for(at=0;at<(uint16_t)cells*16;at+=128){size=(uint16_t)cells*16-at;if(size>128)size=128;if(!store(2816+at,text_staging,size,0))return 0;ff3_text_copy(0,0x9000+at,text_staging,size);ff3_native_service();}
 memcpy(text_staging,effect_palettes+32,32);ff3_text_palette_range(1,4,4,text_staging);
 for(bank=0;bank<2;bank++)for(at=0;at<576;at+=256){size=576-at;if(size>256)size=256;if(!store(1536+(uint16_t)bank*576+at,text_staging,size,0))return 0;ff3_text_copy(bank,(new_page?0x9c00:0x9800)+at,text_staging,size);ff3_native_service();}
 resident_page=new_page;effect_signed=1;effect_freeze_stage=8;return 1;
}
uint8_t ff3_effect_release(void) BANKED {uint8_t bank,page;uint16_t at,size;if(!effect_signed)return 0;
 if(!store(1152,animation_base,160,0))return 0;page=party_page^1;if(page)memcpy(party_oam1,animation_base,160);else memcpy(party_oam0,animation_base,160);
 resident_page=old_page;effect_signed=0;next_page=page;party_pending=1;while(party_pending){ff3_native_service();__asm halt __endasm;}
 for(bank=0;bank<2;bank++)for(at=0;at<576;at+=256){size=576-at;if(size>256)size=256;if(!store((uint16_t)bank*576+at,text_staging,size,0))return 0;ff3_text_copy(bank,(new_page?0x9c00:0x9800)+at,text_staging,size);ff3_native_service();}
 if(!store(1312,text_staging,32,0))return 0;ff3_text_palette_range(1,4,4,text_staging);return 1;
}
