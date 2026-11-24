#ifndef FF3_BATTLE_ROW_H
#define FF3_BATTLE_ROW_H
#include <gb/gb.h>
/* One original command boundary. Arrow coordinates remain NES coordinates;
 * the GBC layout consumer must project them separately. */
typedef struct {
 uint8_t actor,equipment_row,formation,command,phase,cancel,action;
 uint8_t arrow_y,arrow_tile,arrow_attr,arrow_x,sound,battle_row,name,script,flags;
} Ff3Row;
enum { FF3_ROW_PENDING,FF3_ROW_CANCELLED,FF3_ROW_RESERVED,FF3_ROW_REJECTED };
uint8_t ff3_row_begin(Ff3Row *s) BANKED;
void ff3_row_key(Ff3Row *s,uint8_t key) BANKED;
uint8_t ff3_row_execute(Ff3Row *s) BANKED;
#endif
