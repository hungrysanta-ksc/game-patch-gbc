#ifndef FF3_BATTLE_ITEMS_H
#define FF3_BATTLE_ITEMS_H
#include <stdint.h>
typedef struct {uint8_t row,column,scroll,selected,saved_row,saved_column;} Ff3ItemCursor;
#define FF3_ITEM_STAY 0
#define FF3_ITEM_USE 1
#define FF3_ITEM_EQUIP 2
#define FF3_ITEM_CLOSE 3
#define FF3_ITEM_ERROR 4
/* Events are caller boundaries, not successful use/equip/effects. */
void ff3_item_begin(Ff3ItemCursor *s);
uint8_t ff3_item_input(Ff3ItemCursor *s,uint8_t key);
#endif
