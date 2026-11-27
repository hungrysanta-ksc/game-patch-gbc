# Original encounter seed boundary

This step implements and verifies the original **consumer** of the field
zero page. It does not manufacture a complete source zero page from the
current compact GBC field structure. Mode 6's explicit seed boundary remains
in place until that producer contract is resolved.

## Actual source execution

The supported Japanese ROM was started in the managed Mesen adapter from
power-on. New-game naming/dialogue and field movement used controller input
only; no memory writes or state loads preceded the observation. The first
normal encounter reached `3F/FA26` on map **181**, with formation **0**,
background **8**, flags **0**, vehicle **0**. Its encounter group is **0**,
the same group registered for the current map-29 diagnostic. The background
and actual map route are different and still need integration.

The adapter's execution breakpoints observe the completed instruction:
`FA26` stops at `FA29`, `2E/9F28` stops at `FC27`, and `2E/9F2B` stops at
`A02A`. Private snapshots preserve the full input RAM, CPU flags, post-prefix
zero page and generated RNG table, with source/host hashes. Replaying every
original instruction from `FA26` reproduces all 256 observed seed-input
bytes and incoming A/carry. The observed seed is **CE**, all three counters
are CE, and the entire 256-byte table matches the existing immutable variant.
CE is an observation, never a proposed fixed product seed.

Source order is `FA26` → `FB17` (save field DP, excluding live sound DP) →
`FAB5/FB87` (IRQ/bank setup) → `2E/9E8E..9F28` (battle initialization) →
`FC27..FC2E` (ADC chain) → remaining FC27 table generation → `A02A` (counts).
The oracle executes the OAM clear and all 12 KiB of VRAM clear writes; it
does not skip those calls or synthesize their register effects.

## Consumer and lifetime

The prefix writes exactly 27 distinct DP bytes:

- `00,01,03..11`: battle graphics scratch/constants; byte 02 is inherited.
- `7E`: incoming battle flags.
- `A9..AC`: bank-loading scratch; AB becomes 17, the others zero.
- `B8,C9..CC`: cleared battle scratch.

The other **229 bytes** remain inherited, including sound scratch `D0..DF`.
The VRAM-clear routine leaves A=0. Carry is 1 exactly when vehicle ≥4 and
incoming flags ≥4, from `2E/9EAF..9EB5`. FC27 adds bytes in address order,
retaining carry between ADCs; it does not fold the last carry into the result.

`ff3_encounter_seed()` applies these writes during the checksum rather than
allocating/mutating a duplicate DP image. Its input is immutable and complete.
The existing two resident RNG tables can still be selected using seed bit 1;
the expensive table generator need not run at each GBC encounter. The new
consumer reserves no persistent RAM and has no audio or video side effects.

## Remaining integration decision

The compact GBC field structure and ported audio engine do not retain every
NES compiler/scratch byte. A timer, formation RNG counter or zero-filled
array is not equivalent to the observed source input. Consequently this
change does **not** enable a silent fallback or remove the mode-6 seed gate.

Next, inventory which inherited bytes have a live semantic owner, which
belong to removed UI (including custom naming), and which are incidental
NES scratch/timing state. Compare a maintained logical DP image against an
explicit GBC entropy-input contract before selecting the producer. Keep
encounter probability, formation selection, RNG table generation, counters
and gameplay consumers separate from that platform-dependent entropy choice.
Do not build a NES CPU emulator solely to reproduce incidental seed bytes.

The next natural-route test should use map 181/background 8, rather than
treating the controlled town tile/rate as natural encounter evidence. Whole
game command calculation, rewards/escape and R2/product gates remain open.

## Fixed Korean names

The user-supplied Korean NES reference was separately started and observed:
**루네스, 아르크, 레피아, 잉구스**, each shown with an A-button confirmation.
Its SHA-256 is `f4e33d48c474a9ac7d945d1bafcdcaf01fec9b7d78257357c574b9661ccdd1b5`.
The user explicitly excludes custom naming. Existing GBC name glyphs already
match, so no name-entry UI or Japanese-name-byte converter is required.
The reference remains private and is not the extraction/build input or a
source of game-logic expectations.

## Reproduction

```text
node --test tests/encounter-seed.test.mjs
node tools/build-battle-context.mjs
node tools/verify-battle-select.mjs --context
node tools/verify-battle-select.mjs --context --negative
```

With the private original observation files:

```text
node tools/audit-encounter-seed.mjs --capture evidence/encounter-seed
node tools/build-battle-context.mjs --seed-capture evidence/encounter-seed
node tools/verify-battle-select.mjs --context
```

The kernel suite includes 852 generated full-input cases: every byte's
dependency, prefix-owned bytes, transport/flag carry paths, overflow and
nonzero inherited state. The optional captured case is additional, never
required to build the source-only package. Captures, states, original bytes,
screenshots and ROMs remain outside the publication allowlist.

## Validation

- Host suite: **199/199** passed.
- GBC context kernel: **11,712** cases passed, including 852 generated seed
  cases and the additional natural NES capture. The intentionally corrupted
  fixture failed at case 0, byte 0 as expected.
- Combined ROM SHA-256:
  `c2d2a116d37321c4833d57363c3bc12d469928e5f7a15a726b31d46f2b8309db`.
- The existing controlled encounter regression completed seven same-boot
  field/battle/return cycles, including return movement and dialogue, and
  matched all **589** screenshots. All source weapon frames and all 32
  numeral frames per action remained intact.
- Original audio comparison covered **7,200** ticks and all **34,760**
  actual APU writes, with no audio/video bus or memory faults. Separate
  overlay validation passed **650** checks across **64** switches.
- WRAM remains unchanged: common end CA7C, battle overlay 1,365 bytes,
  fixed end CFD5, suspension 4,050/4,096 bytes. Lifecycle audit passed.

These are consumer fidelity and existing-path regression results. The new
seed consumer is not called by live mode 6 yet. Its controlled load duration
remains 969.541–1,060.625 ms; this change does not claim a loading speedup,
natural GBC entropy production, complete gameplay or improved timbre.
