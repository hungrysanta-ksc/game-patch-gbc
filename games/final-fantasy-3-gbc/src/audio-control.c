#ifdef FF3_BANKED_RUNTIME
#pragma bank 8
#endif
#include "audio-control.h"
#if defined(FF3_EFFECTS) && defined(FF3_SINGLE_ENGINE)
/* Original bank 36 has one RAM/APU owner. These local helpers do not need
 * two unused context pointers reloaded and pushed for every register write. */
#define CONTROL_CONTEXT
#define CONTROL_ARGS
#else
#define CONTROL_CONTEXT FF3AudioState *s,const FF3AudioOps *ops,
#define CONTROL_ARGS s,ops,
#endif
#if defined(FF3_EFFECTS) && defined(FF3_SINGLE_ENGINE)
/* Source channel loops stay inside $7F40..$7FFF (192 bytes). */
#define R(a) FF3_RAM(s)[(uint8_t)((a)-0x7f40)]
#else
#define R(address) FF3_RAM(s)[(address)-0x7f40]
#endif

static void emit(CONTROL_CONTEXT uint8_t reg,uint8_t value) {
    FF3_APU(s)[reg] = value;
    FF3_WRITE(ops,reg, value);
}
uint8_t ff3_audio_song(FF3AudioState *s, uint8_t id) {
    if (id > 0x40) return 0;
    R(0x7f43) = id; R(0x7f42) = 1; return 1;
}
uint8_t ff3_audio_effect(FF3AudioState *s, uint8_t id) FF3_BANKED {
    if (id > 0x60) return 0;
    R(0x7f49) = id | 0x80; return 1;
}
void ff3_audio_stop_effect(FF3AudioState *s) FF3_BANKED { R(0x7f49) = 0xff; }

/* 36/81C3..81E5: deliberately preserve RAM the original does not clear. */
void ff3_audio_init(FF3AudioState *s, const FF3AudioOps *ops) {
    uint8_t i;
    emit(CONTROL_ARGS 0x15, 0);
    for (i = 3; i <= 15; i += 4) emit(CONTROL_ARGS i, 0);
    R(0x7f42) = R(0x7f40) = R(0x7f49) = 0;
    for (i = 0; i < 7; i++) R(0x7f4a + i) = 0;
}

/* 36/8C29..8C57: release old claims, mute, mark BGM key-off.
 * Calling this does not itself clear the request/status byte. */
void ff3_audio_release_effect(FF3AudioState *s, const FF3AudioOps *ops) {
    if (R(0x7f4f) & 0x80) {
        R(0x7f4f) &= 0x7f; emit(CONTROL_ARGS 4, 0x30); R(0x7f4b) |= 2;
    }
    if (R(0x7f50) & 0x80) {
        R(0x7f50) &= 0x7f; emit(CONTROL_ARGS 12, 0x30); R(0x7f4d) |= 2;
    }
}

/* 36/8BB8..8C28: latest request replaces both old effect paths.
 * The validated public request API admits exactly the 97 source slots. */
void ff3_audio_start_effect(FF3AudioState *s, const FF3AudioOps *ops) {
    int8_t i; uint16_t table, pointer; uint8_t lo, hi;
    ff3_audio_release_effect(s, ops);
    for (i = 1; i >= 0; i--) {
        R(0x7f4f+i) = R(0x7f64+i) = R(0x7f80+i) = 0;
        R(0x7f87+i) = 8; R(0x7f8e+i) = 0x30; R(0x7f95+i) = 15;
        R(0x7fc6+i) = R(0x7ff0+i) = R(0x7faa+i) = R(0x7fbf+i) = 255;
    }
    table = 0x92c5 + (uint8_t)(R(0x7f49) << 1);
    lo = FF3_READ36(ops,table); hi = FF3_READ36(ops,table + 1);
    pointer = lo | ((uint16_t)hi << 8);
    for (i = 1; i >= 0; i--) {
        R(0x7f5d+i) = FF3_READ36(ops,pointer + i*2 + 1);
        R(0x7f56+i) = FF3_READ36(ops,pointer + i*2);
        if (R(0x7f56+i) != 255 || R(0x7f5d+i) != 255) R(0x7f4f+i) |= 0x80;
    }
    R(0x7f49) = 0x40;
}

/* 36/8B9D..8BB7, 8C58..8C76. Script/envelope bodies are separate ports. */
void ff3_audio_update_effect(FF3AudioState *s, const FF3AudioOps *ops) {
    uint8_t request = R(0x7f49);
    if (!request) return;
    if (request == 255) { R(0x7f49) = 0; ff3_audio_release_effect(s, ops); }
    else if (request & 0x80) ff3_audio_start_effect(s, ops);
    else {
        FF3_ADVANCE(ops,FF3_SCRIPT, 5, 3, 255);
        FF3_ADVANCE(ops,FF3_ENVELOPE, 5, 3, 255);
        FF3_ADVANCE(ops,FF3_SCRIPT, 6, 1, 255);
        FF3_ADVANCE(ops,FF3_ENVELOPE, 6, 1, 255);
    }
}

static void pulse(CONTROL_CONTEXT uint8_t ch,uint8_t reg) {
    uint8_t flags = R(0x7f4a+ch), sweep = R(0x7f82+ch);
    if (!(flags & 0x80)) return;
    if (flags & 1) R(0x7f4a+ch) &= 0xfe;
    emit(CONTROL_ARGS reg, R(0x7f89+ch) | R(0x7f7b+ch));
    if (flags & 1) {
        emit(CONTROL_ARGS reg+1, sweep);
        emit(CONTROL_ARGS reg+2, R(0x7f6d+ch));
        emit(CONTROL_ARGS reg+3, R(0x7f74+ch));
    } else if (!(sweep & 0x80)) emit(CONTROL_ARGS reg+2, R(0x7f6d+ch));
}
static void noise(CONTROL_CONTEXT uint8_t ch) {
    uint8_t flags = R(0x7f4a+ch), period = R(0x7f6d+ch);
    if (!(flags & 0x80)) return;
    if (flags & 1) R(0x7f4a+ch) &= 0xfe;
    emit(CONTROL_ARGS 12, R(0x7f7b+ch) | 0x30);
    emit(CONTROL_ARGS 14, period);
    if (flags & 1) emit(CONTROL_ARGS 15, period);
}

/* 36/8030..80AA. */
void ff3_audio_flush_effect(FF3AudioState *s, const FF3AudioOps *ops) {
    if (!R(0x7f49)) return;
    pulse(CONTROL_ARGS 5, 4); noise(CONTROL_ARGS 6);
}
/* 36/80AB..81C2. Retain the original ordering and trigger-bit consumption. */
void ff3_audio_flush_music(FF3AudioState *s, const FF3AudioOps *ops) {
    uint8_t flags;
    if (!(R(0x7f42) & 0x80)) return;
    pulse(CONTROL_ARGS 0, 0);
    if (!(R(0x7f4f) & 0x80)) pulse(CONTROL_ARGS 1, 4);
    flags = R(0x7f4c);
    if (flags & 0x80) {
        if (flags & 1) R(0x7f4c) &= 0xfe;
        emit(CONTROL_ARGS 8, R(0x7f7d) | 0x80);
        emit(CONTROL_ARGS 10, R(0x7f6f));
        if (flags & 1) emit(CONTROL_ARGS 11, R(0x7f76));
    }
    if (!(R(0x7f50) & 0x80)) noise(CONTROL_ARGS 3);
    if ((R(0x7f4e) & 0x81) == 0x81) { R(0x7f4e) &= 0xfe; emit(CONTROL_ARGS 17, 0); }
}
/* 36/8AC0..8AEF: reverse channel order; preserve currently owned SFX. */
void ff3_audio_silence_music(FF3AudioState *s, const FF3AudioOps *ops) {
    int8_t ch;
    for (ch = 3; ch >= 0; ch--) {
        if (!(R(0x7f4a+ch) & 0x80)) continue;
        if (ch == 1 && (R(0x7f4f) & 0x80)) continue;
        if (ch == 3 && (R(0x7f50) & 0x80)) continue;
        emit(CONTROL_ARGS ch*4, ch == 2 ? 0x80 : 0x30);
    }
}
/* 36/8003..802F. Song $37 suppresses requests without releasing stale flags. */
void ff3_audio_tick(FF3AudioState *s, const FF3AudioOps *ops) {
    if (R(0x7f43) == 0x37) R(0x7f49) = 0;
    else ff3_audio_update_effect(s, ops);
    FF3_ADVANCE(ops,FF3_MUSIC, 0, 0, 0);
    emit(CONTROL_ARGS 21, FF3_APU(s)[21] | 15);
    ff3_audio_flush_effect(s, ops); ff3_audio_flush_music(s, ops);
    R(0x7f40) = (R(0x7f40) & 0x7f) | (R(0x7f42) & 0x80);
}
