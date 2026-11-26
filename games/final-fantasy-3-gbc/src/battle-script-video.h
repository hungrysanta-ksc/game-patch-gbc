#ifndef FF3_BATTLE_SCRIPT_VIDEO_H
#define FF3_BATTLE_SCRIPT_VIDEO_H
#include "battle-script.h"
extern Ff3ActionScript action_script;
extern volatile uint8_t action_request,action_enabled,action_blocked,action_gate,action_probe;
extern volatile uint16_t action_serial;
void ff3_script_video(void) BANKED;
#endif
