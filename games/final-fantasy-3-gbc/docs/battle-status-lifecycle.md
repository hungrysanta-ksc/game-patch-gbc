# Battle status lifecycle

Baseline: PR 123, `2ad85ffb467bb952ca75ac75fa94006d21e6966a`.
The supported Japanese ROM is the rule source. Korean reference screenshots
are presentation references, not a substitute for the status consumers.

## Ownership and execution order

| Phase | Original consumer | Owner / port contract |
| --- | --- | --- |
| Enter | 31/A400..A43F, A482..A4B7 | Clear battle records, import saved first status byte, HP and MP. Second status byte starts at zero. Equipment and near-fatal calculation follow. `ff3_ailment_enter` is used by live party preparation. |
| Choose / execute | 34/98D3, 9E5F..9E93; 35/A66C | Dead/stone actors do nothing; sleep/paralysis use recovery action; confusion chooses a different action. Do not resolve an attack and discard its result afterward. Normal turn collection is still pending. |
| Target eligibility | 35/A387..A432 | Ordinary targets exclude dead/stone/jump. Life/Life2 and Phoenix Down bypass this filter; Heal/Soft and item Soft have first-target death checks before bypassing it. These are caller-specific exceptions, not a universal immunity function. ROM-executed target tests cover all first-byte values. |
| Damage / infliction | 31/B17C, B30C, BBF3..BCD1, BCD2 | Spell hit, resistance, boss, undead and target gates precede the shared leaf. Physical attacks call `ff3_ailment_apply`; it preserves unsigned priority comparisons, partial stone and the original queue behavior. No extra poison RNG or sprite is generated for a skipped target. |
| Cure / form toggle | 31/B3CA, B7F1..B874, B40F..B473 | Clear the canonical record and staged bytes with different rules; do not OR a cure into the old status. Toad/mini use XOR. Resolved leaves are ported; complete magic/item dispatch is a separate integration gate. |
| Revive | 31/B38E..B3C9, BD03, BD24 | Non-undead effective revival removes mask 80, restores original 1..9/max HP, retains other statuses and updates the staged buffer. Undead routing and enemy removal-mask ownership remain with the spell caller. |
| Commit | 34/9369..9473 | Existing `ff3_result_status` preserves party/enemy differences. Party death clears only near-fatal and skips adding staged second-byte status; existing second-byte status is not erased. Enemy dead/stone/toad/mini follow the E8 conversion/removal rule. |
| Display | 34/9D1D..9D9D; 2F/B5B8, B607, B651, B72B | Canonical bits become normalized graphics bits and one prioritized icon. Dead/stone have no ailment icon. Toad wins over mini for assets; death wins over stone for pose. Confusion position/flip is independent. |
| Sleep/paralysis action | 35/A68A..A71B | One original RNG draw, wrapped chance and duration decrement. It does not always cure on the first successful draw. `ff3_ailment_recover` is a checked leaf; it is not a new turn scheduler. Physical-hit duration reduction remains in the existing command consumer at 35/A237..A29E. |
| Turn end | 34/80FF; 35/BA41, BADC..BB48 | Poison applies only with bit 02 and without C0. Damage is max HP / 16. Zero HP is normalized to death even on the skipped path. `ff3_ailment_poison` preserves this boundary. Escape skips the turn-end poison caller. |
| Victory / escape | 34/8163, 8306..8373 | Export first status byte AND FE, current HP and current MP. Never export the battle-only second byte. `ff3_ailment_leave` is verified but is not wired to diagnostic field returns. Ordinary defeat follows the separate game-over owner. |
| Field cure / next entry | 3C/9A7E..9ACE; 3D/A3C2..A417 | Field mask removal acts on saved status; Heal uses 7F, Soft uses 40 and Life uses 80. Field revival has a distinct HP rule. Do not reuse the battle RNG-based revival leaf in the field menu. Field menu integration remains pending. |

Record `+1`: 80 death, 40 stone, 20 toad, 10 silence, 08 mini,
04 blind, 02 poison, 01 near-fatal. Record `+2`: 80 paralysis, 40 sleep,
20 confusion, 18 duration, 06 partial stone, 01 jump. The normalized display
uses different bit positions. Equipment resistance, reflect, charge, haste
and protect live in other record fields; this module does not redefine them
as status bits or claim their command integration is complete.

## Confirmed interactions

- Stone suspends poison damage; it does **not** remove poison. Removing stone
  makes the retained poison eligible again. Exact-zero poison HP also causes
  death through BB3F; stopping analysis at BB3E would miss that branch.
- Ordinary attacks/magic do not target stone, so they must not reach damage
  or infliction leaves. A corrupted diagnostic stone record with zero HP can
  still be normalized to death by BB3F. Do not silently sanitize this away.
- Toad/mini can remain while stone is added. The asset kind remains small;
  the stone consumer uses the corresponding footprint. Both small-form bits
  select toad first.
- Confusion followed by stone is retained by the status leaf. B3CA explicitly
  checks stone+confusion for mask FF and rejects that cure. A blanket rule
  that clears confusion on petrification would contradict both consumers.
  The earlier confused-stone rendering stress test therefore remains useful,
  although it does not prove every injected combination is naturally reachable.
- Revival does not cleanse poison, blindness, silence, small forms or the
  second status byte. Only the requested cure mask is removed. A different
  cure or battle exit can remove those states later.
- Persisting through battle exit and surviving death are different rules.
  First-byte ailments survive return; near-fatal and the entire second byte
  do not transfer to the next battle.
- All four party members being dead or stone is defeat (34/A458), even when
  petrified members retain positive HP. Stone immunity is not immunity to
  the battle's loss condition.

## Implementation and cost boundary

`battle-ailment.c` owns shared calculation and projections without global
WRAM, VRAM or OBJ allocation. Physical infliction, live entry and command
normalization now use it. `ff3_status_icon` returns immediately for C0 and
the live command/restoration boundary reads canonical records instead of
reusing entry-time icons. Icon loading does not calculate poses; normalized
status generation does not calculate icons. Unchanged visible state is not
permission to remove B5B8's source publication/wait boundaries.

The original graphics cache, death/stone shared cell pool and 32 numeral
glyphs are retained. Suppressing hidden icons saves their 64-byte transfers;
it does not justify deleting stored ailments or assuming confused stone is
impossible. No action-speed improvement is claimed from this refactor.

The source inventory bounds attack properties to 115 records at
30/98C0..9C57; the next bytes are monster gil, not more spells. It finds
32 status-related records (3 damage+status, 18 infliction, 2 revival,
7 cure, 2 small-form toggles), 15 item mappings and 10 weapon records with
status or a status-related spell. Weapon IDs stop before 57; armor records
57..97 are a different interpretation, with 23 nonzero resistance masks. Generated record data stays local in
`evidence/ailment/inventory.json`; this count is not full gameplay coverage.

## Validation and remaining integration

Native fixtures execute original ROM instructions independently, then compare
record bytes, staged status, masks, messages, HP/MP and RNG with compiled GBC
code. The fixture stream uses source-derived deltas to fit the diagnostic ROM;
expected and actual buffers are still compared in full. A deliberately wrong
expected byte must fail. Separate source tests cover target exceptions,
poison→stone→cure→poison, small-form stone, revival, exit/re-entry and recovery.

The common leaves are not proof that normal item selection executes a complete
spell, that a real turn invokes poison, or that victory/escape commits state
to the field. Those callers remain the next integration gate. Do not add
independent per-ailment render logic before connecting the shared lifecycle.
Confused-stone+magic capacity, event battle continuation and field menu cure
consumers remain explicit pending work.

Verified on the combined ROM
`1fa8435f8ebfd05bb8fada042cdb48bcc85e9e11fe9c03892537ba35ec9bbf2f`:

| Check | Result |
| --- | --- |
| Compiled status leaves | 53,734 original-execution cases pass; corrupted expected byte fails at case 0/index 0 |
| Compiled context / existing command suite | 12,510 / 3,470 cases pass |
| Node suite | Full 242 tests pass; final targeted lifecycle suite 7 pass, including the additional all-stone defeat case |
| Same-boot current-status icon restoration | Two resolved attacks with diagnostic poison add/remove; current icon IDs and original 64-byte patterns match; three encounters and field returns |
| Stone/death/magic regression | 37 death pictures, 54 magic pictures, cure/re-stone/death-priority refresh and source pixels pass |
| Dense confused stone | Both orientations retain all 32 numeral pictures and full source pixels; 76 captures, raster peak 8 objects per scanline |
| Mixed party defeat | Source party dots, command arithmetic, 20 fade VBlanks and restart display pass |

The icon intervention validates the state and pattern inputs to selection;
it is not proof of the unfinished normal command loop's icon animation cadence.
All four combined runs preserve the original audio stream/APU-write checks,
with no underrun, unsafe bus access or mapped-memory fault. Timer drift ranges
are 326.157 µs (icons), 329.018 µs (stone), 308.990 µs (dense), and 339.031 µs
(defeat). The dense run consumes 5,663 audio ticks and 34,808 APU writes.
Minimum observed untouched stack is 129 bytes, with all guards intact.
Bank 16 uses 12,713 / 16,384 bytes; battle DATA remains 1,396 bytes.
Automatic numeral timing still differs from the original; no timing or
complete-gameplay claim is added by these passes.

Reproduce with `npm run build:battle-ailment`, `npm run verify:battle-ailment`,
`npm run verify:battle-ailment-negative`, `npm run build:dungeon`,
`npm run verify:dungeon-ailments`, `node tools/verify-dungeon.mjs --stone`,
`npm run verify:stone-dense` and `npm run verify:party-defeat-mixed`.
Native context/command suites use their existing build/verify scripts.
Raw logs, generated fixtures, inventory and screenshots stay under ignored
`build/`, `evidence/` and `.local/`; only authored source is exported.
