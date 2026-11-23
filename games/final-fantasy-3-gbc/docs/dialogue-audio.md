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
- A 256-byte WRAM staging buffer batches glyph preparation and window rows. CGB general-purpose DMA transfers are at most 128 bytes (eight 16-byte blocks, approximately 61 microseconds of DMA stall). LY/STAT are checked again inside a short critical section. A single LY sample must be within 144..149, reserving setup time so actual DMA starts remain within 144..150. The last scanlines are reserved for completion/return margin and LY's early reset. No IRQ is masked while waiting for VBlank.
- A fixed-ROM VBlank callback consumes a published WRAM transfer descriptor even while the main-thread audio producer is running. The main thread can also consume it opportunistically during VBlank. An owner flag prevents reentry; the volatile descriptor is published last through its pending byte. Palette data is staged in WRAM too, so the callback never reads the interrupted caller's ROM bank. The callback permits the unchanged timer interrupt between bounded DMA critical sections. Callers retain the staging buffer until completion.
- The producer runs cooperatively from fixed ROM. Text calls it between decoded words, cache lookups, glyphs and transfer chunks, including while waiting. Each yield replenishes the existing lookahead queue before returning to rendering. The timer ISR only consumes queued APU register writes and never maps ROM/WRAM or calls banked code. Main-thread source/glyph reads restore their incoming ROM bank.
- Window patterns remain bank-1 9000..97FF, window map 9C00 and palette 7. Original background and NPC ownership is unchanged. IRQs can return during rendering mode 3, so the old assumption that a GBDK upload helper remains safe after an interrupt is not used.
- Integrated text cells reserve bank-1 WRAM D800..D93F, with a guard at D940..D94F. Staging occupies D950..DA4F. The glyph hash occupies DA60..DB5F, followed by a stack guard at DB60..DB6F; the stack has DB70..DFFF (1,168 bytes). The original map workspace and guard below D800 remain protected. SVBK stays 1. The original 1,024-byte state is shared with the platform, not duplicated.
- The integrated verifier reads the audio engine's existing pair of immutable completed-event snapshots. This observes consistent 216-byte states while text and audio computation continue; it does not wait for the producer to become idle at a particular frame phase. The audio interpreter and output queue remain the same.

Pan Docs specifies a 4,560-dot VBlank and warns that an interrupt can invalidate a previously checked VRAM access window. Double speed changes CPU/timer speed but not PPU or APU timing. References: [rendering](https://github.com/gbdev/pandocs/blob/master/src/Rendering.md), [VRAM/OAM access](https://github.com/gbdev/pandocs/blob/master/src/Accessing_VRAM_and_OAM.md), [CGB registers](https://github.com/gbdev/pandocs/blob/master/src/CGB_Registers.md). These are hardware constraints; the measured results here are from the pinned Mesen core, not a physical-GBC or cross-emulator certification.

## Verification design

The same ROM and audio plan run with and without text load. An independent host oracle executes unchanged NES 6502 instructions, compares each observed completed audio state and consumed output hash, and checks actual GBC envelope/noise registers. Queue underruns and timer-deadline lateness must remain zero; elapsed timer time is compared with emulator master time to detect lost timer interrupts.

A read-only Mesen Lua observer is installed after initial loading and before a repeatable audio restart. It observes every VRAM/palette write, including DMA writes (`GbDmaController::ProcessDmaBlock` and `ScriptManager::ProcessMemoryOperation` dispatch them to the same callback), rejects non-VBlank writes, counts LCD-off writes, and hashes actual timer-consumer APU bus writes. The final hash includes the explicit four channel-silence writes at diagnostic termination. This audit is independent of the ROM's transfer-success counters. Captures wait three complete frames after a page finishes. The verifier explicitly disables Mesen's display-frame blending while retaining CGB color correction: its pause/resume-dependent blend buffer can otherwise produce half-bright screenshots, unrelated to emulated palette data.

The load cycle includes both original NPC branches, names/item/amount substitutions, all 2,350 approved Hangul glyphs, and an explicitly synthetic 116-distinct-glyph full window. The latter is a renderer bound test, not invented gameplay. Page cells, source game state, OAM, protected VRAM and actual RGB screenshots are compared independently. A-button edges acknowledge pages. The verifier holds each press until the main input loop accepts it, then waits for the observed release before pressing again. Three-frame pulses could otherwise be missed while the cooperative producer ran, leaving a healthy idle window waiting for input. The game exposes its polled keys for observation; input semantics are unchanged. Short-tap responsiveness is not certified by this diagnostic. Static text and ordinary NPC suites remain regression gates.

## Baseline before latency optimization (2026-11-23, PR #9)

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

**Baseline latency:** upload/preparation while the window was hidden reached 155 frames (about 2.6 seconds) in this stress run, excluding earlier text decoding. This was an audio-continuity and memory-access gate, not a shipping dialogue-response-time pass. The follow-up measurements below retain that suite.

Baseline integrated ROM SHA-256: `e78773b3a96aea21b94c15614f74ff241afa06fc569d888e1a2f3e6286f50cf4`. It is a local 1 MiB CGB/MBC5 diagnostic. Its fixed ROM ended at 249A, static WRAM at CFAC (84 bytes below D000), and text bank 14 used 4,061 bytes. The baseline stack began at DA60; the current hash/stack reservations are described above. The public repository contains source and validation summaries only.

Normal proximity/movement, original dialogue timing, choices, concurrent map transitions and final timbre quality are outside this integration. Initial map/NPC loading still uses LCD-off before audio starts.

## Latency optimization (2026-11-23)

The main-thread VBlank poll could miss entire upload opportunities while the original audio producer filled its queue. Glyph lookup also searched the growing cache for every cell, copied the complete token-reader checkpoint before every word, and opened/read/transformed glyphs individually. Profiling and staged experiments separated preparation from upload waits; increasing DMA size or dropping audio lookahead was not adopted.

The fixed-ROM VBlank callback now services prepared WRAM transfers while audio preparation continues. Text uses a 256-entry hash retaining first-use tile order, a 32-byte script buffer invalidated on message switches/rewinds, and reader checkpoints only where page overflow is possible. Consecutive glyph reads are batched within staging and asset boundaries; font descriptors are reused. The existing opaque-background bitplane transform runs in the builder, with raw glyphs retained by the independent pixel oracle. Translation content, control-code semantics, source audio engine, timer consumer and audio lookahead are unchanged.

A stress failure in an intermediate build exposed a separate LY race: two register reads could combine line 153's lower-bound result with its early reset to 0 for the upper bound. A read-only trace observed a DMA request at LY=0/mode 1, followed by the safety check crossing into mode 2. The fix samples LY once, even inside the critical section. The independent bus audit additionally rejects DMA requests outside the allowed start window or exceeding eight blocks. See [Pan Docs: LY line 153](https://github.com/gbdev/pandocs/blob/master/src/STAT.md#line-153). Raw failure traces and all generated artifacts remain local.

| Measurement | Optimized load | Same-ROM idle |
|---|---:|---:|
| Observed frames | 7161 | 7155 |
| Original source ticks / events | 7200 / 21366 | 7200 / 21366 |
| Completed requests | 302 | 0 |
| Queue underruns / late deadlines | 0 / 0 | 0 / 0 |
| Actual APU writes / rolling hash | 30938 / 16366 | 30938 / 16366 |
| Video writes / invalid writes | 339016 / 0 | 0 / 0 |
| DMA starts / invalid starts | 2691 / 0 | 0 / 0 |
| LCD-off writes | 0 | 0 |
| Timer versus master-time drift | -0.0 ms | 0.0 ms |

Maximum upload/preparation time fell from **155 frames (2.595 s) to 13 frames (0.218 s)** in the unchanged 82-job cycle, repeated throughout the 7,200-tick audio plan. This counter starts after text decoding/cache lookup. The added request-to-completion measurement includes that earlier work and input polling: **median 385.3 ms, p95 536.1 ms, maximum 653.3 ms** across 259 visible-page responses. It is observed at frame boundaries and excludes the three screenshot-settling frames. These two timing measures must not be conflated.

The regression gate requires maximum response <=750 ms, p95 <=600 ms and upload <=16 frames, in addition to every existing audio, state, memory, pixel and bus-write gate. This budget bounds this diagnostic workload, not all future gameplay. The first 82 requests and screenshots finish before the music plan ends; all 2,350 Hangul glyphs, 116-glyph peak cache and 1,889,280 captured pixels match the independent reference. Static-text regression: 79 requests / 67 screenshots / 12 explicit rejections. NPC regression: 2,801 requests / 81 screenshots / 312 joypad requests. Host tests: 30 passed. The three ROMs are also rebuilt byte-for-byte from the 167-file publication allowlist and explicit private inputs before publication.

Current integrated ROM SHA-256: `4b2e5e124f324dbe6911686272a2080b4217477b99f7ac9ff09c72f1a86d2a1c`. Fixed ROM ends at 2556, static WRAM at CFD9 (39 bytes below D000), and text bank 14 uses 4259 bytes. Hash storage reduces the reserved stack to 1,168 bytes; stack/cell/map guards remain intact throughout the load run. This remains a single-cache page replacement, with the window hidden during transfer. Seamless scrolling, normal movement/NPC approach triggers and final sound timbre remain separate work.
