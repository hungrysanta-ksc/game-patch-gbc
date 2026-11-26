#pragma bank 65
#include <gb/cgb.h>
#include <string.h>
#include "battle-magic-video.h"
#include "battle-magic-frames.h"
#include "battle-animation-video.h"
#include "battle-party-oam.h"
#include "battle-effect-freeze.h"
#include "battle-workspace.h"
#include "text-vblank.h"
#include "memory.h"
#include "magic-assets.h"
volatile uint8_t magic_tall;
uint8_t magic_error,magic_reflect_mask;
static uint8_t phase,target,mask,held,pattern_page,retained,props,bank,palette[8],old_palette[8];
static uint16_t resource;
static const uint8_t*assets;
static Ff3MagicSequence sequence;
static Ff3MagicFrame picture;
extern Ff3PartyOam party_state;
extern uint8_t __at(0xd600) animation_source[160];
extern uint8_t __at(0xd6a0) animation_base[160];
extern uint8_t __at(0xdc00) party_oam0[160];
extern uint8_t __at(0xdd00) party_oam1[160];
extern volatile uint8_t party_page,party_pending,party_work,native_request,native_argument;
extern uint8_t next_page;
void ff3_party_copy(uint8_t bank,const void*source,void*dest,uint16_t n) NONBANKED;
void ff3_native_service(void) NONBANKED;
#define packed battle_workspace.map
#define base (battle_workspace.map+576)
#define glyph (battle_workspace.map+608)
/* WRAM 3 belongs to freeze/release; WRAM 4 [0,1152) holds borrowed VRAM 1,
 * [1152,1408) holds the temporary retained-OBJ pairs in VRAM 0.
 * No mapped pointers escape ff3_wram_copy, and no other action owner runs. */
static void read_vram(uint8_t b,uint16_t address,uint8_t*out,uint16_t count){uint8_t ok;uint16_t i=0;
 while(i<count){ok=0;while(STAT_REG&3);CRITICAL{if(!(STAT_REG&3)){VBK_REG=b;out[i]=*(volatile uint8_t*)address;VBK_REG=0;ok=1;}}if(ok){i++;address++;if(!(i&15))ff3_native_service();}}
}
static uint8_t reverse_bits(uint8_t v){v=((v&85)<<1)|((v>>1)&85);v=((v&51)<<2)|((v>>2)&51);return(v<<4)|(v>>4);}
static void orient(uint8_t*out,uint8_t a){uint8_t y,i;for(y=0;y<8;y++){i=(a&64?7-y:y)*2;out[y*2]=a&32?reverse_bits(glyph[i]):glyph[i];out[y*2+1]=a&32?reverse_bits(glyph[i+1]):glyph[i+1];}}
static void publish(uint8_t page){next_page=page;party_pending=1;while(party_pending){ff3_native_service();__asm halt __endasm;}animation_video_frames++;if(animation_video_probe)animation_video_gate=1;}
static void sound(uint8_t v){while(native_request){ff3_native_service();__asm halt __endasm;}native_argument=v&127;native_request=v==255?8:7;}
static uint8_t borrow(void){uint16_t at;uint8_t i,ok,*q;
 for(i=0;i<8;i++){ok=0;while(!ok){while(STAT_REG&3);CRITICAL{if(!(STAT_REG&3)){OCPS_REG=24+i;old_palette[i]=OCPD_REG;ok=1;}}}}
 if(!ff3_effect_freeze())return 0;
 /* The signed BG clone now protects background pixels during OBJ borrowing. */
 for(at=0;at<1152;at+=128){read_vram(1,0x8000+at,text_staging,128);if(!ff3_wram_copy(4,at,text_staging,128,1))return 0;ff3_native_service();}
 for(at=0;at<256;at+=128){read_vram(0,0x84a0+at,text_staging,128);if(!ff3_wram_copy(4,1152+at,text_staging,128,1))return 0;}
 retained=0;memset(base,0,32);
 for(i=32;i<40;i++){q=animation_base+i*4;if(!q[0])continue;
  if(retained==8||(!(q[3]&8)&&q[2]>=74&&q[2]<90))return 0;read_vram((q[3]>>3)&1,0x8000+(uint16_t)q[2]*16,glyph,16);orient(text_staging,q[3]);memset(text_staging+16,0,16);
  ff3_text_copy(0,0x84a0+(uint16_t)retained*32,text_staging,32);memcpy(base+retained*4,q,4);base[retained*4+2]=74+retained*2;base[retained*4+3]=q[3]&7;retained++;
 }
 return 1;
}
static uint8_t release(void){uint16_t at;for(at=0;at<1152;at+=128){if(!ff3_wram_copy(4,at,text_staging,128,0))return 0;ff3_text_copy(1,0x8000+at,text_staging,128);ff3_native_service();}
 magic_tall=0;memcpy(text_staging,old_palette,8);ff3_text_palette_range(0,3,1,text_staging);if(!ff3_effect_release())return 0;
 for(at=0;at<256;at+=128){if(!ff3_wram_copy(4,1152+at,text_staging,128,0))return 0;ff3_text_copy(0,0x84a0+at,text_staging,128);}
 return 1;
}
static uint8_t show(uint8_t frame){uint8_t i,j,k,pair=0,n=0,page=party_page^1,*out=page?party_oam1:party_oam0,*q,*r,*top,*bottom,a;int16_t x,y,minx=255,miny=255,dx,dy;uint16_t at;
 memset(out,0,160);
 if(frame){
  if(!ff3_magic_frame(&picture,animation_source))return 0;ff3_native_service();
  dx=picture.back?-16:-80;dy=-33-target*4;
  for(i=0;i<36;i++){q=animation_source+i*4;x=(picture.back?(int8_t)q[3]:(int16_t)q[3])+dx;if(x<minx)minx=x;}
  /* Use the complete 48px extent, not the changing opaque silhouette. */
  miny=(int16_t)picture.y-12-((props&32)?12:0)+dy;
  if(minx<0)dx-=minx;else if(minx>112)dx-=minx-112;
  if(miny<0)dy-=miny;else if(miny>96)dy-=miny-96;
  memset(packed,0,576);
  for(i=0;i<3;i++)for(j=0;j<6;j++,pair++){
   ff3_native_service();
   q=animation_source+(i*12+j)*4;r=q+24;
   /* Y can be F0 for a blank cell. Row orientation comes from the frame. */
   top=picture.vertical?r:q;bottom=picture.vertical?q:r;
   for(k=0;k<2;k++){q=k?bottom:top;if(!q[1])continue;ff3_party_copy(bank,assets+resource+(uint16_t)(q[1]-73)*16,glyph,16);a=((q[2]&64)>>1)|((q[2]&128)>>1);orient(packed+(uint16_t)pair*32+k*16,a);}
   a=0;for(k=0;k<32;k++)a|=packed[(uint16_t)pair*32+k];if(!a)continue;
   x=(picture.back?(int8_t)top[3]:(int16_t)top[3])+dx;
   y=(int16_t)picture.y-12-((props&32)?12:0)+(picture.vertical?(2-i)*16:i*16)+dy;
   if(x<0||x>152||y<0||y>128)return 0;
   out[n*4]=y+16;out[n*4+1]=x+8;out[n*4+2]=pattern_page*36+pair*2;out[n*4+3]=11;n++;
  }
  for(at=0;at<576;at+=128){uint16_t size=576-at;if(size>128)size=128;memcpy(text_staging,packed+at,size);ff3_text_copy(1,0x8000+(uint16_t)pattern_page*576+at,text_staging,size);ff3_native_service();}
 }else memset(animation_source,240,160);
 memcpy(out+n*4,base,retained*4);n+=retained;if(n>40)return 0;
 /* Pattern transfers are complete, so reuse their scratch for line counts.
  * Count each OBJ's 16 rows once instead of 144 rows times every OBJ. */
 memset(packed,0,144);
 for(i=0;i<n;i++){ff3_native_service();y=(int16_t)out[i*4]-16;x=y+16;
  if(y<0)y=0;if(x>144)x=144;for(;y<x;y++)if(++packed[y]>10)return 0;
 }
 magic_tall=1;publish(page);pattern_page^=1;return 1;
}
void ff3_magic_reset(void) BANKED {phase=magic_error=magic_tall=0;}
uint8_t ff3_magic_video(void) BANKED {uint8_t decoded[2],v;
 if(!phase){
  /* First live consumer: the complete enemy-cast ordinary body. Party
   * precast/projectiles, reflection and bespoke bodies require their owners. */
  if(animation_state.magic||!(animation_state.flags&128)||(animation_state.flags&64)||animation_state.spell>=88||magic_reflect_mask||(animation_state.hit&15)||effect_signed)return 2;
  v=animation_state.spell/24;bank=66+v;assets=magic_resources[v];resource=(uint16_t)(animation_state.spell%24)*523;
  ff3_party_copy(bank,assets+resource+512,palette,8);ff3_party_copy(bank,assets+resource+520,&props,1);
  party_work=2;if(!borrow()){magic_error=1;goto fault;}
  picture.enemy=0;picture.back=party_state.battle_type==0x88;picture.properties=props;picture.magic=0;mask=animation_state.hit;target=0;held=0;pattern_page=0;
  sound(255);memcpy(text_staging,palette,8);ff3_text_palette_range(0,3,1,text_staging);if(!show(0)){magic_error=2;goto fault;}phase=1;goto pending;
 }
 party_work=2;ff3_native_service();
 if(held){publish(party_page);held--;goto pending;}
 if(phase==1){while(target<4&&!(mask&(128>>target)))target++;
  if(target==4){if(!show(0)){magic_error=3;goto fault;}phase=3;goto pending;}
  picture.x=party_state.x[target];picture.y=party_state.y[target];
  if(!ff3_magic_begin(&sequence,animation_state.spell,0)){magic_error=4;goto fault;}
  sound(animation_state.sound);phase=2;
 }
 if(phase==2){v=ff3_magic_next(&sequence,decoded);if(v==255){magic_error=5;goto fault;}
  if(!v){if(!show(0)){magic_error=6;goto fault;}target++;phase=1;goto pending;}
  picture.code=decoded[0];picture.vertical=decoded[1];if(!show(1)){magic_error=7;goto fault;}held=3;goto pending;
 }
 if(phase==3){if(!release()){magic_error=8;goto fault;}phase=0;party_work=0;return 1;}
 pending:party_work=0;return 0;
 fault:party_work=0;return 3;
}
