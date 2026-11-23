#ifndef FF3_MEMORY_H
#define FF3_MEMORY_H
#include <gb/gb.h>
/* Bank 1 owns the live stack and active field/window workspace. Other WRAM
 * banks are storage, never a mapped execution mode. No pointers escape them.
 * Bank 2: diagnostics [0,464). Banks 3..7: future mode storage, unclaimed. */
#define FF3_WRAM_DIAGNOSTICS 2u
#define FF3_WRAM_SNAPSHOT_BYTES 232u
#define FF3_WRAM_CHUNK 16u
#ifdef FF3_EXPLORATION
#define FF3_LIVE_STACK_FLOOR 0xdcb0u
#else
#define FF3_LIVE_STACK_FLOOR 0xdb70u
#endif
/* Main-thread only, non-reentrant. Entry/exit SVBK=1; buffer is ordinary
 * C000..DFFF RAM (including a caller's stack). Complete range validation
 * precedes writes. write=0 reads storage, write=1 writes storage.
 * Bank 1 is restored and interrupt state preserved after each <=16B chunk. */
uint8_t ff3_wram_copy(uint8_t bank,uint16_t offset,void *buffer,uint16_t count,uint8_t write) NONBANKED;
void ff3_memory_init(void) NONBANKED;
extern volatile uint8_t memory_busy,memory_fault;
/* Diagnostic probe runs only on an explicit verifier request. */
void ff3_memory_probe(void) BANKED;
extern volatile uint8_t memory_probe_request,memory_probe_done;
extern volatile uint16_t memory_probe_cases,memory_probe_failures;
#endif
