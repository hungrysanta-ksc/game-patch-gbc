#ifndef FF3_PLATFORM_CALL_H
#define FF3_PLATFORM_CALL_H
/* Standalone algorithm fixtures retain their original near-call ABI. */
#ifdef FF3_BANKED_RUNTIME
#include <gb/gb.h>
#define FF3_BANKED BANKED
#else
#define FF3_BANKED
#endif
#endif
