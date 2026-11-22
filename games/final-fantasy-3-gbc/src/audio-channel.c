#include "audio-channel.h"
#define R(a) s->ram[(a)-0x7f40]
#define C(a) R((a)+ch)

static uint16_t word(const FF3ChannelOps *ops,uint16_t address) {
    uint8_t lo=ops->read(address);
    return lo|((uint16_t)ops->read((uint16_t)(address+1))<<8);
}
static uint8_t next(const FF3ChannelOps *ops,uint16_t base,uint8_t *y) {
    uint8_t value=ops->read((uint16_t)(base+*y));(*y)++;return value;
}
static void emit(FF3AudioState *s,const FF3ChannelOps *ops,uint8_t reg,uint8_t value) {
    s->apu[reg]=value;ops->write(reg,value);
}
/* 36/84FF..857C. This preserves ownership/key-off behavior, not a generic mute. */
static void end(FF3AudioState *s,const FF3ChannelOps *ops,uint8_t ch,uint8_t format,uint8_t effect) {
    uint8_t i;
    C(0x7f4a)&=0x7f;
    if(format==3){
        if(effect)R(0x7f4b)|=2;
        if(effect||!(R(0x7f4f)&128))emit(s,ops,4,0x30);
    }else if(format==1){
        if(effect)R(0x7f4d)|=2;
        if(effect||!(R(0x7f50)&128))emit(s,ops,12,0x30);
    }else if(format==2)emit(s,ops,8,0x80);
    else if(format)emit(s,ops,0,0x30);
    if(effect){if(!((R(0x7f4f)|R(0x7f50))&128))R(0x7f49)=0;}
    else {for(i=0;i<5;i++)if(R(0x7f4a+i)&128)return;R(0x7f42)=0;}
}
/* 36/831D..8352. Y is an 8-bit index; a full wrap of only ties never ends. */
static uint8_t decay(FF3AudioState *s,const FF3ChannelOps *ops,uint8_t ch,uint8_t note,uint16_t pointer) {
    uint16_t duration=ops->read(0x8815+(note&15)),guard;
    uint8_t y=0,value;
    for(guard=0;guard<256;guard++){
        value=next(ops,pointer,&y);
        if(value<0xd0||value>=0xe0){C(0x7f97)=(uint8_t)duration;C(0x7f9e)=(uint8_t)(duration>>8);return 1;}
        duration=(uint16_t)(duration+ops->read(0x8815+(value&15)));
    }
    return 0;
}
/* 36/820B..8506: decode commands using the source's base pointer + 8-bit Y. */
static uint8_t command(FF3AudioState *s,const FF3ChannelOps *ops,uint8_t ch,uint8_t format,uint8_t effect) {
    uint16_t base=C(0x7f51)|((uint16_t)C(0x7f58)<<8),guard,pointer;
    uint8_t y=0,op,value,lo,index,octave;
    for(guard=0;guard<1024;guard++){
        op=next(ops,base,&y);
        if(op<0xe0){
            pointer=(uint16_t)(base+y);C(0x7f51)=(uint8_t)pointer;C(0x7f58)=(uint8_t)(pointer>>8);
            C(0x7f5f)=ops->read(0x8805+(op&15));
            if(op>=0xd0)return 1;
            if(op>=0xc0){C(0x7f4a)|=2;return 1;}
            C(0x7f4a)=(C(0x7f4a)|1)&0xfd;
            C(0x7fba)=C(0x7fc8)=C(0x7fdd)=C(0x7ff9)=C(0x7ff2)=0;
            if(!format){if(R(0x7f44)>=5)emit(s,ops,17,255);return 1;}
            if(format!=2&&!decay(s,ops,ch,op,pointer))return 0;
            octave=C(0x7f66);
            index=(uint8_t)((uint8_t)(octave<<3)+(uint8_t)(octave<<2)+((octave>>5)&1));
            index=(uint8_t)(index+(op>>4));
            if(format==1)C(0x7f6d)=ops->read(0x87bd+index);
            else {index=(uint8_t)(index<<1);C(0x7f6d)=ops->read(0x872d+index);C(0x7f74)=ops->read(0x872e+index);}
            return 1;
        }
        if(op==0xe0){R(0x7f45)=next(ops,base,&y);continue;}
        if(op<=0xee){C(0x7f90)=op-0xdf;continue;}
        if(op<=0xf4){C(0x7f66)=op-0xef;continue;}
        if(op<=0xf7){C(0x7f89)=(uint8_t)(0x30+((op-0xf5)<<6));C(0x7fc1)=next(ops,base,&y);C(0x7feb)=next(ops,base,&y);continue;}
        if(op==0xf8){C(0x7f82)=next(ops,base,&y);continue;}
        if(op==0xf9||op==0xfa){C(0x7f66)=op==0xf9?4:5;C(0x7fc1)=op==0xf9?0:1;C(0x7f90)=op==0xf9?8:15;continue;}
        if(op==0xfb){value=next(ops,base,&y);C(0x7fa5)++;if(C(0x7fa5))C(0x7fb3)=value;else C(0x7fac)=value;continue;}
        if(op==0xfc){
            if(C(0x7fa5)){C(0x7fb3)--;value=C(0x7fb3);}else{C(0x7fac)--;value=C(0x7fac);}
            if(!value){y+=2;C(0x7fa5)--;continue;}
        }else if(op==0xfd){
            value=C(0x7fa5)?C(0x7fb3):C(0x7fac);
            if(!(value&1)){y+=2;continue;}C(0x7fa5)--;
        }else if(op==0xff){end(s,ops,ch,format,effect);return 1;}
        /* FC continuing, FD odd, FE: high operand is read before base changes. */
        lo=next(ops,base,&y);value=ops->read((uint16_t)(base+y));base=lo|((uint16_t)value<<8);y=0;
    }
    return 0;
}
uint8_t ff3_channel_script(FF3AudioState *s,const FF3ChannelOps *ops,uint8_t ch,uint8_t format,uint8_t effect) {
    if(ch>6||format>4)return 0;
    if(!(C(0x7f4a)&128))return 1;
    if(!C(0x7f5f)&&!command(s,ops,ch,format,effect))return 0;
    /* The original decrements even after FF disables the channel. */
    C(0x7f5f)--;
    if(C(0x7f97)||C(0x7f9e)){if(!C(0x7f97))C(0x7f9e)--;C(0x7f97)--;}
    return 1;
}

static void output_volume(FF3AudioState *s,const FF3ChannelOps *ops,uint8_t ch,uint8_t effect,uint8_t value) {
    uint8_t index=(uint8_t)(C(0x7f90)<<4)|value;
    if(!effect)index=(uint8_t)(R(0x7f44)<<4)|ops->read(0x8825+index);
    C(0x7f7b)=ops->read(0x8825+index);
}
/* 36/8595..86D4. Modulation affects temporary output, not base envelope value. */
static void volume(FF3AudioState *s,const FF3ChannelOps *ops,uint8_t ch,uint8_t effect) {
    uint8_t phase=C(0x7fba),y,value,delta;uint16_t table,pointer,sum;
    if(phase>=3){C(0x7f7b)=0;return;}
    if(phase==1&&!C(0x7f97)&&!C(0x7f9e)){C(0x7fba)++;C(0x7fc8)=0;}
    if(C(0x7fc1)&128){C(0x7f7b)=R(0x7f44)>=5?255:0;return;}
    table=word(ops,0x9a7c+(uint8_t)(C(0x7fc1)<<1));
    pointer=word(ops,(uint16_t)(table+(uint8_t)(C(0x7fba)<<1)));
    if(!C(0x7fba)){
        y=C(0x7fc8);C(0x7fe4)=ops->read((uint16_t)(pointer+y));C(0x7fc8)++;y++;
        if(ops->read((uint16_t)(pointer+y))&128){C(0x7fba)++;C(0x7fc8)=0;}
        output_volume(s,ops,ch,effect,C(0x7fe4));return;
    }
    if(C(0x7fe4)){
        y=C(0x7fc8);
        if(!y){C(0x7fd6)=ops->read(pointer);C(0x7fc8)++;C(0x7fcf)=0;}
        value=(uint8_t)(C(0x7fd6)+C(0x7fdd));C(0x7fdd)=value;
        if(value>=100){C(0x7fdd)=value-100;C(0x7fe4)--;}
    }
    if(!C(0x7fe4)){C(0x7fba)=3;C(0x7f7b)=0;return;}
    value=C(0x7fe4);y=C(0x7fc8);
    if(!C(0x7fcf)){
        delta=ops->read((uint16_t)(pointer+y));
        if(!delta){output_volume(s,ops,ch,effect,value);return;}
        if(delta&128){y=(uint8_t)(y+delta);delta=ops->read((uint16_t)(pointer+y));}
        C(0x7fcf)=delta;y+=2;C(0x7fc8)=y;
    }
    y--;delta=ops->read((uint16_t)(pointer+y));sum=(uint16_t)value+delta;
    value=(uint8_t)sum;
    if(delta&128){if(sum<256)value=0;}else if(value>=16)value=15;
    C(0x7fcf)--;output_volume(s,ops,ch,effect,value);
}
/* 36/86D5..872C. Clamp only the low period byte; never carry into the high byte. */
static void pitch(FF3AudioState *s,const FF3ChannelOps *ops,uint8_t ch) {
    uint16_t pointer,sum;uint8_t y,value,delta;
    if(C(0x7feb)&128)return;
    pointer=word(ops,0x9eab+(uint8_t)(C(0x7feb)<<1));
    if(!C(0x7ff9)){
        y=C(0x7ff2);value=ops->read((uint16_t)(pointer+y));
        if(!value)return;
        if(value&128){y=(uint8_t)(y+value);value=ops->read((uint16_t)(pointer+y));}
        C(0x7ff9)=value;y+=2;C(0x7ff2)=y;y--;
        delta=ops->read((uint16_t)(pointer+y));sum=(uint16_t)C(0x7f6d)+delta;
        if(delta&128)C(0x7f6d)=sum<256?0:(uint8_t)sum;
        else C(0x7f6d)=sum>255?255:(uint8_t)sum;
    }
    C(0x7ff9)--;
}
uint8_t ff3_channel_envelope(FF3AudioState *s,const FF3ChannelOps *ops,uint8_t ch,uint8_t effect) {
    if(ch>6)return 0;
    if(!(C(0x7f4a)&128))return 1;
    if(C(0x7f4a)&2){C(0x7f7b)=0;return 1;}
    volume(s,ops,ch,effect);pitch(s,ops,ch);return 1;
}
