#pragma bank 51
#include <gb/cgb.h>
#include <string.h>
#include "battle-effect-freeze.h"
#include "text-vblank.h"
#include "memory.h"
#include "battle-resident-bg.h"
/* Numeral and settled ordinary-magic owners may lend frozen party pixels to BG. OBJ patterns
 * remain in blocks 0/1. Signed BG addressing lends block 2 without evicting
 * enemy, terrain, party, status or window resources from their original slots. */
uint8_t effect_signed,effect_freeze_error;
volatile uint8_t effect_freeze_stage;
uint8_t effect_freeze_cache_valid;
volatile uint8_t effect_freeze_reused;
static uint8_t cached_cells,cached_glyphs;
static uint8_t old_page,new_page,cells,retained,mixed;
/* Only changed 16-byte map blocks are borrowed. Keep the actual inactive
 * bytes; entry/flash/terrain may leave the two resident pages different. */
static uint8_t map_dirty[9];
volatile uint16_t effect_map_saved,effect_map_written;
volatile uint16_t effect_glyph_hits,effect_glyph_reads;
static uint16_t map_group;
uint16_t __at(0xd200) effect_pixels[64];
uint8_t __at(0xd280) effect_glyph[16];
uint8_t __at(0xd290) effect_encoded[16];
uint16_t __at(0xd2a0) effect_keys[112];
/* Per-cell source OBJ index, built once. Four entries cover aligned/offset
 * tile grids; FE requests the unchanged full scan for greater overlap. */
uint8_t __at(0xd380) effect_members[320];
uint8_t __at(0xd870) effect_palettes[128];
extern uint8_t __at(0xd6a0) animation_base[160];
extern uint8_t __at(0xdc00) party_oam0[160];
extern uint8_t __at(0xdd00) party_oam1[160];
extern volatile uint8_t party_page,party_pending;
extern uint8_t next_page;
void ff3_native_service(void) NONBANKED;
static uint16_t color(uint8_t i){return effect_palettes[i*2]|((uint16_t)effect_palettes[i*2+1]<<8);}
static uint8_t freeze_read_bank,freeze_read_count;
static uint16_t freeze_read_source,freeze_read_target;
/* Pan Docs: after observing mode 0/1, the next mode 2 lasts 80 dots.
 * Four unrolled reads fit that window in CGB double speed. A masked recheck
 * excludes an IRQ crossing into mode 3. Normal speed uses one byte instead.
 * Preserve IE/IME and BC; no bank switch or producer call in the masked part. */
static void read_batch(void) __naked {
 __asm
 push bc
 ld a,(_freeze_read_source)
 ld l,a
 ld a,(_freeze_read_source+1)
 ld h,a
 ld a,(_freeze_read_target)
 ld e,a
 ld a,(_freeze_read_target+1)
 ld d,a
 ld a,(_freeze_read_count)
 ld b,a
 ld a,(_freeze_read_bank)
 ld c,a
93000$:
 ld a,b
 cp #4
 jp c,93010$
 ldh a,(_KEY1_REG)
 and #128
 jp z,93010$
 ; During early VBlank an entire tile fits with a much wider safety margin.
 ; Recheck LY and mode after masking IE; a failed check returns to the
 ; original four-byte path, never extending that path's mode-2 window.
 ld a,b
 cp #16
 jr c,93001$
 ldh a,(_LY_REG)
 sub #144
 cp #7
 jr nc,93001$
 ldh a,(_IE_REG)
 push af
 xor a
 ldh (_IE_REG),a
 ldh a,(_LY_REG)
 sub #144
 cp #7
 jr nc,93025$
 ldh a,(_STAT_REG)
 and #3
 cp #1
 jr nz,93025$
 ld a,c
 ldh (_VBK_REG),a
 .rept 16
 ld a,(hl+)
 ld (de),a
 inc de
 .endm
 xor a
 ldh (_VBK_REG),a
 pop af
 ldh (_IE_REG),a
 ld a,b
 sub #16
 ld b,a
 jp nz,93000$
 pop bc
 ret
93025$:
 pop af
 ldh (_IE_REG),a
93001$:
 ldh a,(_STAT_REG)
 and #2
 jr nz,93001$
 ldh a,(_IE_REG)
 push af
 xor a
 ldh (_IE_REG),a
 ldh a,(_STAT_REG)
 and #2
 jr nz,93020$
 ld a,c
 ldh (_VBK_REG),a
 ld a,(hl+)
 ld (de),a
 inc de
 ld a,(hl+)
 ld (de),a
 inc de
 ld a,(hl+)
 ld (de),a
 inc de
 ld a,(hl+)
 ld (de),a
 inc de
 xor a
 ldh (_VBK_REG),a
 pop af
 ldh (_IE_REG),a
 dec b
 dec b
 dec b
 dec b
 jr z,93030$
 ld a,b
 cp #4
 jp nc,93001$
 jp 93010$
93030$:
 pop bc
 ret
93010$:
 ldh a,(_STAT_REG)
 and #2
 jr nz,93010$
 ldh a,(_IE_REG)
 push af
 xor a
 ldh (_IE_REG),a
 ldh a,(_STAT_REG)
 and #2
 jr nz,93020$
 ld a,c
 ldh (_VBK_REG),a
 ld a,(hl+)
 ld (de),a
 inc de
 xor a
 ldh (_VBK_REG),a
 pop af
 ldh (_IE_REG),a
 dec b
 jp nz,93000$
 pop bc
 ret
93020$:
 pop af
 ldh (_IE_REG),a
 jp 93000$
 __endasm;
}
static void read_vram(uint8_t bank,uint16_t address,uint8_t*out,uint16_t count){
 while(count){freeze_read_bank=bank;freeze_read_source=address;freeze_read_target=(uint16_t)out;freeze_read_count=count>128?128:(uint8_t)count;
  read_batch();address+=freeze_read_count;out+=freeze_read_count;count-=freeze_read_count;ff3_native_service();}
}
void ff3_effect_read(uint8_t bank,uint16_t address,uint8_t*out,uint16_t count) BANKED {read_vram(bank,address,out,count);}
static void palettes(void){uint8_t i,ok;for(i=0;i<128;i++){ok=0;while(!ok){while(STAT_REG&3);CRITICAL{if(!(STAT_REG&3)){if(i<64){BCPS_REG=i;effect_palettes[i]=BCPD_REG;}else{OCPS_REG=i-64;effect_palettes[i]=OCPD_REG;}ok=1;}}}if(!(i&7))ff3_native_service();}}
static uint8_t store(uint16_t at,void*p,uint16_t n,uint8_t write){if(!ff3_wram_copy(3,at,p,n,write)){effect_freeze_error=1;return 0;}return 1;}
/* One exact dependency cache, owned only by the effects scene:
 * WRAM4: OAM 0..159, BG0..3/OBJ palettes 160..255, output keys 256..415,
 * output palettes 416..447, input map cells 448..607, glyph records
 * 1408..3279 (104 * {bank/tile key, 16 bytes}). 1152..1407 remains magic's
 * independent retained-pattern backup. WRAM3 2816..4095 keeps the output.
 * No hash, precomposed fixture, or cache lifetime across a scene reload. */
#define seen ((uint8_t*)(effect_keys+80))
static uint8_t cache_copy(uint16_t at,void*p,uint16_t n,uint8_t write){if(!ff3_wram_copy(4,at,p,n,write)){effect_freeze_error=10;return 0;}return 1;}
void ff3_effect_cache_reset(void) BANKED {effect_freeze_cache_valid=effect_freeze_reused=0;}
static uint8_t cache_equal(uint16_t at,const uint8_t*p,uint8_t n){
 if(!cache_copy(at,text_staging+160,n,0))return 0;return !memcmp(p,text_staging+160,n);
}
static void map_cell(uint16_t key){uint16_t c=key&0xfffc;if(c!=map_group){map_group=c;read_vram(0,(old_page?0x9c00:0x9800)+c,text_staging+144,4);read_vram(1,(old_page?0x9c00:0x9800)+c,text_staging+148,4);}}
static uint8_t reuse(void){uint8_t i;uint16_t key;
 if(!effect_freeze_cache_valid)return 0;
 /* Fail early for changed poses before reading map/glyph dependencies. */
 if(!cache_equal(0,animation_base,80)||!cache_equal(80,animation_base+80,80)||
    !cache_equal(160,effect_palettes,32)||!cache_equal(192,effect_palettes+64,64))return 0;
 if(!cache_copy(256,effect_keys,(uint16_t)cached_cells*2,0)||!cache_copy(448,effect_members,(uint16_t)cached_cells*2,0))return 0;
 map_group=65535;
 for(i=0;i<cached_cells;i++){key=effect_keys[i]&1023;map_cell(key);
  if(text_staging[144+(key&3)]!=effect_members[i*2]||text_staging[148+(key&3)]!=effect_members[i*2+1])return 0;
 }
 for(i=0;i<cached_glyphs;i++){
  if(!cache_copy(1408+(uint16_t)i*18,text_staging+160,18,0))return 0;
  key=text_staging[160]|((uint16_t)text_staging[161]<<8);
  read_vram(key>>8,0x8000+(key&255)*16,effect_glyph,16);
  if(memcmp(effect_glyph,text_staging+162,16))return 0;
 }
 if(!cache_copy(416,effect_palettes+32,32,0))return 0;
 cells=cached_cells;effect_freeze_reused=1;return 1;
}
static void cache_flush(uint8_t n){if(n)cache_copy(1408+(uint16_t)(cached_glyphs-n)*18,text_staging+176,(uint16_t)n*18,1);}
static void cache_glyph(uint16_t key){uint8_t bit=1<<(key&7);uint8_t *p=text_staging+176+(cached_glyphs&3)*18;
 if(seen[key>>3]&bit)return;seen[key>>3]|=bit;
 if(cached_glyphs==104){effect_freeze_error=10;return;}
 p[0]=key;p[1]=key>>8;memcpy(p+2,effect_glyph,16);
 cached_glyphs++;if(!(cached_glyphs&3))cache_flush(4);
}
static void mirror(uint8_t bank,uint16_t from,uint16_t to,uint16_t bytes){uint16_t at;for(at=0;at<bytes;at+=256){read_vram(bank,from+at,text_staging,256);ff3_text_copy(bank,to+at,text_staging,256);ff3_native_service();}}
static uint8_t keep(const uint8_t*o){return o[0]&&o[2]&&(o[0]>=112||o[0]<16);}
static uint8_t gather(void){uint8_t i,x,y,xx,yy,j,k;uint16_t key;const uint8_t*o;cells=0;
 for(i=8;i<32;i++){ff3_native_service();o=animation_base+i*4;if(!o[0]||!o[2]||keep(o))continue;x=o[1]-8;y=o[0]-16;if(x>152||y>96){effect_freeze_error=2;return 0;}
  for(yy=y/8;yy<=(y+7)/8;yy++)for(xx=x/8;xx<=(x+7)/8;xx++){key=(uint16_t)yy*32+xx;for(j=0;j<cells&&effect_keys[j]!=key;j++);if(j==cells){if(cells==80){effect_freeze_error=3;return 0;}effect_keys[cells++]=key;memset(effect_members+(uint16_t)j*4,255,4);}
   for(k=0;k<4&&effect_members[(uint16_t)j*4+k]!=255;k++);if(k<4)effect_members[(uint16_t)j*4+k]=i;else effect_members[(uint16_t)j*4+3]=254;
  }}
 for(i=32;i<40;i++){ff3_native_service();o=animation_base+i*4;if(!o[0])continue;x=o[1]-8;y=o[0]-16;for(j=0;j<cells;j++){if(!(j&7))ff3_native_service();xx=(effect_keys[j]&31)*8;yy=(effect_keys[j]>>5)*8;if((uint16_t)x+8>xx&&x<(uint16_t)xx+8&&(uint16_t)y+8>yy&&y<(uint16_t)yy+8){effect_freeze_error=7;return 0;}}}
 return 1;
}
static uint8_t reverse_bits(uint8_t v){v=((v&0x55)<<1)|((v>>1)&0x55);v=((v&0x33)<<2)|((v>>2)&0x33);return(v<<4)|(v>>4);}
/* Only the synchronous composition phase owns this scratch. Original B589
 * keeps loaded patterns resident while B711 selects cells; do not reread the
 * same live tile for each overlapping BG cell. No VRAM writer or transfer
 * runs between this cache's initialization and the last compose(). Palette,
 * map and pattern uploads reuse text_staging only after composition ends. */
static void glyph(uint8_t bank,uint8_t tile){uint16_t key=((uint16_t)bank<<8)|tile,*tags=(uint16_t*)(text_staging+128);uint8_t slot=(tile^(tile>>3)^bank)&7,*p=text_staging+(uint16_t)slot*16;
 if(tags[slot]!=key){read_vram(bank,0x8000+(uint16_t)tile*16,p,16);tags[slot]=key;effect_glyph_reads++;}else effect_glyph_hits++;
 memcpy(effect_glyph,p,16);cache_glyph(key);
}
/* The aligned, single-palette path needs only the intersecting rows. Keep
 * original transparent pixels and earlier-OBJ priority, including both flips.
 * A small row kernel avoids the general converter's per-pixel stack/index
 * work; mixed-color and horizontally offset cells still use that converter. */
static void overlay(uint8_t flags,int8_t dy){uint8_t row=dy<0?-dy:0,n=8-(dy<0?-dy:dy),lo,hi,mask;uint8_t *out=effect_encoded+(dy>0?dy*2:0),*in=effect_glyph+((flags&64)?7-row:row)*2;
 do{lo=in[0];hi=in[1];if(flags&32){lo=reverse_bits(lo);hi=reverse_bits(hi);}mask=~(lo|hi);
  *out=(*out&mask)|lo;out++;*out=(*out&mask)|hi;out++;if(n>1){if(flags&64)in-=2;else in+=2;}
 }while(--n);
}
/* Keep the resident source palette indices through overlay, as the original
 * tile/attribute path does. Resolve each used index to RGB once, after OBJ
 * priority has settled; distinct indices may still name the same color.
 * The second half of the old RGB scratch memoizes all 64 source indices. */
static uint8_t encode_colors(void){uint8_t i,j,n=0,p,found,lo,hi,v,*indices=(uint8_t*)effect_pixels,*resolved=indices+64,*map=effect_glyph+8,*out=effect_encoded;uint16_t c,*colors=(uint16_t*)effect_glyph;
 memset(resolved,255,64);
 for(i=0;i<64;i++){if(!(i&7))ff3_native_service();v=indices[i];j=resolved[v];if(j==255){c=color(v);for(j=0;j<n&&colors[j]!=c;j++);
  if(j==n){if(n==4){effect_freeze_error=4;return 255;}colors[n++]=c;}resolved[v]=j;}indices[i]=j;
 }
 for(p=0;p<(mixed?8:7);p++){ff3_native_service();found=1;for(i=0;i<n;i++){for(j=0;j<4&&color(p*4+j)!=colors[i];j++);if(j==4){found=0;break;}map[i]=j;}if(found)break;}
 if(!found){if(mixed){effect_freeze_error=4;return 255;}p=7;for(i=0;i<n;i++){effect_palettes[56+i*2]=colors[i];effect_palettes[57+i*2]=colors[i]>>8;map[i]=i;}mixed=1;}
 for(i=0;i<8;i++){ff3_native_service();lo=hi=0;for(j=0;j<8;j++){v=map[*indices++];lo=(lo<<1)|(v&1);hi=(hi<<1)|(v>>1);}*out++=lo;*out++=hi;}
 return p;
}
/* Decode each resident bitplane row once; constant one-bit shifts replace
 * repeated per-pixel variable shifts and coordinate subtraction. */
static void background_indices(uint8_t flags){uint8_t row,x,lo,hi,base=(flags&7)*4,*out=(uint8_t*)effect_pixels,*in=effect_glyph+((flags&64)?14:0);
 for(row=0;row<8;row++){ff3_native_service();lo=in[0];hi=in[1];if(flags&32){lo=reverse_bits(lo);hi=reverse_bits(hi);}
  for(x=0;x<8;x++){*out++=base+(lo>>7)+((hi>>6)&2);lo<<=1;hi<<=1;}if(row<7){if(flags&64)in-=2;else in+=2;}}
}
static void overlay_indices(uint8_t flags,int8_t dx,int8_t dy){uint8_t row=dy<0?-dy:0,n=8-(dy<0?-dy:dy),skip=dx<0?-dx:0,width=8-(dx<0?-dx:dx),x,lo,hi,v,base=32+(flags&7)*4;
 uint8_t *out=(uint8_t*)effect_pixels+(dy>0?dy*8:0)+(dx>0?dx:0),*in=effect_glyph+((flags&64)?7-row:row)*2;
 do{ff3_native_service();lo=in[0];hi=in[1];if(flags&32){lo=reverse_bits(lo);hi=reverse_bits(hi);}lo<<=skip;hi<<=skip;
  for(x=0;x<width;x++){v=(lo>>7)|((hi>>6)&2);if(v)out[x]=base+v;lo<<=1;hi<<=1;}out+=8;if(n>1){if(flags&64)in-=2;else in+=2;}
 }while(--n);
}
static uint8_t compose(uint16_t key,uint8_t tile){uint8_t t,a,x=key%32*8,y=key/32*8,i,p,found,v,member,count;int16_t dx,dy;const uint8_t*o,*members=effect_members+(uint16_t)tile*4;
 count=members[3]==254?24:4;
 map_cell(key);
 t=text_staging[144+(key&3)];a=text_staging[148+(key&3)];glyph((a>>3)&1,t);
 /* The normal field behind a settled party is black. With aligned X and
  * one source palette, native bitplanes can be combined directly. Only
  * the terrain boundary needs the general exact-color cell converter. */
 v=0;for(i=0;i<16;i++)v|=effect_glyph[i];p=255;
 if(!v&&color((a&7)*4)==color(0)){
  found=1;for(i=0;i<count;i++){if(!(i&7))ff3_native_service();member=count==24?8+i:members[i];if(member==255)break;o=animation_base+member*4;if(!o[0]||!o[2]||keep(o))continue;dx=(int16_t)o[1]-8-x;dy=(int16_t)o[0]-16-y;if(dx<=-8||dx>=8||dy<=-8||dy>=8)continue;
   if(dx||(p!=255&&p!=(o[3]&7))||(o[3]&7)>2){found=0;break;}p=o[3]&7;}
  if(found&&p!=255){memset(effect_encoded,0,16);
   for(i=count;i>0;){i--;member=count==24?8+i:members[i];if(member==255)continue;o=animation_base+member*4;if(!o[0]||!o[2]||keep(o)||o[1]-8!=x)continue;dy=(int16_t)o[0]-16-y;if(dy<=-8||dy>=8)continue;
    glyph((o[3]>>3)&1,o[2]);
    overlay(o[3],(int8_t)dy);ff3_native_service();}
   p+=4;goto encoded;
  }
 }
 background_indices(a);
 /* Reverse traversal retains the original earlier-OBJ priority. */
 for(i=count;i>0;){ff3_native_service();i--;member=count==24?8+i:members[i];if(member==255)continue;o=animation_base+member*4;if(!o[0]||!o[2]||keep(o))continue;dx=(int16_t)o[1]-8-x;dy=(int16_t)o[0]-16-y;if(dx<=-8||dx>=8||dy<=-8||dy>=8)continue;
  glyph((o[3]>>3)&1,o[2]);
  overlay_indices(o[3],(int8_t)dx,(int8_t)dy);
 }
 /* No color approximation. An unrepresentable mixed cell fails closed;
 * the caller must provide a residual plane before accepting that case. */
 p=encode_colors();if(p==255)return 0;
 encoded:if(!store(2816+(uint16_t)tile*16,effect_encoded,16,1))return 0;
 /* Membership for this cell is dead now. Compact the two dependency bytes
  * behind the remaining four-byte entries, then save them in one transfer. */
 effect_members[(uint16_t)tile*2]=t;effect_members[(uint16_t)tile*2+1]=a;
 /* Geometry occupies bits 0..9; retain the palette beside its cell key.
  * The composed patterns and the source maps keep separate lifetimes. */
 effect_keys[tile]=key|((uint16_t)p<<10);return 1;
}
static uint8_t prepare_map(void){uint8_t bank,block;uint16_t at,size,key,i,first,last;uint8_t *prior=effect_members;
 memset(map_dirty,0,sizeof(map_dirty));effect_map_saved=effect_map_written=0;
 /* Composition no longer needs pixels/membership scratch. Compare the live
  * source page plus its overlay against the real destination in 256B slices.
  * No full map work copy, full-page backup, or guessed restoration. */
 for(bank=0;bank<2;bank++)for(at=0;at<576;at+=256){
  size=576-at;if(size>256)size=256;
  read_vram(bank,(old_page?0x9c00:0x9800)+at,text_staging,size);
  read_vram(bank,(new_page?0x9c00:0x9800)+at,prior,size);
  if(bank)for(i=0;i<size;i++)if((text_staging[i]&7)>=4){effect_freeze_error=8;return 0;}
  for(i=0;i<cells;i++){key=effect_keys[i]&1023;if(key>=at&&key<at+size)text_staging[key-at]=bank?effect_keys[i]>>10:i;}
  /* A VBlank handoff costs more than copying a short unchanged gap. Merge
   * the changed blocks inside this bounded slice; save those gaps too so
   * restoration still returns the exact inactive bytes. */
  first=65535;last=0;for(i=0;i<size;i+=16)if(memcmp(prior+i,text_staging+i,16)){if(first==65535)first=i;last=i+16;}
  if(first==65535)continue;
  for(i=first;i<last;i+=16){block=bank*36+(at+i)/16;map_dirty[block>>3]|=1<<(block&7);}
  size=last-first;if(!store((uint16_t)bank*576+at+first,prior+first,size,1))return 0;
  effect_map_saved+=size;ff3_text_copy(bank,(new_page?0x9c00:0x9800)+at+first,text_staging+first,size);effect_map_written+=size;ff3_native_service();
 }
 return 1;
}
static uint8_t restore_map(void){uint8_t bank,i,first,block;uint16_t size;
 for(bank=0;bank<2;bank++)for(i=0;i<36;){block=bank*36+i;if(!(map_dirty[block>>3]&(1<<(block&7)))){i++;continue;}first=i;
  /* The existing 256-byte staging buffer groups adjacent dirty blocks;
   * text DMA still splits them into the same bounded 128-byte chunks. */
  do{i++;block=bank*36+i;}while(i<36&&i-first<16&&(map_dirty[block>>3]&(1<<(block&7))));size=(uint16_t)(i-first)*16;
  if(!store((uint16_t)bank*576+(uint16_t)first*16,text_staging,size,0))return 0;
  ff3_text_copy(bank,(new_page?0x9c00:0x9800)+(uint16_t)first*16,text_staging,size);effect_map_written+=size;ff3_native_service();
 }
 return 1;
}
uint8_t ff3_effect_freeze(void) BANKED {uint8_t i;uint16_t at,size;effect_freeze_error=0;if(effect_signed)return 1;
 effect_freeze_reused=0;effect_freeze_stage=1;
 old_page=resident_page;new_page=old_page^1;if(resident_scroll){effect_freeze_error=5;return 0;}
 ff3_native_service();if(!store(1152,animation_base,160,1))return 0;ff3_native_service();
 effect_freeze_stage=2;palettes();
 if(!store(1312,effect_palettes+32,32,1))return 0;
 effect_glyph_hits=effect_glyph_reads=0;
 if(!reuse()){
 if(effect_freeze_error)return 0;effect_freeze_cache_valid=0;
 if(!gather())return 0;
 if(!cache_copy(0,animation_base,160,1)||!cache_copy(160,effect_palettes,32,1)||!cache_copy(192,effect_palettes+64,64,1))return 0;
 memcpy(effect_palettes+32,effect_palettes+64,24);mixed=0;
 /* OBJ color zero is transparent, not its stored RGB value. The borrowed
  * BG palette must encode the field's actual transparent backdrop. */
 for(i=0;i<3;i++){effect_palettes[32+i*8]=effect_palettes[0];effect_palettes[33+i*8]=effect_palettes[1];}
 memset(text_staging+128,255,16);memset(seen,0,64);cached_glyphs=0;map_group=65535;
 effect_freeze_stage=4;for(i=0;i<cells;i++){if(!compose(effect_keys[i],i)||effect_freeze_error)return 0;ff3_native_service();}
 cache_flush(cached_glyphs&3);if(effect_freeze_error)return 0;
 if(!cache_copy(448,effect_members,(uint16_t)cells*2,1)||!cache_copy(256,effect_keys,(uint16_t)cells*2,1)||!cache_copy(416,effect_palettes+32,32,1))return 0;
 cached_cells=cells;effect_freeze_cache_valid=1;
 }
 effect_freeze_stage=5;
 /* At most eight retained original objects beside 32 damage glyphs. The
 * two lower party feet remain OBJ so all live UI rows stay independently writable. */
 retained=0;for(i=8;i<40;i++)if((i>=32||keep(animation_base+i*4))&&animation_base[i*4]){if(retained==8){effect_freeze_error=6;return 0;}memmove(animation_base+retained*4,animation_base+i*4,4);retained++;}
 memmove(animation_base+128,animation_base,retained*4);memset(animation_base,0,128);memset(animation_base+128+retained*4,0,(8-retained)*4);
 effect_freeze_stage=6;if(!ff3_resident_effect_copy(0x9000,2048)){effect_freeze_error=9;return 0;}mirror(0,0x8700,0x9700,256);effect_freeze_stage=7;
 for(at=0;at<(uint16_t)cells*16;at+=256){size=(uint16_t)cells*16-at;if(size>256)size=256;if(!store(2816+at,text_staging,size,0))return 0;ff3_text_copy(0,0x9000+at,text_staging,size);ff3_native_service();}
 memcpy(text_staging,effect_palettes+32,32);ff3_text_palette_range(1,4,4,text_staging);
 effect_freeze_stage=3;if(!prepare_map())return 0;
 resident_page=new_page;effect_signed=1;effect_freeze_stage=8;return 1;
}
uint8_t ff3_effect_release(void) BANKED {uint8_t page;if(!effect_signed)return 0;
 if(!store(1152,animation_base,160,0))return 0;page=party_page^1;if(page)memcpy(party_oam1,animation_base,160);else memcpy(party_oam0,animation_base,160);
 resident_page=old_page;effect_signed=0;next_page=page;party_pending=1;while(party_pending){ff3_native_service();__asm halt __endasm;}
 if(!restore_map())return 0;
 if(!store(1312,text_staging,32,0))return 0;ff3_text_palette_range(1,4,4,text_staging);return 1;
}
