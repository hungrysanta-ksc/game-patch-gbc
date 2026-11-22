/* Source-derived differential fixture consumer. This is an engineering test,
 * not a playable audio engine: only the outer music scheduler is replayed. */
#include <gb/gb.h>
#include <gb/cgb.h>
#include <stdio.h>
#include "audio-control.h"
#include "audio-channel.h"
#include "control-assets.h"

volatile uint8_t control_ready=0,control_status=0,control_failure=0;
volatile uint16_t control_case=0,control_index=0;
static FF3AudioState state;
static uint8_t bank=2, callbacks, used, writes[128][2];
static const palette_color_t palette[]={RGB(28,30,29),RGB(18,22,21),RGB(9,13,14),RGB(2,4,6)};
static const uint8_t *position=(const uint8_t*)0x4000;
static uint8_t byte(void) {
    uint8_t v=*position++;
    if(position==(const uint8_t*)0x8000){bank++;SWITCH_ROM(bank);position=(const uint8_t*)0x4000;}
    return v;
}
static void fail(uint8_t kind,uint16_t index){if(!control_failure){control_failure=kind;control_index=index;}}
static void compare(const uint8_t *memory,uint16_t size,uint8_t kind){
    uint16_t i;for(i=0;i<size;i++)if(byte()!=memory[i])fail(kind,i);
}
static void read_into(uint8_t *memory,uint16_t size){uint16_t i;for(i=0;i<size;i++)memory[i]=byte();}
static uint8_t source_byte(uint16_t address){
    uint8_t v;
    if(address<0x8000||address>=0xa000){fail(10,address);return 0;}
    SWITCH_ROM(1);v=*((const uint8_t*)(0x4000+(address&8191)));SWITCH_ROM(bank);return v;
}
static void log_write(uint8_t reg,uint8_t value){
    if(used==128){fail(11,used);return;}
    writes[used][0]=reg;writes[used++][1]=value;
}
static const FF3ChannelOps channel_ops={source_byte,log_write};
static void advance(uint8_t routine,uint8_t channel,uint8_t format,uint8_t effect){
    uint8_t count,reg,value,first=used,i,ok;
    if(!callbacks){fail(12,0);return;}callbacks--;
    if(byte()!=routine)fail(1,0);if(byte()!=channel)fail(1,1);
    if(byte()!=format)fail(1,2);if(byte()!=effect)fail(1,3);
    compare(state.ram,192,2);compare(state.apu,24,3);
    if(routine<2){
        ok=routine?ff3_channel_envelope(&state,&channel_ops,channel,effect):ff3_channel_script(&state,&channel_ops,channel,format,effect);
        if(!ok)fail(15,routine);
        compare(state.ram,192,16);count=byte();if(count!=used-first)fail(17,count);
        for(i=0;i<count;i++){reg=byte();value=byte();if(reg!=writes[first+i][0]||value!=writes[first+i][1])fail(18,i);}
    }else{
        read_into(state.ram,192);count=byte();
        while(count--){reg=byte();value=byte();if(reg>=24){fail(13,reg);return;}state.apu[reg]=value;log_write(reg,value);}
    }
}
static const FF3AudioOps ops={source_byte,log_write,advance};
void main(void){
    uint8_t op,i,count;cpu_fast();NR52_REG=0;
    printf("FF3 CONTROL TEST\nSOURCE ROM FIXTURES\n\nRUNNING...\n");
    set_bkg_palette(0,1,palette);SHOW_BKG;DISPLAY_ON;
    SWITCH_ROM(bank);control_ready=0xa5;
    for(control_case=0;control_case<CONTROL_CASES;control_case++){
        op=byte();read_into(state.ram,192);read_into(state.apu,24);callbacks=byte();used=0;
        switch(op){
            case 0:ff3_audio_init(&state,&ops);break;
            case 1:ff3_audio_release_effect(&state,&ops);break;
            case 2:ff3_audio_start_effect(&state,&ops);break;
            case 3:ff3_audio_flush_effect(&state,&ops);break;
            case 4:ff3_audio_flush_music(&state,&ops);break;
            case 5:ff3_audio_silence_music(&state,&ops);break;
            case 6:ff3_audio_update_effect(&state,&ops);break;
            case 7:ff3_audio_tick(&state,&ops);break;
            default:fail(14,op);
        }
        compare(state.ram,192,4);compare(state.apu,24,5);
        count=byte();if(count!=used)fail(6,count);
        for(i=0;i<count;i++){if(byte()!=writes[i][0])fail(7,i*2);if(byte()!=writes[i][1])fail(7,i*2+1);}
        if(callbacks)fail(8,callbacks);
        if(control_failure)break;
    }
    if(!control_failure){
        state.ram[3]=7;state.ram[2]=9;state.ram[9]=11;
        if(ff3_audio_song(&state,65)||ff3_audio_effect(&state,97)||state.ram[3]!=7||state.ram[2]!=9||state.ram[9]!=11)fail(9,0);
        if(!ff3_audio_song(&state,64)||state.ram[3]!=64||state.ram[2]!=1)fail(9,1);
        if(!ff3_audio_effect(&state,96)||state.ram[9]!=0xe0)fail(9,2);
        ff3_audio_stop_effect(&state);if(state.ram[9]!=255)fail(9,3);
    }
    control_status=control_failure?2:1;
    printf("\n%s\n%u / %u CASES\nERROR %u AT %u\n",control_failure?"FAIL":"PASS",control_case,CONTROL_CASES,control_failure,control_index);
    while(1)wait_vbl_done();
}
