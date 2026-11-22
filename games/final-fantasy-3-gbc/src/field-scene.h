#ifndef FF3_FIELD_SCENE_H
#define FF3_FIELD_SCENE_H
#include "field-event.h"
extern FF3FieldEvent field_event;
extern volatile uint8_t scene_target_shake,scene_target_revision;
void ff3_map_bank(uint8_t bank);
void ff3_scene_init(void);
void ff3_scene_video_init(void);
void ff3_scene_before(uint32_t tick);
void ff3_scene_after(uint32_t tick);
void ff3_scene_render(void);
#endif
