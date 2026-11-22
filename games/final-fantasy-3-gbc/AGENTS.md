# FF3 GBC project workflow

- Work on a feature branch. Never push changes directly to `main`.
- Publish through a pull request into `main`. Inspect the exact PR head, changed files and checks before merging. The user requested this workflow, including merging the current work through a PR. Do not bypass protection, failed checks or unresolved merge conflicts.
- Current implementation order and acceptance gates: `docs/implementation-roadmap.md`. `docs/port-plan.md` preserves the original scope and older planning history.
- Build from the user's supported original ROM. Keep original/generated ROMs, extracted assets, reference disassembly, observations and the supplied Japanese/Korean translation files outside Git. Publish only the explicit `tools/export-source.mjs` allowlist; update and verify `export-manifest.json`.
- Use the existing `create-kr-patch` skill plus the applicable installed `nes-reverse-engineering` and `gb-hardware-research` guidance. See `docs/development-skills.md` for pinned sources, local setup and FF3-specific limits. These skills are development aids, not product build dependencies.
- Preserve original mechanics and data. Unsupported consumers fail explicitly; do not turn them into successful no-ops. Inventory slot counts, syntactic decoding, original-code comparison and normal-play validation are separate claims.
