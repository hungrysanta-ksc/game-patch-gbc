# VBlank dialogue with native original audio

This integration replaces the dialogue window's LCD-off uploads with bounded VBlank transfers and services the existing audio producer during text interpretation, glyph preparation and transfer waits. The original music/SFX engine, timer consumer and adopted timbre approximation are retained.

## Reproduce

Use the same private `local.json.dialogue` font, reviewed bindings and translation inputs as [NPC dialogue](npc-dialogue.md).

```powershell
npm run build:dialogue-audio
node tools/build-text-audio-verifier.mjs
npm run verify:dialogue-audio
node tools/verify-text-audio.mjs --idle
```

Output is local `build/dialogue-audio/ff3-dialogue-audio.gbc`; observations and screenshots remain under ignored `evidence/text-audio/` and `.local/`. A/B and START/SELECT retain the NPC diagnostic controls. The original-data audio request schedule runs for 7,200 source ticks (two repetitions of the existing 3,600-tick request plan) and then ends deliberately; this finite diagnostic is not an NPC-specific sound script. No audio recording is required or produced.

The configured map has conditional music. The builder executes original `3F/E8CE..E8FD` with the original initial state to resolve its selector; the reviewed scene resolves selector 81 to song 0C. The existing diagnostic request plan exercises source music, simultaneous SFX, stop/resume and fades, replacing its default field song with this result. It does not invent new note sequences or change instruments.

## Transfer and scheduling contract

- LCD stays enabled after initial map/NPC loading. The window alone is hidden while its single 128-glyph cache is replaced; the completed page becomes visible in VBlank. This avoids mixed old/new glyphs, but is not yet an animated scroll or a second page cache.
- A 256-byte WRAM staging buffer batches glyph preparation and window rows. CGB general-purpose DMA transfers are at most 128 bytes (eight 16-byte blocks, approximately 61 microseconds of DMA stall). LY/STAT are checked again inside a short critical section, with starts restricted to lines 144..150. The last scanlines are reserved for setup/return margin and LY's early reset. No IRQ is masked while waiting for VBlank.
- The producer runs cooperatively from fixed ROM. Text calls it between decoded words, cache lookups, glyphs and transfer chunks, including while waiting. Each yield replenishes the existing lookahead queue before returning to rendering. The timer ISR only consumes queued APU register writes and never maps ROM/WRAM or calls banked code. Main-thread source/glyph reads restore their incoming ROM bank.
- Window patterns remain bank-1 9000..97FF, window map 9C00 and palette 7. Original background and NPC ownership is unchanged. IRQs can return during rendering mode 3, so the old assumption that a GBDK upload helper remains safe after an interrupt is not used.
- Integrated text cells reserve bank-1 WRAM D800..D93F, with a guard at D940..D94F. Staging occupies D950..DA4F, followed by a stack guard at DA50..DA5F; the stack has DA60..DFFF (1,440 bytes). The original map workspace and guard below D800 remain protected. SVBK stays 1. The original 1,024-byte state is shared with the platform, not duplicated.
- The integrated verifier reads the audio engine's existing pair of immutable completed-event snapshots. This observes consistent 216-byte states while text and audio computation continue; it does not wait for the producer to become idle at a particular frame phase. The audio interpreter and output queue remain the same.

Pan Docs specifies a 4,560-dot VBlank and warns that an interrupt can invalidate a previously checked VRAM access window. Double speed changes CPU/timer speed but not PPU or APU timing. References: [rendering](https://github.com/gbdev/pandocs/blob/master/src/Rendering.md), [VRAM/OAM access](https://github.com/gbdev/pandocs/blob/master/src/Accessing_VRAM_and_OAM.md), [CGB registers](https://github.com/gbdev/pandocs/blob/master/src/CGB_Registers.md). These are hardware constraints; the measured results here are from the pinned Mesen core, not a physical-GBC or cross-emulator certification.

## Verification design

The same ROM and audio plan run with and without text load. An independent host oracle executes unchanged NES 6502 instructions, compares each observed completed audio state and consumed output hash, and checks actual GBC envelope/noise registers. Queue underruns and timer-deadline lateness must remain zero; elapsed timer time is compared with emulator master time to detect lost timer interrupts.

A read-only Mesen Lua observer is installed after initial loading and before a repeatable audio restart. It observes every VRAM/palette write, including DMA writes (`GbDmaController::ProcessDmaBlock` and `ScriptManager::ProcessMemoryOperation` dispatch them to the same callback), rejects non-VBlank writes, counts LCD-off writes, and hashes actual timer-consumer APU bus writes. The final hash includes the explicit four channel-silence writes at diagnostic termination. This audit is independent of the ROM's transfer-success counters. Captures wait three complete frames after a page finishes. The verifier explicitly disables Mesen's display-frame blending while retaining CGB color correction: its pause/resume-dependent blend buffer can otherwise produce half-bright screenshots, unrelated to emulated palette data.

The load cycle includes both original NPC branches, names/item/amount substitutions, all 2,350 approved Hangul glyphs, and an explicitly synthetic 116-distinct-glyph full window. The latter is a renderer bound test, not invented gameplay. Page cells, source game state, OAM, protected VRAM and actual RGB screenshots are compared independently. A-button edges acknowledge pages. Static text and ordinary NPC suites remain regression gates.

## Measured result (2026-11-23)

The pinned Mesen core completed 7,200 source ticks / 21,366 audio events in both runs. The 82-request first cycle finished before the audio schedule ended; the loaded run continued to 104 completed requests. The full-window bound is **116**, independently calculated from the expected cells: 108 distinct interior characters plus eight border tiles. A full interior contains no additional blank tile.

| Measurement | Dialogue/font load | Idle comparison |
|---|---:|---:|
| Observed frames | 7,170 | 7,156 |
| Queue underruns / late deadlines | 0 / 0 | 0 / 0 |
| Actual timer-consumer APU writes | 30,938 | 30,938 |
| Actual APU rolling hash | 16,366 | 16,366 |
| VRAM/palette writes | 110,944 | 0 |
| Writes outside VBlank / LCD-off writes | 0 / 0 | 0 / 0 |
| Maximum observed video-write line | 151 | — |
| Timer versus master-time drift | −0.102 ms | +0.00048 ms |

The deadline counter is measured at 4,096 Hz; zero late deadlines does not mean cycle-identical interrupt phase. Bounded DMA can introduce sub-tick IRQ latency. The independent write audit and original-code state/output comparisons pass; no new listening-quality or physical-hardware claim is made.

All 82 captured 160×144 frames (1,889,280 pixels), 2,350 Hangul glyphs, original game state, OAM and protected map/NPC VRAM passed comparison. Regressions: 79 static-text requests / 67 screenshots; 2,801 NPC/substitution requests / 81 screenshots / 312 joypad requests; 30 host tests. The standalone audio artifact remains byte-identical and its existing observations pass the current original-code oracle. All three text/dialogue/audio ROMs were rebuilt byte-for-byte from the 167-file source allowlist and explicit private inputs, without a disassembly or existing generated payloads.

**Latency remains a limitation:** upload/preparation while the window is hidden reached 155 frames (about 2.6 seconds) in this stress run, excluding earlier text decoding. DMA itself is bounded and fast; the cooperative original-audio producer, glyph preparation and VBlank waits share the main thread. This is an audio-continuity and memory-access gate, not a shipping dialogue-response-time pass. Keep this load suite when improving incremental glyph reuse and preparation scheduling before normal exploration integration.

Integrated ROM SHA-256: `e78773b3a96aea21b94c15614f74ff241afa06fc569d888e1a2f3e6286f50cf4`. It is a local 1 MiB CGB/MBC5 diagnostic. Fixed ROM ends at 249A, static WRAM at CFAC (84 bytes below D000), and text bank 14 uses 4,061 bytes; upper-WRAM reservations and guards are described above. The public repository contains source and validation summaries only.

Normal proximity/movement, original dialogue timing, choices, concurrent map transitions and final timbre quality are outside this integration. Initial map/NPC loading still uses LCD-off before audio starts. The next renderer work can improve page replacement latency/appearance without weakening the audio and bus-write checks.
