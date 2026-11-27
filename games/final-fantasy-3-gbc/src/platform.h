#ifndef FF3_PLATFORM_H
#define FF3_PLATFORM_H
#include <gb/gb.h>
/* MBC5 low 8-bit banks only. Timer IRQ never maps ROM. VBlank's fixed-ROM
 * DMA pump may map/restore ROM inside one bounded DMA section; no IRQ may
 * call BANKED code or expose a changed ROM bank to interrupted code. */
uint8_t ff3_resource_byte(uint8_t bank,uint16_t offset) NONBANKED;
uint8_t ff3_resource_copy(void *dest,uint8_t bank,uint16_t offset,uint16_t count) NONBANKED;
uint16_t ff3_clock_now(void) NONBANKED;
#ifdef FF3_SCENE_LAYOUT
#define FF3_PLATFORM_BOOT BANKED
#else
#define FF3_PLATFORM_BOOT
#endif
void ff3_platform_init(void) FF3_PLATFORM_BOOT;
void ff3_platform_check(void) FF3_PLATFORM_BOOT;
/* Original persistent-state layout, NES $6000..63FF. Boot diagnostics run
 * 3A/8E76 initialization before name entry, message speed or map entry. */
extern uint8_t ff3_game_state[1024];
extern volatile uint8_t platform_error;
extern volatile uint16_t platform_checks;
#define FF3_WORK_BEGIN 0xd000u
#define FF3_WORK_END 0xd7f0u
#define FF3_STACK_GUARD 0xd7f0u
#define FF3_STACK_FLOOR 0xd800u
void ff3_platform_probe(void) BANKED;
extern volatile uint16_t platform_probe_cases;
extern volatile uint8_t platform_probe_failures,platform_negative_cases;
#define FF3_TIMER_HZ 4096ul
#define FF3_LOGIC_STEP 68u
#define FF3_LOGIC_FRACTION 92816ul
#define FF3_LOGIC_DENOMINATOR 600988ul
/* Keep comparison signed: an overdue packet must not become "full". */
#define FF3_AUDIO_AHEAD 205
#define FF3_AUDIO_IS_AHEAD(due,now) ((int16_t)((due)-(now))>FF3_AUDIO_AHEAD)
#endif
