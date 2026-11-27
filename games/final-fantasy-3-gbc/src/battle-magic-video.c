#pragma bank 65
#include <gb/cgb.h>
#include <string.h>
#include "battle-magic-video.h"
#include "battle-magic-frames.h"
#include "battle-animation-video.h"
#include "battle-party-oam.h"
#include "battle-effect-freeze.h"
#include "battle-resident-bg.h"
#include "battle-workspace.h"
#include "text-vblank.h"
#include "memory.h"
#include "magic-assets.h"
volatile uint8_t magic_tall;
uint8_t magic_error,magic_reflect_mask;
static uint8_t phase,target,mask,held,retained,props,bank,frame_count,last_code,palette[8],old_palette[8];
static uint16_t pool_bytes;
static const uint8_t *assets,*patterns;
static Ff3MagicSequence sequence;
static Ff3MagicFrame picture;
static Ff3MagicSequence future_sequence;
static Ff3MagicFrame future_picture;
static uint8_t prepared_kind,prepared_page;
volatile uint8_t magic_prepare_stage,magic_prepare_ahead;
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
/* The current original OAM stays in animation_source through all four waits.
 * Future source OAM occupies unused scratch beside the retained line counts;
 * future native OAM lives only in the inactive hardware shadow. */
#define future_source (battle_workspace.map+144)
/* Three disjoint 16px grid rows: screen Y and populated OBJ count. */
#define rows (battle_workspace.map+304)
#define base (battle_workspace.map+576)
#define glyph (battle_workspace.map+648)
#define pairs (battle_workspace.map+648)
/* WRAM 3 belongs to freeze/release; WRAM 4 [3280,3856) holds temporary
 * retained-OBJ pairs in VRAM 0. VRAM 1's borrowed prefix has a ROM owner.
 * No mapped pointers escape ff3_wram_copy, and no other action owner runs. */
#define read_vram ff3_effect_read
static uint8_t reverse_bits(uint8_t v){v=((v&85)<<1)|((v>>1)&85);v=((v&51)<<2)|((v>>2)&51);return(v<<4)|(v>>4);}
static void orient(uint8_t*out,uint8_t a){uint8_t y,i;for(y=0;y<8;y++){i=(a&64?7-y:y)*2;out[y*2]=a&32?reverse_bits(glyph[i]):glyph[i];out[y*2+1]=a&32?reverse_bits(glyph[i+1]):glyph[i+1];}}
static void request(uint8_t page){next_page=page;party_pending=1;}
static void complete(void){while(party_pending){ff3_native_service();__asm halt __endasm;}animation_video_frames++;if(animation_video_probe)animation_video_gate=1;}
static void publish(uint8_t page){request(page);complete();}
static void sound(uint8_t v){while(native_request){ff3_native_service();__asm halt __endasm;}native_argument=v&127;native_request=v==255?8:7;}
static uint8_t borrow(void){uint16_t at;uint8_t i,ok,*q;int16_t y,end;
 for(i=0;i<8;i++){ok=0;while(!ok){while(STAT_REG&3);CRITICAL{if(!(STAT_REG&3)){OCPS_REG=24+i;old_palette[i]=OCPD_REG;ok=1;}}}}
 effect_keep_head=1;if(!ff3_effect_freeze())return 0;
 /* The signed BG clone now protects background pixels during OBJ borrowing. */
 for(at=0;at<576;at+=128){read_vram(0,0x84a0+at,text_staging,at==512?64:128);if(!ff3_wram_copy(4,3280+at,text_staging,at==512?64:128,1))return 0;}
 retained=0;memset(base,0,72);memset(packed,0,144);
 for(i=40-effect_retained;i<40;i++){q=animation_base+i*4;if(!q[0])continue;
  if(retained==18||(!(q[3]&8)&&q[2]>=74&&q[2]<110))return 0;if(retained&&!(retained&7))ff3_text_copy(0,0x84a0+(uint16_t)(retained-8)*32,text_staging,256);read_vram((q[3]>>3)&1,0x8000+(uint16_t)q[2]*16,glyph,16);orient(text_staging+(uint16_t)(retained&7)*32,q[3]);memset(text_staging+(uint16_t)(retained&7)*32+16,0,16);
  memcpy(base+retained*4,q,4);base[retained*4+2]=74+retained*2;base[retained*4+3]=q[3]&7;retained++;
  /* These retained cells do not move until release(). Count their real
   * clipped 16px hardware span once for the entire magic action. */
  y=(int16_t)q[0]-16;end=q[0];if(y<0)y=0;if(end>144)end=144;
  for(;y<end;y++)packed[y]++;ff3_native_service();
 }
 /* No consumer owns these pairs until clear() publishes tall OAM. Collect
  * all retained cells before the bounded transfer, not one wait per cell. */
 if(retained)ff3_text_copy(0,0x84a0+(uint16_t)((retained-1)&248)*32,text_staging,(uint16_t)(((retained-1)&7)+1)*32);
 /* B589 ownership: upload the dictionary once, before any effect uses it. */
 ff3_text_rom_copy(1,0x8000,bank,patterns,pool_bytes);
 return 1;
}
static uint8_t release(void){if(!ff3_resident_effect_copy(0x8000,pool_bytes))return 0;
 magic_tall=0;memcpy(text_staging,old_palette,8);ff3_text_palette_range(0,3,1,text_staging);if(!ff3_effect_release(1))return 0;effect_keep_head=0;
 return 1;
}
static uint8_t prepare_source(void){uint8_t decoded[2];
 magic_prepare_stage=1;prepared_page=party_page^1;future_sequence=sequence;future_picture=picture;
 prepared_kind=ff3_magic_next(&future_sequence,decoded);if(prepared_kind==255)return 0;
 if(prepared_kind){future_picture.code=decoded[0];future_picture.vertical=decoded[1];if(!ff3_magic_frame(&future_picture,future_source))return 0;}
 else memset(future_source,240,160);
 ff3_native_service();magic_prepare_stage=2;return 1;
}
static uint8_t project(void){uint8_t i,j,pair=0,n=0,*out=prepared_page?party_oam1:party_oam0,*q,a,code;int16_t x,y,minx=255,miny=255,dx,dy;const uint8_t*record;const Ff3MagicFrame*p=&future_picture;
 memset(out,0,160);
 if(prepared_kind){
  dx=p->back?-16:-80;dy=-33-target*4;
  /* B765..B797 resets X after each six cells: every row has the same Xs,
   * including transparent cells, horizontal flips and back attacks. */
  for(i=0;i<6;i++){q=future_source+i*4;x=(p->back?(int8_t)q[3]:(int16_t)q[3])+dx;if(x<minx)minx=x;}
  /* Use the complete 48px extent, not the changing opaque silhouette. */
  miny=(int16_t)p->y-12-((props&32)?12:0)+dy;
  if(minx<0)dx-=minx;else if(minx>112)dx-=minx-112;
  if(miny<0)dy-=miny;else if(miny>96)dy-=miny-96;
  code=p->code&127;
  if(code!=last_code){record=assets+10;for(i=0;i<frame_count;i++,record+=19){ff3_party_copy(bank,record,&a,1);if(a==code)break;}if(i==frame_count)return 0;ff3_party_copy(bank,record+1,pairs,18);last_code=code;}
  for(i=0;i<3;i++){
   y=(int16_t)p->y-12-((props&32)?12:0)+(p->vertical?(2-i)*16:i*16)+dy;
   if(y<0||y>128)return 0;rows[i*2]=y;rows[i*2+1]=0;
   for(j=0;j<6;j++,pair++){
   if(pairs[pair]==255)continue;
   q=future_source+(i*12+j)*4;
   x=(p->back?(int8_t)q[3]:(int16_t)q[3])+dx;
   y=rows[i*2];
   if(x<0||x>152||y<0||y>128)return 0;
   out[n*4]=y+16;out[n*4+1]=x+8;out[n*4+2]=pairs[pair]*2;out[n*4+3]=11|(((p->code>>7)^p->back)?32:0)|(p->vertical?64:0);n++;rows[i*2+1]++;
   if(!(pair&3))ff3_native_service();
  }
  }
 }
 memcpy(out+n*4,base,retained*4);n+=retained;if(n>40)return 0;
 magic_prepare_stage=3;return 1;
}
static uint8_t capacity(void){uint8_t i,y,end,n;
 /* Empty source pictures still validate the retained OBJ scanline census. */
 if(!prepared_kind){for(y=0;y<144;y++)if(packed[y]>10)return 0;magic_prepare_stage=4;return 1;}
 /* B765's fixed grid becomes three disjoint native 16px rows. Count all
  * cells in each row together against the resident retained-OBJ census.
  * No pixel or object is dropped, and the actual ten-per-line limit stays. */
 for(i=0;i<3;i++){ff3_native_service();y=rows[i*2];n=rows[i*2+1];end=y+16;
  for(;y<end;y++)if(packed[y]+n>10)return 0;
 }
 magic_prepare_stage=4;return 1;
}
static void commit(void){magic_prepare_stage=5;memcpy(animation_source,future_source,160);magic_tall=1;publish(prepared_page);magic_prepare_stage=magic_prepare_ahead=0;}
static uint8_t clear(void){magic_prepare_ahead=0;magic_prepare_stage=1;prepared_page=party_page^1;prepared_kind=0;memset(future_source,240,160);magic_prepare_stage=2;if(!project()||!capacity())return 0;commit();return 1;}
void ff3_magic_reset(void) BANKED {phase=magic_error=magic_tall=magic_prepare_stage=magic_prepare_ahead=effect_keep_head=0;}
uint8_t ff3_magic_video(void) BANKED {const MagicAsset*asset;
 if(!phase){
  /* First live consumer: the complete enemy-cast ordinary body. Party
   * precast/projectiles, reflection and bespoke bodies require their owners. */
  if(animation_state.magic||!(animation_state.flags&128)||(animation_state.flags&64)||animation_state.spell>=88||magic_reflect_mask||(animation_state.hit&15)||effect_signed)return 2;
  mask=animation_state.hit;party_work=2;
  /* An empty hit mask still has the original two waits and FF stop, but no
   * picture can reference the pool, so do not borrow display resources. */
  if(!mask){sound(255);memset(animation_source,240,160);publish(party_page);phase=4;goto pending;}
  asset=magic_assets+animation_state.spell;bank=asset->bank;assets=asset->data;patterns=asset->patterns;pool_bytes=asset->bytes;
  ff3_party_copy(bank,assets,palette,8);ff3_party_copy(bank,assets+8,&props,1);ff3_party_copy(bank,assets+9,&frame_count,1);last_code=255;
  /* B696..B6D1 loads/validates once; B6F5 only resets the target cursor. */
  if(!ff3_magic_begin(&sequence,animation_state.spell,0)){magic_error=4;goto fault;}
  party_work=2;if(!borrow()){magic_error=1;goto fault;}
  picture.enemy=0;picture.back=party_state.battle_type==0x88;picture.properties=props;picture.magic=0;target=0;held=0;
  sound(255);memcpy(text_staging,palette,8);ff3_text_palette_range(0,3,1,text_staging);if(!clear()){magic_error=2;goto fault;}phase=1;goto pending;
 }
 party_work=2;ff3_native_service();
 if(phase==4){publish(party_page);phase=5;goto pending;}
 if(phase==5){phase=0;party_work=0;return 1;}
 if(held){
  /* B7A9's remaining three waits publish the CURRENT shadow. Prepare one
   * future stage while waiting for each VBlank; never change its source OAM,
   * sound request or target. Commit only after all four original waits. */
  request(party_page);
  if(held==3){magic_prepare_ahead=1;if(!prepare_source()){magic_error=5;goto fault;}}
  else if(held==2){if(!project()){magic_error=7;goto fault;}}
  else if(!capacity()){magic_error=7;goto fault;}
  complete();held--;goto pending;
 }
 if(phase==1){while(target<4&&!(mask&(128>>target)))target++;
  /* B70B/B70E already committed the empty source picture. BB0F/BB12 has
   * the identical OAM and still requires its own publication/wait. */
  if(target==4){publish(party_page);phase=3;goto pending;}
  picture.x=party_state.x[target];picture.y=party_state.y[target];
  sequence.index=1;
  sound(animation_state.sound);phase=2;
 }
 if(phase==2){
  if(magic_prepare_stage!=4){magic_prepare_ahead=0;if(!prepare_source()||!project()||!capacity()){magic_error=7;goto fault;}}
  sequence=future_sequence;picture=future_picture;commit();
  if(!prepared_kind){target++;phase=1;goto pending;}
  held=3;goto pending;
 }
 if(phase==3){if(!release()){magic_error=8;goto fault;}phase=0;party_work=0;return 1;}
 pending:party_work=0;return 0;
 fault:party_work=0;return 3;
}
