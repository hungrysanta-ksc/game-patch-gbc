// Explicit publication allowlist. Never enumerate build/evidence/private inputs.
import fs from 'node:fs/promises';import{ROOT,hash,check}from'./source.mjs';
export const files=[
 '.gitattributes','.gitignore','AGENTS.md','README.md','THIRD-PARTY-NOTICES.md','local.example.json','package.json',
 'docs/implementation-roadmap.md','docs/development-skills.md','tools/survey-source.mjs',
 'docs/data-registry.md','spec/data-registry.json','tools/register-data.mjs','tools/registry-core.mjs','tests/registry.test.mjs',
 'docs/platform-foundation.md','src/platform-call.h','src/platform.h','src/platform.c','src/platform-probe.c',
 'docs/state-save-rng.md','src/game-state.h','src/game-state.c','src/game-save.c','src/game-state-test.c',
 'tools/state-source.mjs','tools/build-state.mjs','tools/build-state-verifier.mjs','tools/verify-state.mjs',
 'tools/VerifyNative/Core.cs','tools/VerifyState/VerifyState.csproj','tools/VerifyState/Program.cs',
 'docs/map-assets.md','src/assets.h','src/assets.c','src/map-display.h','src/map-display.c','src/map-viewer.c',
 'tools/map-assets.mjs','tools/map-pixels.mjs','tools/build-maps.mjs','tools/build-maps-verifier.mjs','tools/verify-maps.mjs',
 'tools/VerifyMaps/VerifyMaps.csproj','tools/VerifyMaps/Program.cs','tests/maps.test.mjs',
 'docs/field-objects.md','src/field-objects.h','src/field-objects.c','src/object-viewer.c',
 'tools/object-assets.mjs','tools/object-reference.mjs','tools/build-objects.mjs','tools/build-objects-verifier.mjs','tools/verify-objects.mjs',
 'tools/VerifyObjects/VerifyObjects.csproj','tools/VerifyObjects/Program.cs','tests/objects.test.mjs',
 'docs/text-window.md','src/text-window.h','src/text-window.c','src/text-viewer.c',
 'tools/text-source.mjs','tools/korean-text.mjs','tools/text-reference.mjs','tools/build-text.mjs','tools/build-text-verifier.mjs','tools/verify-text.mjs',
 'tools/VerifyText/VerifyText.csproj','tools/VerifyText/Program.cs','tests/text.test.mjs',
 'docs/npc-dialogue.md','src/npc-dialogue.h','src/npc-dialogue.c','src/dialogue-viewer.c',
 'tools/dialogue-source.mjs','tools/dialogue-build.mjs','tools/dialogue-reference.mjs','tools/verify-dialogue.mjs','tools/build-dialogue-verifier.mjs',
 'tools/VerifyDialogue/VerifyDialogue.csproj','tools/VerifyDialogue/Program.cs','tests/dialogue.test.mjs',
 'docs/port-plan.md','docs/audio-design.md','docs/audio-validation.md','docs/vgz-assessment.md','docs/timed-audio.md','docs/localization-inputs.md','docs/audio-backlog.md','docs/audio-control.md','docs/audio-channel.md',
 'spec/source.json','spec/toolchain.json','spec/port-policy.json',
 'src/audio-player.c','src/vgm-player.c','src/audio-control.c','src/audio-control.h','src/audio-control-test.c','src/audio-channel.c','src/audio-channel.h','src/audio-channel-test.c','tests/audio.test.mjs','tests/vgm.test.mjs','tests/timed-stream.test.mjs',
 'tools/source.mjs','tools/driver6502.mjs','tools/extract-audio.mjs','tools/gb-audio.mjs',
 'tools/nes-harness.mjs','tools/build-audio.mjs','tools/build-capture.mjs','tools/capture-audio.mjs',
 'tools/wav.mjs','tools/make-comparison.mjs','tools/export-source.mjs','tools/vgm.mjs','tools/audit-vgm.mjs',
 'tools/Capture/Capture.csproj','tools/Capture/NuGet.Config','tools/Capture/Program.cs',
 'tools/timed-stream.mjs','tools/build-timed.mjs','tools/build-timed-verifier.mjs','tools/verify-timed.mjs','tools/control-fixtures.mjs','tools/build-control.mjs','tools/channel-fixtures.mjs','tools/build-channel.mjs',
 'tools/VerifyTimed/VerifyTimed.csproj','tools/VerifyTimed/Program.cs',
 'docs/audio-native.md','docs/field-audio.md','tools/field-source.mjs',
 'src/field-event.h','src/field-event.c','src/field-event-test.c','src/field-scene.h','src/field-scene.c',
 'src/audio-music.c','src/audio-music.h','src/audio-engine.c','src/audio-engine.h','src/audio-engine-test.c',
 'src/audio-output.c','src/audio-output.h','src/audio-native.c','src/audio-native-irq.inc',
 'tools/engine-fixtures.mjs','tools/build-engine.mjs','tools/build-native.mjs','tools/native-plan.mjs','tools/native-reference.mjs',
 'tools/build-native-verifier.mjs','tools/verify-native.mjs','tools/VerifyNative/VerifyNative.csproj','tools/VerifyNative/Program.cs'
];
const entries=[];for(const path of files){const b=await fs.readFile(ROOT+'/'+path);entries.push({path,bytes:b.length,sha256:hash(b),basis:'Project-authored code, specification or documentation; no extracted assets'});}
const manifest=JSON.stringify({schema:1,scope:'Source-only development package; generated ROM/audio/private inputs excluded',files:entries},null,2)+'\n',target=ROOT+'/export-manifest.json';
if(process.argv.includes('--check'))check(await fs.readFile(target,'utf8')===manifest,'Export manifest is stale');else await fs.writeFile(target,manifest);
console.log(JSON.stringify({files:files.length,manifest:target,checked:process.argv.includes('--check')}));
