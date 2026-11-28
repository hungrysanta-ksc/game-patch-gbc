#pragma bank 124
#include <string.h>
#include "battle-cell-pool.h"
#include "text-vblank.h"
#include "memory.h"
void ff3_native_service(void) NONBANKED;
uint8_t cell_pool_error,cell_pool_peak;
uint16_t cell_pool_written,cell_pool_reused;
static uint8_t base,limit,used,batch,active;
#define signatures ((uint8_t*)0xd640)
#define comparison ((uint8_t*)0xd680)
/* BAA2/BB13/A247 retain slot identity independently of shared patterns.
 * GBC's 28px layout can put two slots in one cell; preserve that mask at
 * the caller, then intern only the exact final two-bit glyph. The original
 * map's pattern reuse is retained without treating tile id as enemy id. */
uint8_t ff3_cell_mask_local(uint8_t*g,const uint8_t*erase) {uint8_t y,bits=0,changed=0,a,b,m;
 /* Each resident row is read once, then both bitplanes are committed.
  * Walking pointers avoids SDCC's repeated 16-bit y*2 stack arithmetic. */
 for(y=8;y;y--){m=*erase++;a=g[0];b=g[1];changed|=(a|b)&m;m=~m;a&=m;b&=m;*g++=a;*g++=b;bits|=a|b;}
 return changed?(bits?2:1):0;
}
uint8_t ff3_cell_mask(uint8_t*g,const uint8_t*erase) BANKED {return ff3_cell_mask_local(g,erase);}
/* B6C8 replaces owned map cells, including their black pixels. An explicit
 * row mask also supports the two-row V6/UI boundary without cutting ink.
 * This kernel neither assumes transparent zero nor changes palette IDs. */
uint8_t ff3_cell_paint_local(uint8_t*g,const uint8_t*source,const uint8_t*mask) {uint8_t y,a,b,m,old,changed=0,bits=0;
 for(y=8;y;y--){m=*mask++;old=g[0];a=(old&~m)|(*source++&m);changed|=old^a;old=g[1];b=(old&~m)|(*source++&m);changed|=old^b;*g++=a;*g++=b;bits|=a|b;}
 return changed?(bits?2:1):0;
}
uint8_t ff3_cell_paint(uint8_t*g,const uint8_t*source,const uint8_t*mask) BANKED {return ff3_cell_paint_local(g,source,mask);}
static void flush(void){if(!batch)return;
 ff3_text_copy(1,0x8000u+(uint16_t)(base+used-batch)*16,text_staging,(uint16_t)batch*16);batch=0;ff3_native_service();
}
void ff3_cell_pool_reset(void) BANKED {active=used=batch=cell_pool_error=cell_pool_peak=0;cell_pool_written=cell_pool_reused=0;}
uint8_t ff3_cell_pool_begin(uint8_t first,uint8_t count,uint8_t shared) BANKED {
 if(cell_pool_error)return 0;
 if(active||batch||first<128||!count||count>FF3_CELL_POOL_LIMIT||(uint16_t)first+count>256||shared>1){cell_pool_error=1;return 0;}
 base=first;limit=count|(shared?128:0);used=batch=0;active=1;return 1;
}
uint8_t ff3_cell_pool_tile_local(const uint8_t*g) {uint8_t i,sig=0,id;
 if(cell_pool_error||!active){cell_pool_error=2;return 0;}
 if(limit&128){
 for(i=0;i<16;i++)sig=(sig<<1|sig>>7)^g[i];
 /* A signature is only a filter: collisions always compare all 16 bytes.
  * Unused old directory entries are outside used and cannot be returned. */
 for(i=0;i<used;i++){if(!(i&7))ff3_native_service();if(signatures[i]==sig){
  if(!ff3_wram_copy(6,FF3_CELL_POOL_STORAGE+(uint16_t)i*16,comparison,16,0)){cell_pool_error=3;return 0;}
  if(!memcmp(g,comparison,16)){cell_pool_reused++;return base+i;}
 }}
 }
 if(used>=(limit&127)){cell_pool_error=4;return 0;}
 if(limit&128){if(!ff3_wram_copy(6,FF3_CELL_POOL_STORAGE+(uint16_t)used*16,(void*)g,16,1)){cell_pool_error=3;return 0;}signatures[used]=sig;}
 memcpy(text_staging+(uint16_t)batch*16,g,16);id=base+used++;batch++;cell_pool_written++;
 if(used>cell_pool_peak)cell_pool_peak=used;if(batch==16)flush();return id;
}
uint8_t ff3_cell_pool_tile(const uint8_t*g) BANKED {return ff3_cell_pool_tile_local(g);}
/* Stone follows the death stencil in the same transaction. Read the exact
 * current glyph even if its upload is still in the pending batch. */
uint8_t ff3_cell_pool_read_local(uint8_t id,uint8_t*g){
 if(!active||!(limit&128)||id<base||id>=base+used)return 0;
 if(!ff3_wram_copy(6,FF3_CELL_POOL_STORAGE+(uint16_t)(id-base)*16,g,16,0)){cell_pool_error=3;return 0;}return 1;
}
uint8_t ff3_cell_pool_finish(void) BANKED {if(cell_pool_error||!active){cell_pool_error=5;return 0;}flush();active=0;return 1;}
