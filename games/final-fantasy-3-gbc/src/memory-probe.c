#pragma bank 11
#include <gb/cgb.h>
#include <string.h>
#include "memory.h"
#include "platform.h"
void ff3_native_service(void) NONBANKED;
volatile uint8_t memory_probe_request,memory_probe_done;
volatile uint16_t memory_probe_cases,memory_probe_failures;
static void result(uint8_t ok){memory_probe_cases++;if(!ok)memory_probe_failures++;}
/* Explicit destructive storage test; banks 3..7 have no game owners yet.
 * Never touch bank 2's published diagnostic snapshots [0,464). */
void ff3_memory_probe(void) BANKED {
 uint8_t b[32],bank,i,ie,saved=CURRENT_BANK;uint16_t offset,n;
 memory_probe_done=memory_probe_failures=0;memory_probe_cases=0;
 for(bank=2;bank<=7;bank++){
  for(offset=512;offset<4096;offset+=32){
   for(i=0;i<32;i++)b[i]=(uint8_t)(offset+i)^(uint8_t)(offset>>8)^bank;
   result(ff3_wram_copy(bank,offset,b,32,1));memset(b,0,32);
   result(ff3_wram_copy(bank,offset,b,32,0));
   for(i=0;i<32;i++)if(b[i]!=((uint8_t)(offset+i)^(uint8_t)(offset>>8)^bank)){memory_probe_failures++;break;}
   ff3_native_service();
  }
  /* Unaligned chunk tails, zero count and the very last byte. */
  for(n=0;n<=32;n++){for(i=0;i<32;i++)b[i]=i^bank;
   result(ff3_wram_copy(bank,4096-n,b,n,1));memset(b,0,32);
   result(ff3_wram_copy(bank,4096-n,b,n,0));
   for(i=0;i<n;i++)if(b[i]!=(i^bank)){memory_probe_failures++;break;}
   ff3_native_service();
  }
 }
 result(!ff3_wram_copy(0,0,b,1,1));result(!ff3_wram_copy(1,0,b,1,1));
 result(!ff3_wram_copy(8,0,b,1,1));result(!ff3_wram_copy(255,0,b,1,1));
 result(!ff3_wram_copy(3,4096,b,1,1));result(!ff3_wram_copy(3,4097,b,0,1));
 result(!ff3_wram_copy(3,4095,b,2,1));result(!ff3_wram_copy(3,0,b,65535,1));
 result(!ff3_wram_copy(3,0,(void*)0xbfff,1,1));result(!ff3_wram_copy(3,0,(void*)0xdfff,2,0));
 result(!ff3_wram_copy(3,0,b,1,2));memory_busy=1;result(!ff3_wram_copy(3,0,b,1,1));memory_busy=0;
 ie=IE_REG;
 for(i=0;i<4;i++){bank=(i&1)|((i&2)<<1);IE_REG=bank;
  result(ff3_wram_copy(6,0,b,16,1));result(IE_REG==bank);
 }
 IE_REG=ie;
 CRITICAL{result(ff3_wram_copy(6,0,b,16,1));result(ff3_wram_copy(6,0,b,16,0));}
 /* Fixed-to-banked and banked-to-fixed fast paths, including a partial
  * chunk/page crossing. The external verifier compares all 1024 original
  * bytes before/after; no gameplay runs during this isolated probe. */
 result(ff3_wram_copy(6,0x301,ff3_game_state,259,1));
 memset(ff3_game_state,0,259);
 result(ff3_wram_copy(6,0x301,ff3_game_state,259,0));
 /* Capture actual persistent state and live workspace in separate storage.
  * Compare by small reads without replacing active state or injecting a
  * synthetic menu/battle. Audio keeps running between every chunk. */
 for(bank=3;bank<=4;bank++){
  uint8_t *source=bank==3?(uint8_t*)0xd000:ff3_game_state;
  uint16_t bytes=bank==3?FF3_LIVE_STACK_FLOOR-0xd000u:1024u;
  for(offset=0;offset<bytes;offset+=n){n=bytes-offset>32?32:bytes-offset;
   result(ff3_wram_copy(bank,offset,source+offset,n,1));
   result(ff3_wram_copy(bank,offset,b,n,0));result(!memcmp(b,source+offset,n));
   ff3_native_service();
  }
 }
 result((SVBK_REG&7)==1&&CURRENT_BANK==saved&&!memory_busy&&!memory_fault);
 memory_probe_done=0xa5;
}
