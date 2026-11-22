/* Diagnostic bank-call/load regression using the actual original-ROM assets.
 * Bank 9 runs a fixed-bank wrapper that maps 1..7, then resumes bank 9. */
#pragma bank 9
#include "platform.h"
#include "resource-assets.h"
volatile uint16_t platform_probe_cases;
volatile uint8_t platform_probe_failures,platform_negative_cases;
static uint8_t probe_bank=1,probe_tail;
void ff3_platform_probe(void) BANKED {
 uint8_t buffer[16],i;uint16_t sum=0,offset;
 if(CURRENT_BANK!=9){platform_probe_failures=1;return;}
 if(!platform_probe_cases){
  /* Actual scheduler expression: overdue, limit and 16-bit wrap cases. */
  if(FF3_AUDIO_IS_AHEAD(0u,1u)||FF3_AUDIO_IS_AHEAD(65535u,0u)||
     FF3_AUDIO_IS_AHEAD(1u,65535u)||FF3_AUDIO_IS_AHEAD(205u,0u)||
     !FF3_AUDIO_IS_AHEAD(206u,0u)||!FF3_AUDIO_IS_AHEAD(100u,65280u))platform_probe_failures=5;
  /* Reject invalid bank, code-as-data, first byte past end, and overrun.
   * These expected failures must not write the destination or change banks. */
  buffer[0]=0x5c;
  if(ff3_resource_copy(buffer,0,0,1)||!platform_error||buffer[0]!=0x5c)platform_probe_failures=2;
  else platform_negative_cases++;
  platform_error=0;
  if(ff3_resource_copy(buffer,8,0,1)||!platform_error||buffer[0]!=0x5c)platform_probe_failures=2;
  else platform_negative_cases++;
  platform_error=0;
  ff3_resource_byte(1,resource_lengths[1]);if(!platform_error)platform_probe_failures=2;else platform_negative_cases++;
  platform_error=0;
  if(ff3_resource_copy(buffer,1,resource_lengths[1]-1,2)||!platform_error||buffer[0]!=0x5c)platform_probe_failures=2;
  else platform_negative_cases++;
  platform_error=0;
  if(CURRENT_BANK!=9)platform_probe_failures=3;
 }
 offset=probe_tail?resource_lengths[probe_bank]-16:0;
 if(!ff3_resource_copy(buffer,probe_bank,offset,16)||CURRENT_BANK!=9)platform_probe_failures=3;
 for(i=0;i<16;i++)sum=(sum<<1)^buffer[i];
 if(sum!=resource_probe_hashes[probe_bank*2+probe_tail])platform_probe_failures=4;
 platform_probe_cases++;
 probe_bank++;if(probe_bank>RESOURCE_LAST){probe_bank=1;probe_tail^=1;}
}
