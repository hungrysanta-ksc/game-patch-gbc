#include <gb/gb.h>
#include <gb/cgb.h>
#include <gbdk/console.h>
#include <stdio.h>
#include <stdint.h>
#include "timed-assets.h"

volatile uint8_t timed_ready=0,timed_request=0,timed_track=0,timed_playing=0,timed_done=0,timed_busy=0,timed_pop_enabled=1;
volatile uint16_t timed_clock=0,timed_loops=0,timed_hash=0,timed_max_late=0,timed_deadline=0;
volatile uint16_t timed_pops=0,timed_underruns=0;
volatile uint8_t timed_pop_min_ticks=255,timed_pop_width_error=0,timed_pop_late=0,timed_irq_busy=0;
volatile uint8_t timed_error=0;
volatile uint8_t timed_consumed[12]; /* records:u32, writes:u32, hash:u16, loops:u16 */
volatile uint32_t timed_records=0,timed_writes=0;
uint8_t timed_regs[24];
uint8_t event_queue[32][64];
/* Single producer/interrupt consumer; publish tail only after completing a slot.
 * Slot: deadline:u16, write count:u8, end:u8, source metadata:12 bytes,
 * DAC level:u8, reserved:u8, up to 23 (GB register offset, value) pairs. */
volatile uint8_t queue_head=0,queue_tail=0;
static uint8_t *slot;
static uint8_t emitted,preparing,irq_write_count,irq_flags,irq_pop,irq_due,pop_was_on,pop_started_clock,pop_started_due;
static uint8_t bank,count,dirty,trigger,reload[2],divider[2],hw_volume[4],hw_hi[3],hw_duty[2],hw_noise;
static uint16_t timer[2],fraction,next_sweep,prepare_due;
static uint8_t sweep_fraction;
static void prepare_one(void);
static const uint8_t *position;
static const palette_color_t palette[]={RGB(28,30,29),RGB(18,22,21),RGB(9,13,14),RGB(2,4,6)};
static void dispatch_due(void) __naked {
 __asm
 ld a,#1
 ld (_timed_irq_busy),a
90100$:
 ld a,(_queue_head)
 ld b,a
 ld a,(_queue_tail)
 cp b
 jp nz,90101$
 ld a,(_timed_playing)
 or a
 jp z,90199$
 ld hl,#_timed_underruns
 inc (hl)
 jp nz,90199$
 inc hl
 inc (hl)
 jp 90199$
90101$:
 ld l,b
 ld h,#0
 add hl,hl
 add hl,hl
 add hl,hl
 add hl,hl
 add hl,hl
 add hl,hl
 ld de,#_event_queue
 add hl,de
 ld a,(hl+)
 ld c,a
 ld (_irq_due),a
 ld a,(hl+)
 ld b,a
 ld a,(_timed_clock)
 sub c
 ld e,a
 ld a,(_timed_clock+1)
 sbc b
 bit 7,a
 jp nz,90199$
 ld d,a
 ld a,(_timed_max_late+1)
 cp d
 jp c,90102$
 jp nz,90103$
 ld a,(_timed_max_late)
 cp e
 jp nc,90103$
90102$:
 ld a,e
 ld (_timed_max_late),a
 ld a,d
 ld (_timed_max_late+1),a
90103$:
 ld a,(hl+)
 ld (_irq_write_count),a
 ld a,(hl+)
 ld (_irq_flags),a
 ld de,#_timed_consumed
 ld b,#12
90104$:
 ld a,(hl+)
 ld (de),a
 inc de
 dec b
 jp nz,90104$
 ld a,(hl+)
 and #127
 ld (_irq_pop),a
 inc hl
 ld a,(_irq_write_count)
 ld b,a
 or a
 jp z,90106$
90105$:
 ld a,(hl+)
 add #0x10
 ld c,a
 ld a,(hl+)
 ldh (c),a
 dec b
 jp nz,90105$
90106$:
 ld a,(_irq_pop)
 ld b,a
 ld a,(_pop_was_on)
 cp b
 jp z,90120$
 ld a,b
 ld (_pop_was_on),a
 or a
 jp z,90110$
 ld a,(_timed_clock)
 ld (_pop_started_clock),a
 ld a,(_irq_due)
 ld (_pop_started_due),a
 jp 90118$
90110$:
 ld a,(_pop_started_clock)
 ld b,a
 ld a,(_timed_clock)
 sub b
 ld c,a
 ld a,(_timed_pop_min_ticks)
 cp c
 jp c,90111$
 ld a,c
 ld (_timed_pop_min_ticks),a
90111$:
 ld a,(_pop_started_due)
 ld b,a
 ld a,(_irq_due)
 sub b
 sub c
 jp nc,90112$
 cpl
 inc a
90112$:
 ld b,a
 ld a,(_timed_pop_width_error)
 cp b
 jp nc,90113$
 ld a,b
 ld (_timed_pop_width_error),a
90113$:
 ld hl,#_timed_pops
 inc (hl)
 jp nz,90118$
 inc hl
 inc (hl)
90118$:
 ld a,(_irq_due)
 ld b,a
 ld a,(_timed_clock)
 sub b
 ld b,a
 ld a,(_timed_pop_late)
 cp b
 jp nc,90120$
 ld a,b
 ld (_timed_pop_late),a
90120$:
 ld a,(_queue_head)
 inc a
 and #31
 ld (_queue_head),a
 ld a,(_irq_flags)
 or a
 jp z,90100$
 xor a
 ldh (_TAC_REG),a
 ldh (_NR12_REG),a
 ldh (_NR22_REG),a
 ldh (_NR32_REG),a
 ldh (_NR42_REG),a
 ld (_timed_playing),a
 inc a
 ld (_timed_done),a
90199$:
 xor a
 ld (_timed_irq_busy),a
 ret
 __endasm;
}
static void clock_irq(void) __naked {__asm
 ld hl,#_timed_clock
 inc (hl)
 jp nz,90200$
 inc hl
 inc (hl)
90200$:
 jp _dispatch_due
 __endasm;}
static uint8_t get_byte(void){uint8_t b=*position++;if(position==(const uint8_t*)0x8000){bank++;SWITCH_ROM(bank);position=(const uint8_t*)0x4000;}return b;}
static void read_header(void){uint16_t d=get_byte();d|=(uint16_t)get_byte()<<8;timed_deadline+=d;count=get_byte();}
static void silence(void){NR12_REG=NR22_REG=NR32_REG=NR42_REG=0;}
static void emit(uint8_t reg,uint8_t value){if(emitted<23){slot[18+emitted*2]=reg;slot[19+emitted*2]=value;emitted++;}else timed_error=1;}

#define DEFINE_PULSE(CH,BASE,DUTY,LOW,VOLUME,HIGH) \
static void pulse##CH(void){uint8_t s=timed_regs[BASE+1],volume=timed_regs[BASE]&15,duty=timed_regs[BASE]&192,hi;uint16_t t=timer[CH],freq; \
 if(t<8||(!(s&8)&&t+(t>>(s&7))>2047))volume=0;freq=pitch_table[t&2047];hi=freq>>8; \
 if(hw_duty[CH]!=duty)emit(DUTY,duty);emit(LOW,(uint8_t)freq);if(hw_volume[CH]!=volume||(trigger&(1<<CH))){emit(VOLUME,volume<<4);emit(HIGH,hi|(volume?128:0));}else if(hw_hi[CH]!=hi)emit(HIGH,hi); \
 hw_volume[CH]=volume;hw_duty[CH]=duty;hw_hi[CH]=hi;}
DEFINE_PULSE(0,0,1,3,2,4)
DEFINE_PULSE(1,4,6,8,7,9)
static void apply(void){uint16_t freq;uint8_t v,n,h;
 if(dirty&1)pulse0();if(dirty&2)pulse1();
 if(dirty&4){freq=pitch_table[timed_regs[10]|((uint16_t)(timed_regs[11]&7)<<8)];v=(timed_regs[8]&127)?32:0;h=freq>>8;emit(13,(uint8_t)freq);emit(12,v);if(hw_volume[2]==255)emit(14,h|128);else if(hw_hi[2]!=h)emit(14,h);hw_volume[2]=v;hw_hi[2]=h;}
 if(dirty&8){v=timed_regs[12]&15;n=noise_table[timed_regs[14]&15]|((timed_regs[14]&128)?8:0);
  if(timed_pop_enabled&&(timed_regs[17]&127)){v=7;n=0;}
  if(hw_noise!=n)emit(18,n);if(hw_volume[3]!=v||(trigger&8)){emit(17,v<<4);emit(19,128);}hw_noise=n;hw_volume[3]=v;
 }dirty=trigger=0;
}
static const uint8_t dirty_table[24]={1,1,1,1,2,2,2,2,4,0,4,4,8,0,8,8,0,8,0,0,0,0,0,0};
static void write_source(uint8_t r,uint8_t v){
 timed_regs[r]=v;
 dirty|=dirty_table[r];
 switch(r){case 1:reload[0]=1;break;case 5:reload[1]=1;break;
 case 2:timer[0]=(timer[0]&0x700)|v;break;case 3:timer[0]=(timer[0]&255)|((uint16_t)(v&7)<<8);trigger|=1;break;
 case 6:timer[1]=(timer[1]&0x700)|v;break;case 7:timer[1]=(timer[1]&255)|((uint16_t)(v&7)<<8);trigger|=2;break;
 case 15:case 17:trigger|=8;break;case 23:next_sweep=prepare_due+34;sweep_fraction=16;break;}
 timed_hash=(timed_hash<<1)|(timed_hash>>15);timed_hash^=((uint16_t)r<<8)|v;
}
static void sweep(void){uint8_t ch,s,shift;uint16_t t,delta,target;
 for(ch=0;ch<2;ch++){s=timed_regs[ch*4+1];shift=s&7;t=timer[ch];delta=t>>shift;target=(s&8)?t-delta-(ch?0:1):t+delta;
  if(!divider[ch]&&(s&128)&&shift&&t>=8&&target<=2047){timer[ch]=target;dirty|=1<<ch;}
  if(!divider[ch]||reload[ch]){divider[ch]=(s>>4)&7;reload[ch]=0;}else divider[ch]--;
 }
}
static uint8_t full(void){return ((queue_tail+1)&31)==queue_head;}
static void start(uint8_t id){uint8_t i;CRITICAL{TAC_REG=0;IF_REG&=~TIM_IFLAG;timed_clock=0;queue_head=queue_tail=0;}silence();timed_track=id;timed_playing=1;timed_done=0;timed_loops=timed_hash=timed_max_late=timed_deadline=0;timed_records=timed_writes=0;fraction=track_initial_fraction[id];next_sweep=34;sweep_fraction=16;timed_pops=timed_underruns=timed_pop_width_error=timed_pop_late=0;timed_pop_min_ticks=255;pop_was_on=0;preparing=1;
 for(i=0;i<12;i++)timed_consumed[i]=0;
 for(i=0;i<24;i++)timed_regs[i]=0;for(i=0;i<4;i++)hw_volume[i]=255;for(i=0;i<3;i++)hw_hi[i]=255;hw_duty[0]=hw_duty[1]=hw_noise=255;timer[0]=timer[1]=0;divider[0]=divider[1]=reload[0]=reload[1]=0;dirty=trigger=0;
 bank=track_banks[id];position=(const uint8_t*)(0x4000+track_offsets[id]);SWITCH_ROM(bank);read_header();
 /* Fill the queue and establish time-zero state before starting the clock. */
 timed_error=0;while(preparing&&!full())prepare_one();if(!timed_error)dispatch_due();
 if(timed_playing){CRITICAL{TIMA_REG=TMA_REG=128;IF_REG&=~TIM_IFLAG;TAC_REG=5;}}
}
static void consume_source(void){uint8_t i,r,v;
 if(count==255){if(track_loop_banks[timed_track]){timed_loops++;if(fraction>=44100u-track_loop_fraction[timed_track]){fraction-=44100u-track_loop_fraction[timed_track];timed_deadline++;}else fraction+=track_loop_fraction[timed_track];bank=track_loop_banks[timed_track];position=(const uint8_t*)(0x4000+track_loop_offsets[timed_track]);SWITCH_ROM(bank);}else preparing=0;}
 else if(count!=254){for(i=0;i<count;i++){r=get_byte();v=get_byte();write_source(r,v);}timed_writes+=count;}
 timed_records++;if(preparing)read_header();
}
static void put16(uint8_t at,uint16_t value){slot[at]=(uint8_t)value;slot[at+1]=value>>8;}
static void put32(uint8_t at,uint32_t value){put16(at,(uint16_t)value);put16(at+2,(uint16_t)(value>>16));}
static void prepare_one(void){
 slot=event_queue[queue_tail];emitted=0;prepare_due=((int16_t)(timed_deadline-next_sweep)<=0)?timed_deadline:next_sweep;put16(0,prepare_due);
 if(prepare_due==next_sweep){sweep();next_sweep+=34;sweep_fraction+=16;if(sweep_fraction>=120){sweep_fraction-=120;next_sweep++;}}
 while(preparing&&timed_deadline==prepare_due)consume_source();apply();
 if(timed_error){preparing=0;timed_playing=0;TAC_REG=0;silence();return;}
 slot[2]=emitted;slot[3]=preparing?0:1;put32(4,timed_records);put32(8,timed_writes);put16(12,timed_hash);put16(14,timed_loops);slot[16]=timed_regs[17];slot[17]=0;queue_tail=(queue_tail+1)&31;
}
static void screen(void){printf("\n FF3 TIMED AUDIO\n\n TRACK %u / %u\n %s\n\n A PLAY  B STOP\n LEFT/RIGHT TRACK\n SELECT DAC TEST\n\n DAC BURST: %u\n\n VGZ DATA / 4096HZ\n LOOP IF PROVIDED\n",(unsigned)(timed_track+1),(unsigned)TRACK_COUNT,track_names[timed_track],(unsigned)timed_pop_enabled);}
void main(void){uint8_t i,keys,old=0,pressed,frame=0;cpu_fast();set_bkg_palette(0,1,palette);NR52_REG=128;NR50_REG=0x77;NR51_REG=0xff;NR10_REG=0;NR30_REG=0;for(i=0;i<16;i++)((volatile uint8_t*)0xff30)[i]=triangle_wave[i];NR30_REG=128;silence();
 CRITICAL{add_TIM(clock_irq);add_TIM(nowait_int_handler);}set_interrupts(VBL_IFLAG|TIM_IFLAG);screen();timed_ready=0xa5;
 while(1){if(frame!=(uint8_t)sys_time){frame=(uint8_t)sys_time;keys=joypad();pressed=keys&~old;old=keys;if(pressed&J_B){timed_playing=0;TAC_REG=0;silence();}if((pressed&J_SELECT)&&!timed_playing){timed_pop_enabled^=1;cls();screen();}
   if(!timed_playing){if(pressed&J_RIGHT){timed_track=(timed_track+1)%TRACK_COUNT;cls();screen();}if(pressed&J_LEFT){timed_track=timed_track?timed_track-1:TRACK_COUNT-1;cls();screen();}if(pressed&J_A)timed_request=timed_track+1;}}
  if(timed_request){timed_busy=1;start((timed_request-1)%TRACK_COUNT);timed_request=0;timed_busy=0;}
  if(timed_playing&&preparing){timed_busy=1;while(preparing&&!full())prepare_one();timed_busy=0;}
  __asm halt __endasm;
 }
}
