#ifndef FF3_LIVE_PARTY_H
#define FF3_LIVE_PARTY_H
#include <gb/gb.h>
/* Shared command/party resources have a separate owner from enemy seeds. */
#define FF3_PARTY_SHARED(p) ((p)<4?(p):(((p)-4)&1)*2)
/* Controlled live-party entry; enemy formation and result owners are not
 * supplied by this adapter. WRAM 5 [0,256) holds four source battle records. */
extern uint8_t live_party_error,live_party_ready;
uint8_t ff3_live_party_prepare(void) BANKED;
void ff3_live_party_command(void) BANKED;
#endif
