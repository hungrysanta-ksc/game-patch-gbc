#ifndef FF3_BATTLE_PARTY_VIDEO_H
#define FF3_BATTLE_PARTY_VIDEO_H
#include <gb/gb.h>
/* Producer must be stopped and any borrowed action resources restored first.
 * Suspends publication only; the caller still owns game/field restoration. */
uint8_t ff3_party_video_suspend(void) NONBANKED;
#endif
