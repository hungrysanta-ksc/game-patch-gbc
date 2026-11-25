#ifndef FF3_BATTLE_WORKSPACE_H
#define FF3_BATTLE_WORKSPACE_H
#include <gb/gb.h>
/* Main-thread scratch, never retained by a page or read by an IRQ.
 * resident_prepare finishes its synchronous map transfers before
 * stone_prepare or boss_prepare starts. These consumers are currently
 * separate probe modes. Stone base-cell/row readers use ROM/text_staging,
 * not this map. The next resident prepare may overwrite every byte.
 * Keep page tags, signatures and cached OAM outside this union. */
typedef union {
 uint8_t map[704];
 struct {uint8_t bindings[128],tiles[32],used[256];} boss;
 struct {
  uint16_t keys[40];
  /* 0 = free, 1 = reserved retained tile, 2 = reserved dirty tile. */
  uint8_t flags[48],slots[40],extras[40],cell_sig[40];
  uint8_t base[17],glyph[16],colors[16];
 } stone;
} Ff3BattleWorkspace;
typedef char Ff3BattleWorkspaceSize[(sizeof(Ff3BattleWorkspace)==704)?1:-1];
extern Ff3BattleWorkspace __at(0xd200) battle_workspace;
#endif
