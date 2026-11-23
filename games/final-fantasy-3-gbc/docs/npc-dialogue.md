# NPC conditions and Korean dialogue

This step connects original ordinary-NPC conditions to event selection, source string IDs, Korean substitutions and window acknowledgement. It is a diagnostic consumer, not normal-play completion. No ROM, extracted records, text, mapping, font or screenshot is published.

## Reproduction

Configure `local.json.dialogue` with private `font`, `bindings` and `translationDir` paths. The font is the same approved 7×7 font as [the text window](text-window.md). Bindings require original-string and bilingual-entry hashes, explicit reviewed control mappings and diagnostic inputs. Source extraction does not require the disassembly.

```powershell
npm run build:dialogue
node tools/build-dialogue-verifier.mjs
npm run verify:dialogue
npm test
```

Local output: `build/dialogue/ff3-dialogue-viewer.gbc`, `dialogue-analysis.json`, `report.json`; verification: `evidence/dialogue/result.json` and raw observations. A/B opens the configured NPC dialogue or acknowledges a page. START toggles the reviewed diagnostic condition and opens the other branch. SELECT opens reviewed substitution examples. These are test controls, not original proximity detection or gameplay triggers.

The reviewed local scene uses world 0, map 29, NPC 55, placement slot 1, camera (10,4). Flag 67 selects event 1 or 2 and the event's F0 command selects source string 575 or 548. This proves both branches through the real data chain, without executing an invented dialogue script.

## Source contracts

Addresses refer to the pinned `everything8215/ff3` revision recorded in [development skills](development-skills.md). Code comparisons execute unchanged instructions from the supported user ROM.

| Consumer | Original behavior retained |
|---|---|
| `3F/E9BB..EA25`, `3C/92F3..9341` | Any nonzero world selects the second NPC pointer page. Ordinary IDs 00..DF in each world: 448 records. Copy 64 bytes, scan through the unconditional fallback, copy the following 32 dialogue bytes, then choose the first matching condition clause. |
| `3C/9344..9359` | Condition bit 7 is polarity; the lower 7 bits address 128 flags at 6020..602F. |
| `3B/B6BF..B6E7` | F0 indexes the NPC dialogue buffer and adds 0200 or 0300 by world; F1 directly requests the low string group. Event zero means no event. |
| `3B/B983`, `3B/B999` | F2/F3 set/clear use the full 8-bit ID, reaching 6020..603F. They do not mask bit 7 like the condition reader. |
| `3F/EFF0..EFF7`, `F239..F334` | 0C selects the shown character using byte offset 00/40/80/C0 at 600E. 10..13 with operand 02 select party slots. Copy six name cells. |
| `3F/EF5B..EF79`, `F5D4..F5FC` | 02 resolves the current item through source ID 0400+item; item zero emits nothing. 03 uses the original 256-entry price table and six columns. |
| `3F/EF7C..EF9F`, `3C/8B78..8D6D` | 04 uses the caller's 24-bit variable amount in six columns; 05 reads 601C..601E in seven columns. Leading zeroes become FF spaces. |

The formatter preserves the original 24→16→8-bit truncation stages, including unusual glyph codes for out-of-range amounts. It does not clamp values or silently replace the original arithmetic with decimal formatting.

Only F0/F1/F2/F3/FF events are executable here. The entire event is preflighted before display or flag mutation. Other commands reject with NPC error 32; shops/inns and other special NPC IDs E0..FF reject with 30. This prevents a partially understood cutscene from appearing successful. Event FE/FF pointers and broader event timing remain unresolved.

## Korean data and state ownership

The supplied translation uses keys and markup from a different text layout. Numeric key coincidence is not an NES binding. Thirteen local source bindings were reviewed against Japanese content and source control order. `(PC1)` in the selected scene maps to 0C, not automatically to party slot 0. Unknown markup, changed hashes and dropped/reordered semantic controls fail the build.

Item-name bindings use original item IDs, strip only explicitly reviewed icon markup, and return to the parent message after nested expansion. The supplied `<josa(을,를)>` is compiled to local extension 0040 with two glyph IDs; selection uses the preceding item name's final consonant. Empty-item plus particle, untranslated item, invalid name/context and unsupported character parameters reject explicitly. Empty item alone retains the original no-output behavior. Names and expanded messages can cross page boundaries without truncation or duplicate line breaks.

Four committed name records contain six 16-bit glyph IDs each, padded with FF spaces. They are a **diagnostic sidecar** to the original 1,024-byte game state. This is not a name-entry editor, saved encoding or migration format. Name inputs come from four hash-reviewed private system entries; both the shown-character path and all four slot paths are checked. Original six-byte name selection is separately compared with unchanged 6502 code.

The supplied Korean entry omitted one clause present in both the NES source and supplied Japanese text. A separate private supplemental entry restores that clause; the supplied files were left unchanged. This addition, all bilingual text and all reviewed mappings remain excluded from Git. Existing NES punctuation shapes are reused for comma and single quote; they are not newly generated font assets.

## Validation and limits

Validated on 2026-11-23 with the pinned GBDK/Mesen tools: 30 host tests, 2,801 native dialogue requests (312 joypad requests), 81 screenshots / 1,866,240 RGB pixels, peak window cache 39/128 glyphs. The static text regression passed 79 requests, 67 screenshots and all 2,350 Hangul glyphs. Both ROMs reproduced byte for byte from the 158-file publication allowlist plus explicit private inputs.

Dialogue ROM SHA-256: `972a1e9093b6f43b1cfee7d84e784db4c026f4e19568fef04f1cc9286ca5621a`. Static text regression ROM: `11c85c6a68c37dfa303237647e94b25e8e106391eceffbcbf6dce52cf798718f`. These are local diagnostic artifacts, not distributed ROMs or a claim about hardware performance.

- Exhaustive combinations of referenced flags across 448 ordinary NPC records: 631 original-code comparisons (at most three distinct flags per record), plus nonzero-world boundary cases on GBC.
- Original-code comparison: all 256 prices, 1,056 numeric cases across both display widths, 128 F0 selections, 512 flag-writer cases and eight name-selector paths.
- Native checks cover NPC selection and copied dialogue bytes, both reviewed event branches, shown-character and party names, six-cell names across pages, nested item text and particles, all 256 price requests, variable/party amounts and explicit rejection paths.
- Real Mesen input acknowledges pages and re-enters the configured NPC. Independent expected window cells and RGB pixels are compared with emulator memory and screenshots. Game state, name records, map/NPC VRAM, OAM, bank restoration and memory guards are checked.
- The existing static text suite remains a regression gate, including every approved Hangul glyph. Source-only rebuilds must reproduce both text ROMs byte for byte.

The subsequent [dialogue/audio integration](dialogue-audio.md) replaces window uploads with bounded VBlank DMA and validates simultaneous original music/SFX. Walking/proximity checks, original event waits/movement, choices, item grants/consumption, inn payment and name-entry/save are not implemented by this step. Amount injection tests display only; they do not award or spend money. Normal exploration triggers remain the next gameplay integration.
