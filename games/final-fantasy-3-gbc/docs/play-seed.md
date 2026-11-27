# Live GBC battle seed

The user approved deriving the initial battle seed from current GBC play
state. Identical controller input need not produce the identical NES battle
result sequence. Encounter probability, formation selection, RNG tables,
counter progression and gameplay calculations retain their source contracts.
This approval changes the initial entropy input only; it does not declare
pending damage/result consumers implemented.

## Source ownership and decision

The source path and real NES observation are in
[encounter-seed-boundary.md](encounter-seed-boundary.md). `3F/FA26` preserves
field context, `2E/9E8E..9F28` replaces 27 DP bytes, and `3F/FC27..FC2C`
adds every byte with carry before initializing the three RNG cursors. The
seed is not the field encounter RNG cursor; these are distinct owners.

The byte inventory retains all 256 addresses: 27 prefix-owned, 28 already
represented by semantic GBC field values, 10 audio-local scratch, and 191
other source-state bytes. The last group includes graphics, text, events,
vehicles and insufficiently understood scratch; it is **not** presumed
unused or zero. The audit checks 2,353 direct-write candidates against ROM
bytes and keeps 55 indexed/indirect write sites separate. These are static
candidates from banks 36–3F, not proof of the last writer on every route.
Raw addresses, source lines and hashes are retained privately in the report.

Maintaining a shadow NES DP would require reproducing intermediate values
from removed naming, NES window layout, graphics pointers and audio locals.
A 256-byte persistent copy also does not fit the current common WRAM's four
free bytes or the field suspension's 46 free bytes without rearranging owners.
That work would preserve incidental NES memory rather than additional game
rules. The approved alternative needs no persistent allocation or copy.

## Explicit input contract

`ff3_play_seed()` folds these 31 field bytes in order, then the live audio
engine's 192-byte logical `$7F40..$7FFF` state:

```text
x y subx suby direction speed z current next property trigger
keys previous world map rate rng_index rng_direction npc_cursor npc_rng
reserved_x reserved_y formation_rng battle battle_background frame dialogue_frame
steps.low steps.high ticks.low ticks.high
```

The 223-byte extent is explicit. It is not padded into a fake 256-byte NES
image. Struct padding, renderer timings, diagnostic counters, hardware or
code addresses and host timestamps are excluded. Audio bytes are actual
initialized engine state, not samples or the converted APU register stream.
The ADC operation retains intermediate carry and discards the final carry,
as the source does. A and carry start at zero for the currently supported
ordinary on-foot entry. The NES-DP replay function remains separate.

Both input owners change on the main thread. The fold calls no audio service
or event handler, so their values stay consistent while timer/VBlank
interrupts and queued APU writes continue. It does not disable interrupts,
consume a gameplay random number or modify either input. The producer's
audio state may be ahead of audible output; that is part of this explicit
entropy contract, not an audio synchronization requirement.

## Entry and return

Mode 6 uses `scene_rng_ready=2` by default at boot and after return. Once the
original encounter is latched and the tile/event has finished, the field
owner computes the seed and publishes ready=1 before handing off its arena.
If video suspension needs a retry, ready=1 preserves the same seed. The
battle owner requires ready=1, selects the resident source RNG table, sets
all three counters, consumes source count/entry rules, and clears readiness.
No field state is read after its arena has been replaced.

Ready=0 is an explicit diagnostic hold; ready=1 can also supply a specific
reference seed for existing coverage. They are not required by ordinary
mode-6 entry. Unsupported maps/backgrounds/vehicles remain gated; current
integration still uses map 29/group 0. Map 181/background 8 is next.

## Verification

```text
node tools/audit-seed-ownership.mjs --disassembly PATH_TO_PRIVATE_FF3J_ASM
node tools/build-battle-context.mjs --seed-capture evidence/encounter-seed
node tools/verify-battle-select.mjs --context
node tools/verify-battle-select.mjs --context --negative
node tools/build-scene-layout.mjs
node tools/verify-encounter-roundtrip.mjs --auto-seed
node tools/verify-encounter-roundtrip.mjs
node tools/verify-scene-layout.mjs
```

The automatic regression does not write `scene_rng_seed`. It holds a
controlled eligible encounter long enough to capture field ownership, then
re-arms the actual producer. For each observed seed, independent original
instructions calculate expected counts, entry type, RNG continuation and
weapon frames. A read-only Lua observer captures all input bytes at the
ready publication for an independent ADC comparison. Seven returns verify
re-arming, continued movement/dialogue and source audio coexistence.

This still controls the eligible tile, rate, party and action diagnostic.
It is not a natural first-dungeon playthrough or complete combat calculation.

## Results

- Host tests: **203 passed**; the updated lifecycle tests also passed.
- GBC context tests: **12,511 passed**, including 799 GBC entropy cases and
  853 exact-NES-input seed cases. The corrupted fixture was rejected.
- Combined ROM SHA-256:
  `7d485d2d1b8eff3659e100ef7376cbf768bb242cad96a7cc4d5bf588d210c528`.
- Live-seed regression: seven same-boot cycles, five distinct formation/count
  combinations, **589** exact screenshots and **7,200** source audio ticks.
  Every one of the **34,901** actual APU writes matched the reference.
  Seven producer publications matched independently executed ADC operations;
  re-running the same controlled input produced the same seven seeds.
- Fixed-seed regression: all seven count combinations, **589** screenshots,
  **7,200** ticks and **34,528** matched APU writes. Different source request
  timing legitimately changes the write count; each run has its own oracle.
- Both paths retain all source weapon frames (16/40/16/40/16/40/24) and all
  32 numeral frames per action, with no audio/video bus or memory faults.
- Memory switching: **650** checks over **64** cycles. Common end CA7C,
  battle overlay 1,365 bytes, fixed end CFD5 and suspension 4,050/4,096 bytes
  are unchanged. The new fold adds **135 bytes** to code bank 16.
- Live-seed controlled loading remains approximately **1.008–1.107 seconds**;
  the 0.5-second target is still open. The seed change is not a load-speed fix.

The first live run completed but its final log had lost early entropy
samples to the emulator's bounded log. The read-only observer now retains
those samples and re-emits the full set at the final audio boundary. The
same ROM was re-run; no game behavior or acceptance condition was relaxed.
Failed and corrected raw evidence remain private.
