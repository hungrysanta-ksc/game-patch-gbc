# Selected encounter and current-party resources

The combined development ROM adds entry mode 6. A completed field tile step
selects the original formation/background; an exact formation/count/direction
key then supplies the enemy plane, entry state, hit-flash maps, message monster
IDs, weapon target coordinates and damage-number coordinates. A diagnostic
profile is never substituted for an unknown key.

## Source structure and scope

- `3D/BDB9..BDDD`, `3F/E20F..E283`, `3A/8533..854D`: the existing field
  consumer decides whether/which encounter occurs, then dispatches after the
  full 16-pixel step. The reviewed field is world 0, map 29. Its **whole**
  source group 0 selects formations 0 and 1, with 3 + 4 count combinations.
- `2F/A02A`, `A0B7..A0E6`, `9FAA`, `A31F`, `B909`: source bounds and ordered
  RNG draws select counts before layout/slot resources. The catalog contains
  all seven combinations in both orientations (14 keys); source entry rules
  still determine which orientation is actually reachable.
- `34/87BE..88E0`: the original entry-rule consumer runs with current party
  levels, original enemy levels and the RNG counters left by count selection.
  Zero levels retain their original exclusion rule. Normal on-foot low-byte
  battles are the current boundary; vehicles/event flags are not inferred
  from old saved position bytes.
  The all-zero level case also follows `34/886F` → `3F/FC92`: its average
  is zero. The previous port used 255, which changed initiative against
  nonzero-level enemies. Asymmetric zero/nonzero cases now cover that edge.
- `31/A400`, `34/9474,9D06`, `31/AA16`, `2F/AA00,B304,B52A`: current jobs,
  equipment, status and HP retain the previous live-party owner. Equipment
  derived fields are committed; a temporary reversed battle row must not
  overwrite the persistent field row.
- `2F/B24F`, `33/A0C0,A094`: each weapon action reads the acting member's
  current equipped IDs. Job poses already use the current job. Shared command
  tiles restore from their own ROM bank, followed by the current status icons.
  The action keeps the RNG counters from encounter initialization.
- `2F/A738,AF34` and the existing numeral/weapon consumers retain their source
  update order and waits. Only their spatial resource key changes.

This is a development integration, **not completed combat**. The field test
changes the eligible-tile bit/rate and supplies the output seed of `3F/FC27`.
The full virtual NES zero-page owner needed to derive that seed from normal
gameplay is still absent. With no explicit seed, mode 6 leaves the selected
encounter pending even if a diagnostic enter request is sent. It does not
hash arbitrary GBC RAM or silently choose a seed/profile. Action scripts,
hit counts and damage values remain explicit consumer inputs, not a damage
calculation or battle-AI implementation. Return request 2 is diagnostic
completion, not victory/escape/reward processing.

## GBC resource adaptation

The source keeps enemy graphics resident through entry and actions. This port
also loads one immutable enemy resource set per encounter and retains it;
there is no frame-indexed movie or per-frame full-picture composition.
Conversion runs from the user's original ROM at build time. Exact source
layout/count keys materialize spatial maps because 7:8 sampling mixes NES
attribute boundaries inside GBC 8-pixel cells. Runtime pixel composition
would add work before every first presentation. A per-key ROM catalog trades
space for bounded loads; it is not a claim that duplicating this catalog for
the whole game is optimal. Shared monster patterns/map patches and deduplication
must be costed before expanding to every encounter group.

Formation 0's four-goblin arrangement needs 12 residual color OBJ on the old
grid, exceeding the eight slots available alongside 24 party and eight status
OBJ. Palette reassignment alone did not close that gap. The two goblin rows
move upward by 4 and 6 pixels respectively; every sampled enemy pixel keeps
its color and position relative to its own row. Their color boundary now
lands on a tile boundary, requiring **zero** residual OBJ. Formation 1 retains
its previous position (at most five residual OBJ). Slash/impact/arrow and
number anchors receive the same row displacement, with the existing complete
effect-glyph viewport bounds preserved. Party and number glyphs are unchanged.

The expanded catalog occupies data banks 128..141. The cartridge grows from
2 MiB to 4 MiB, retaining the eight-bit bank ABI and a zero ninth bank bit.
[Pan Docs MBC5](https://raw.githubusercontent.com/gbdev/pandocs/master/src/MBC5.md)
specifies the low eight bank bits at 2000–2FFF and the ninth bit separately.
No audio/data bank is shared by accident. ROM-DMA patterns lead their banks
on a 16-byte boundary, checked again in the linked ROM.

Resident main-thread composition code moves to bank 116; IRQ/raster and
transfer leaves stay fixed. Every resource read returns through the existing
fixed bank-copy boundary before banked code continues. Source RNG tables
already have two immutable variants in bank 52: entry copies four 64-byte
chunks with audio service between them instead of recomputing 256 products.
The temporary table uses D200..D4BF only before display loading; current-party
preparation and the resident map may reuse that workspace afterward. Four
common boundary bytes survive the arena exchange; field/NPC/audio ownership
otherwise follows the existing single-boot roundtrip contract.

`3F/FA2F` disables source PPU output before `FA34` preserves field context.
The GBC has an asynchronous publication queue: a final tile picture can be
deferred behind the previous one. A latched encounter now drains that queue
and retries the dirty picture before suspension, without polling another
movement/NPC tick. The old error-boundary halt could strand this picture;
both selected-encounter and legacy roundtrip tests exercise the boundary.

## Reproduction and acceptance

Use the private local input configuration and the existing exploration/effects
builds, then run:

```text
node tools/build-scene-layout.mjs
node --test tests/encounter-resources.test.mjs
node tools/verify-encounter-roundtrip.mjs
node tools/verify-scene-roundtrip.mjs --live-party
node tools/verify-scene-roundtrip.mjs
node tools/verify-scene-layout.mjs
```

`build/scene-layout/encounter-resources.json` records generated keys and hashes.
`evidence/encounter-roundtrip/` holds the private exact-ROM capture, raw logs,
source audio comparison, screenshots and final report. These files and the
ROM remain excluded from publication.

Validated combined ROM SHA-256:
`0da3239c20b6cb6fe586bae2fe262e45187ddc9fcdec6a81ce528416d56f003a`.

- Original execution covers 512 formation/seed pairs; all 14 spatial keys
  preserve every sampled enemy pixel within the shared OBJ budget.
- Compiled entry/status/cannon/retarget/split tests pass 10,859 original-code
  comparisons, including asymmetric zero-level averages. The deliberately
  corrupted fixture is rejected at case 0/index 0.
- One boot completes seven selected-encounter/action/field-return cycles,
  with actual controller movement and Korean NPC dialogue after every return.
  589 hardware screenshots match; source weapon bodies contain respectively
  16/40/16/40/16/40/24 frames. Every action retains all 32 numeral frames,
  including four enemies displaying four-digit damage together.
  Acting jobs are 0..6 with source-compatible swords/staves or bare hands;
  this is not runtime coverage of all 22 jobs and every special command.
- All 7,200 source audio ticks and 34,760 actual APU writes match. There are
  no audio underruns/late ticks, out-of-window VRAM/OAM writes, foreign APU
  writes or memory faults. Timer drift range is 342.846 microseconds.
- Resource-dispatch-to-loaded time is 969.541–1060.625 ms. Including the
  controlled tile step and pending-seed observation gives 1354.665–1451.393 ms.
  These figures do not meet the 0.5-second loading goal.
- Memory-boundary verification passes 64 cycles/650 checks on the same ROM.
  Common DATA ends at CA7C (four bytes before the arena); battle DATA uses
  1365 bytes with 43 bytes left below D000. The field backup uses 4050/4096
  bytes. The observed stack uses 225 bytes, leaving 287 untouched with an
  intact guard. New persistent owners require another allocation review.
- Host tests pass 197/197; the final field-publication change also passes
  the six lifecycle checks and reviewed-source audit.
- The same final ROM passes the legacy canonical-party six-roundtrip
  regression (31 screenshots) and magic two-roundtrip regression (79
  screenshots), each through 7,200 original audio ticks. Their final latched
  field encounter also drains the previously deferred picture correctly.

Frame-by-frame action captures deliberately pause at observation gates;
their roundtrip durations are not normal-play animation benchmarks. Entry
`loadMs` starts at resource dispatch, while `encounterToLoadMs` also includes
the controlled tile movement and pending-seed observation. The 0.5-second
entry target remains a separate acceptance item.

Remaining boundaries include natural field/ZP seeding, other maps/backgrounds,
stone, source command and enemy-action selection, enemy-target spell and
special-action owners, damage/status updates, and victory/defeat/escape commits.
R2/product completion counters do not advance on this diagnostic evidence.
