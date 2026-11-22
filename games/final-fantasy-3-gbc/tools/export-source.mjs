// Explicit publication allowlist. Never enumerate build/evidence/private inputs.
import fs from 'node:fs/promises';import{ROOT,hash,check}from'./source.mjs';
export const files=[
 '.gitattributes','.gitignore','README.md','THIRD-PARTY-NOTICES.md','local.example.json','package.json',
 'docs/port-plan.md','docs/audio-design.md','docs/audio-validation.md','docs/vgz-assessment.md','docs/timed-audio.md','docs/localization-inputs.md','docs/audio-backlog.md','docs/audio-control.md','docs/audio-channel.md',
 'spec/source.json','spec/toolchain.json','spec/port-policy.json',
 'src/audio-player.c','src/vgm-player.c','src/audio-control.c','src/audio-control.h','src/audio-control-test.c','src/audio-channel.c','src/audio-channel.h','src/audio-channel-test.c','tests/audio.test.mjs','tests/vgm.test.mjs','tests/timed-stream.test.mjs',
 'tools/source.mjs','tools/driver6502.mjs','tools/extract-audio.mjs','tools/gb-audio.mjs',
 'tools/nes-harness.mjs','tools/build-audio.mjs','tools/build-capture.mjs','tools/capture-audio.mjs',
 'tools/wav.mjs','tools/make-comparison.mjs','tools/export-source.mjs','tools/vgm.mjs','tools/audit-vgm.mjs',
 'tools/Capture/Capture.csproj','tools/Capture/NuGet.Config','tools/Capture/Program.cs',
 'tools/timed-stream.mjs','tools/build-timed.mjs','tools/build-timed-verifier.mjs','tools/verify-timed.mjs','tools/control-fixtures.mjs','tools/build-control.mjs','tools/channel-fixtures.mjs','tools/build-channel.mjs',
 'tools/VerifyTimed/VerifyTimed.csproj','tools/VerifyTimed/Program.cs'
];
const entries=[];for(const path of files){const b=await fs.readFile(ROOT+'/'+path);entries.push({path,bytes:b.length,sha256:hash(b),basis:'Project-authored code, specification or documentation; no extracted assets'});}
const manifest=JSON.stringify({schema:1,scope:'Source-only development package; generated ROM/audio/private inputs excluded',files:entries},null,2)+'\n',target=ROOT+'/export-manifest.json';
if(process.argv.includes('--check'))check(await fs.readFile(target,'utf8')===manifest,'Export manifest is stale');else await fs.writeFile(target,manifest);
console.log(JSON.stringify({files:files.length,manifest:target,checked:process.argv.includes('--check')}));
