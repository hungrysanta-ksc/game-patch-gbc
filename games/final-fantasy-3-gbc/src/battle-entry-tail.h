#ifndef FF3_ENTRY_TAIL_H
#define FF3_ENTRY_TAIL_H
#include "battle-entry.h"
enum {FF3_TAIL_BOSS=1,FF3_TAIL_CANONICAL,FF3_TAIL_HIDE,FF3_TAIL_LOAD,
 FF3_TAIL_MOVE,FF3_TAIL_INNER,FF3_TAIL_STATUS,FF3_TAIL_DONE};
typedef struct {
 Ff3EntryDisplay motion;
 uint8_t status2[4],graphics[4],jobs[4],types[8],counts[5];
 uint8_t layout,flags,graphic,phase,actor,chunk,shift,loaded,total;
 uint16_t ticket;
} Ff3EntryTail;
/* Original-resource descriptor (8 bytes): kind, asset, byte offset LE,
 * byte count, NES PPU destination LE, reserved zero. Kind 1 = boss pattern,
 * 2 = job/small pattern, 3 = two-column stone/clear map. The GBC renderer
 * maps resource identity to native assets/VRAM; these are not GB addresses.
 * Buffers/state are WRAM. All invalid calls leave state/output unchanged. */
uint8_t ff3_entry_tail_start(Ff3EntryTail*s) FF3_STATE_BANKED;
/* 2F/B5B8: refresh all four actors after the caller updates normalized
 * status. Keep coordinates/resources/counts; do not repeat canonical entry
 * or its B909 monster recount. Private chunk bit 7 records this return path;
 * bit 6 records B3F6's backward motion after the boss phase has ended. */
uint8_t ff3_entry_tail_refresh(Ff3EntryTail*s) FF3_STATE_BANKED;
uint8_t ff3_entry_tail_ack(Ff3EntryTail*s,uint16_t ticket) FF3_STATE_BANKED;
uint8_t ff3_entry_tail_work(const Ff3EntryTail*s,uint8_t*out) FF3_STATE_BANKED;
/* src supplies one unmodified source pattern block. Map work uses extracted
 * source map tables instead. Output keeps NES 2bpp for the encoder boundary. */
uint8_t ff3_entry_tail_bytes(const Ff3EntryTail*s,const uint8_t*src,uint8_t*out) FF3_STATE_BANKED;
#endif
