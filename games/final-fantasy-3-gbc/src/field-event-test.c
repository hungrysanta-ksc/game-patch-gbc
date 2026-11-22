/* Original 6502 event calls, every frame and every map byte, no state replay. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "field-event.h"
static uint8_t script[9],requests[16],used;
uint8_t ff3_field_script(uint8_t offset){if(offset>=9)exit(3);return script[offset];}
void ff3_field_request(uint8_t reg,uint8_t value){if(used>=16)exit(4);requests[used++]=reg;requests[used++]=value;}
int main(int argc,char **argv){FF3FieldEvent s;FILE *f;int n=0,b,i;if(argc!=2)return 2;f=fopen(argv[1],"rb");if(!f)return 2;memset(&s,0,sizeof(s));if(fread(s.map,1,1024,f)!=1024||fread(script,1,9,f)!=9)return 2;
 while((b=fgetc(f))!=EOF){used=0;ff3_field_tick(&s);if(s.error||b*2!=used)return 5;for(i=0;i<used;i++)if(fgetc(f)!=requests[i])return 6;if(fgetc(f)!=s.shake||fgetc(f)!=s.revision||fgetc(f)!=s.done)return 7;for(i=0;i<1024;i++)if(fgetc(f)!=s.map[i])return 8;n++;}fclose(f);if(!s.done||n!=42)return 9;printf("PASS %d source event frames, map bytes and sound requests\n",n);return 0;}
