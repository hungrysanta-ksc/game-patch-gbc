# First-dungeon encounter and return boundary

2026-11-28. This connects original map 181 to its cave battle background 8,
using unmodified encounter rate 6 and group 0. The development entry is
player coordinate (3,19), reached by controller input in the original
new-game observation recorded for PR111. It does **not** implement the
title screen, opening event or a complete playable combat loop.

## Original structure and retained ownership

The normal-map consumer `3D/BDB9..BDDD` gates on active events, uses
`3E/C711` with F5/F6 for probability, then reads `2E/92F0` and calls
`3D/BD4D..BD77`. Formation selection advances F7 once and indexes the
original `3F/FE00`, `3D/BD78` and `2E/94F0` tables. `3F/E283` calls
`3A/8533..854D` for the raw map background byte in `39/BC00`.
The pending battle is dispatched after the original 16-pixel tile move.

The port retains those table consumers and independent RNG cursors.
The approved field/audio seed is folded once at the owner boundary;
neither the verifier nor the dungeon build supplies a favorable seed,
rate, tile property, formation or party. Canonical initial flags match
the privately observed post-opening flags. The initial party is still
the original initial-state party, with the approved fixed Korean names.

The same map asset directory already contains this dungeon. Its original
properties select graphics, collision, NPC list and song 2. The test route
uses x=3, y=19..27; these ROM cells have property **41**, and the wall at
y=28 has property 03. The earlier test assumption of 40 was rejected and
corrected against the ROM; collision and rate were never patched.

The scene build parameterizes the original terrain consumer instead of
duplicating the battle renderer. Group 0 retains all seven count layouts
and both directions (14 spatial keys). The cave patterns and bindings
occupy those existing encounter resource banks. They are static resources,
not pre-rendered animation frames. Shared party/window/audio resources
retain their existing banks and lifetime. Entry masks continue to update
the resident terrain through the original entry state machine.

GBC WRAM still requires the existing field/battle overlay and bank-7
suspension. No extra field cache, complete-screen fixture or secondary
audio engine is introduced. The map/background guards now follow the
compiled scene identity; unsupported identities still fail. The town
diagnostic remains separate and keeps its NPC/dialogue regression route.

## Reproduction and evidence boundary

```
npm run build:dungeon
npm run verify:dungeon
node tools/build-scene-layout.mjs
node tools/verify-encounter-roundtrip.mjs --auto-seed
node tools/verify-scene-layout.mjs
node tools/verify-scene-layout.mjs --dungeon
npm test
```

`VerifyDungeon` uses only normal directional input for travel. Its explicit
debug writes select the development mode, advance the existing entrance
frame diagnostic, and request diagnostic field return. Return is **not**
a victory, escape, damage calculation or reward. No map/party/RNG/audio
state is injected after boot. It runs three encounters and checks another
move after the last return. NPC conversation and weapon/SFX playback are
covered by the existing town regression, not claimed for this dungeon route.

The read-only observer records every probability call and seed publication.
The verifier executes the original instructions independently for probability,
formation, count, entry type, RNG continuation and party derivation. Source
terrain/monster pixels and actual emulator screenshots are compared; host
tests also cover every cave entry mask in both directions. The observer
starts at the first ready field frame, preserving the current APU hash.
Every later actual APU write is matched. Timer continuity begins with the
first consumed audio event, rather than including pre-audio initialization.

Raw logs, captures, ROMs and source-derived assets remain private under
`evidence/dungeon-roundtrip` and `build/scene-dungeon`. Build provenance now
hashes that build's own generated headers, rather than the town directory.

## Verified results

- 205 host tests passed, including cave terrain mask pixels and the original
  route collision/rate contract. Six lifecycle tests were rechecked after
  updating their evidence status.
- Dungeon ROM SHA-256:
  `a4ba14a9b4855d905e7b30f44e7379e0ee65fb2f810fcd071897d7e98a5ae85e`.
  Two runs gave the same three seeds (94, 11, 210) and formation-0 counts
  (3, 4, 4). All 114 probability calls follow the original RNG continuation.
- Eight exact screenshots cover initial field, all three battles and returns,
  and subsequent movement. No source enemy dots are dropped. Terrain mask
  comparisons include both entry directions separately from this route.
- 2,691 source audio ticks and 15,120 actual APU writes after attachment
  matched the independent source/output reference. No underrun, late output,
  foreign APU write, unsafe video write, DMA or bank error was observed.
  Timer drift range was 304 microseconds; stack sentinel survived with
  292 bytes of the measured 512-byte window untouched.
- Resource loading after dispatch measured **1.016–1.080 seconds**.
  Diagnostic frame-driven entrance then took **2.881–3.149 seconds**.
  These are separate costs; this is not a performance improvement or proof
  that automatic entrance playback meets original cadence. The 0.5-second
  resource-loading target remains open.
- The rebuilt town ROM is byte-identical to PR112:
  `7d485d2d1b8eff3659e100ef7376cbf768bb242cad96a7cc4d5bf588d210c528`.
  Its exact-artifact evidence is revalidated with `--auto-seed --reuse`;
  that recheck is not described as a new emulator run. All seven cycles,
  589 screenshots, 7,200 audio ticks and 34,901 APU writes passed again,
  including complete weapon/numeral playback and return dialogue.
- The dungeon ROM also passed 650 overlay checks over 64 switches with
  7,200 source audio ticks. Both builds retain the same layout: common end CA7C, field overlay 978,
  battle overlay 1,365, fixed end CFD5 and field suspension 4,050/4,096 bytes.

## Remaining integration

Expand the shared resource registry beyond group 0 and connect source
action decisions/calculation and victory/escape results to the same
canonical state. Include state damage, special encounters and return
events. Keep the 0.5-second loading target separate from source entrance
animation duration. R2 integration remains 0/8 and product gates 0/3;
these diagnostic roundtrips do not constitute normal game completion.
