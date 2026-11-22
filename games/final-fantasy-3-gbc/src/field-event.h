#ifndef FF3_FIELD_EVENT_H
#define FF3_FIELD_EVENT_H
#include <stdint.h>
typedef struct {uint8_t map[1024];uint8_t pc,shaking,phase,shake,revision,done,error;} FF3FieldEvent;
uint8_t ff3_field_script(uint8_t offset);
void ff3_field_request(uint8_t reg,uint8_t value);
void ff3_field_tick(FF3FieldEvent *s);
void ff3_field_music(uint8_t song);
#endif
