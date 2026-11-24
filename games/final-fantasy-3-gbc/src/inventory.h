#ifndef FF3_INVENTORY_H
#define FF3_INVENTORY_H
#include <stdint.h>
/* Canonical GameState $C0..FF: 32 IDs followed by 32 quantities.
 * All pointers borrow caller-owned storage. No second live battle bag. */
void ff3_inventory_pack(const uint8_t *bag,uint8_t *pairs);
void ff3_inventory_unpack(const uint8_t *pairs,uint8_t *bag);
/* Target was already accepted. Slot 0..31; eligibility/targeting is a caller.
 * Zero-quantity/nonzero-ID bytes retain original DEC wrap behaviour. */
uint8_t ff3_inventory_reserve(uint8_t *bag,uint8_t slot,uint8_t *used);
/* Returns 0 without mutation if the canonical bag has no matching/free slot.
 * That invalid-reservation case would overrun the NES 32-slot array. */
uint8_t ff3_inventory_return(uint8_t *bag,uint8_t *used,uint8_t *equipped);
#endif
