# Final Fantasy III — 원작 데이터 기반 한글 GBC 이식

[현재 타일 재사용과 행 합성](docs/battle-freeze-cell-cache.md)으로 셀 합성 구간은 **442ms→370ms**, 초기 최대 간격은 **1.22초→1.16초**, 같은 마법 전체는 **2.61초→2.58초**로 줄였습니다. 합성 중 실제 VRAM 타일만 잠시 재사용하고 도트·숫자·원작 대기·오디오를 유지합니다. 초기 이후 최장 간격 약 100ms는 그대로이며, 다음 그림 선행 준비는 현재 표시 상태와 소리 요청의 소유권을 분리해 별도로 검증할 과제입니다. 아래는 이전 단계 기록입니다.

[배경 정본 재사용·지도 보존 개선](docs/battle-freeze-resources.md)으로 같은 마법의 초기 최대 간격을 **1.44초→1.22초**, 전체 행동을 **2.80초→2.61초**로 줄였습니다. 변하지 않는 패턴은 ROM에서 직접 공급하고 서로 다른 지도는 필요한 구간을 보존·복구합니다. 다만 초기 이후 최장 간격은 84ms→100ms로 늘었습니다. 다음은 남은 아군 셀 합성과 유지 프레임 중 준비 분산이며 원작 속도 달성은 아직 아닙니다.

[일반 마법의 상주 자원](docs/battle-magic-residency.md)을 원작의 한 번 적재→그림·대상별 재사용→복구 수명에 맞췄습니다. 같은 밀집 마법을 5.54초→2.80초로 줄이고, 초기 준비 이후 최대 게시 간격을 368ms→84ms로 줄였습니다. 원작 도트·숫자·대기 수와 음악·효과음을 보존합니다. 초기 준비 약 1.44초는 아직 길어 정상 사용 경로 승격을 보류합니다. 아군 시전/발사·반사·특수 마법/소환 및 정상 전투 통합도 남아 있습니다.

[원작 아이템 창·가로 스크롤·대상 선택](docs/battle-item-window.md)을 V6 화면과 정본 가방에 연결했습니다. 선택한 긴 이름만 흐르게 표시하며 전투 한글 공백은 8→3픽셀로 줄였습니다. 원작 사용 가능성·대상·예약/취소를 대조합니다. [전투 중 장비 교환·능력치 갱신](docs/battle-equipment.md)을 연결해 직업 제한과 양손/수량 규칙을 적용합니다. [진열 선택·예약](docs/battle-row.md)의 원본 화살표·취소·HP 행동명을 기존 수집기에 연결했습니다. 확인 때는 열을 바꾸지 않으며, 실제 이동/행동 실행과 물리 전후열 피해 계산은 다음 단계입니다. 하단 창은 크기와 커서를 유지하며 글자/HP 위 여백을 1px 늘렸습니다. 실제 효과 계산과 직업별 특수 명령은 후속 소비자입니다.

[네 명의 원작 명령 수집과 HP 행동명](docs/battle-party-commands.md)을 V6 화면에 연결했습니다. 공격/막기/도주 예약, B로 이전 아군 복귀, HP 오른쪽 행동명/최대 HP 복구를 원작 코드와 실제 NES 화면에 맞춰 검사합니다. 네 명의 예약 완료에서 멈추는 진단이며 마법 하위 메뉴와 실제 행동 실행은 다음 범위입니다. 글꼴 재선정과 음질 개선은 후순위를 유지합니다.

[원작 전투 HP·상태 아이콘·하단 행동 창 연결](docs/battle-action-flow.md)을 추가했습니다. 원작 프레임/팔레트와 승인된 작은 HP 숫자를 사용하며, 한 행동의 숫자·메시지 대기·창 복원·다음 선택 준비를 자동 실행합니다. 현재는 네 가지 표시 경계 진단이며 정상 전투 실행기는 아직 아닙니다.

NES 일본판 FF3의 게임 규칙과 데이터를 유지하면서 GBC용 실행 코드와 한글 표시 계층을 만드는 개발 프로젝트입니다. 최종 목표는 **사용자가 제공한 원본 ROM을 분석·추출·변환하고 GBC 코드와 다시 컴파일/링크하는 배포 패키지**입니다.

후속 [원작 피해·회복 숫자](docs/battle-numbers.md)는 기존 전투 장면의 대상별 표시와 삭제·복원 경로에 연결했습니다. 편성 3의 적 8명 동시 네 자리 숫자는 숫자 32개와 배경·아군 잔여 8개로 분리해 모든 픽셀을 보존하면서 OBJ 40개/줄당 최대 8개에 맞췄습니다. 후속으로 정면/백어택의 적·아군 숫자를 원작 32프레임 시간표에 따라 자동 재생합니다. 배경·도트는 고정하고 OAM만 교체하며, 같은 그림의 프레임과 마지막 삭제도 보존합니다. 한글 창·오디오 공존을 같은 GBC 경로로 검사합니다. 초기 준비 비용, 실제 행동 호출자와 나머지 전체 전투 계약은 별도 미해결 범위입니다.

현재 작업 순서는 [전체 구현 로드맵](docs/implementation-roadmap.md)을 따릅니다. 공통 기능을 의존 순서대로 이식하며 대표 구간을 수시로 연결하고, 전체 데이터는 일괄 검사합니다. 지역마다 별도 구현을 쌓거나 모든 시스템의 통합을 마지막까지 미루지 않습니다. [개발 스킬과 적용 범위](docs/development-skills.md), [PR 작업 규칙](AGENTS.md)

최근 [적 등장·아군 상태·아이템 표시 수명](docs/battle-transitions.md)을 원작 코드로 검사한 뒤, [같은 전투 상태의 GBC 합성·전송](docs/battle-scene-composition.md)에 연결했습니다. 일반/백어택의 등장·석화/개구리 해제·아이템 효과를 같은 그림 상태로 공급하고, VRAM 은행을 번갈아 써 다음 그림을 준비합니다. 사용자 요청으로 적은 기본 8픽셀 뒤로 옮기며 그림과 효과 기준점을 함께 이동합니다. 실제 한글 창 복원·오디오 공존을 검사하지만 정상 전투 로직, HP/행동 메시지와 전체 장면의 원작 속도는 아직 미완료입니다.

[PR 15 회고](docs/retrospective-pr15.md)와 [전체 진척표](docs/progress.md)를 반영했습니다. 현재는 **기반 검증·부분 탐색 통합** 단계이며 첫 정상 진행은 아직 미완료입니다. [메모리 수명·은행 접근](docs/memory-lifetimes.md)으로 탐색 고정 WRAM 여유를 54→484바이트로 늘렸고, [NPC 색 보존 후보](docs/npc-composition.md)로 정지 실패 637개를 표시 예산 안에 넣었습니다. 이어 [실제 GBC 타일 합성](docs/composition-kernel.md)과 [128슬롯 캐시·전체 화면 전환](docs/composition-cache.md)을 원작 22개 진단 상태에 연결했습니다. 44장·1,013,760픽셀 일치와 음악/효과음 연속성을 확인했지만, 같은 맵 변화에도 중앙값 251ms가 걸려 기존 이동 실행기를 대체하지 않습니다. 후속으로 [원작 표시 입력·월드 타일 변경 판정](docs/composition-input.md)을 추가했습니다. 원작 300상태와 GBC 변경 마스크를 대조하고 음악·효과음 연속성을 검증했습니다. 판정만으로 중앙값 25.879ms·최대 169.922ms이며 아직 합성·전송까지 연결하지 않았습니다. 이어서 [네 원작 팔레트·월드 타일·한글 창 공존](docs/composition-window.md)을 대표 12상태에 연결해 실제 GBC 화면과 창 복구를 검증했습니다. 캐시 검색과 은행 복사 비용 때문에 아직 정상 이동용 실행기는 아니며, 실시간 입력 연결과 전체 응답 개선이 남아 있습니다. [전투 표시 소비자·공존 예산](docs/battle-display-budget.md) 조사로 보스 206 초기 타일을 해명하고 마법 1,740조건의 원작 OAM/8×16 변환을 대조했습니다. 아군+마법은 최대 34개지만 적 색 보존용 보조 OBJ까지 더한 예약에서 168/251조합이 줄 제한을 넘으므로 R2는 아직 열려 있습니다. 이어 [전투 그림 합성·실제 GBC 부하](docs/battle-composition.md)에서 원본 크기 아군·적·큰 마법을 최대 11 OBJ/한 줄 3개로 표시하고, 20장·460,800픽셀과 한글·오디오 연속성을 검증했습니다. PR 24의 빈 아군 자세 초기화도 정정했습니다. 상주 타일/연속 전송으로 스크립트 내부 그림 변경 최대를 653.4→117.3ms로 줄였지만 원작 66.6ms 간격은 미달입니다. 후속 [원작 마법 표시 시계](docs/battle-timeline.md)에서 선행 준비와 게시를 분리했습니다. 84회 자동 재생/588엔트리와 마지막 효과 지우기를 검증했고, 첫 가능한 VBlank 게시 및 오디오 연속성을 유지했습니다. 실제 게시 오차는 최대 2.904ms였습니다. 후속 [편성·효과 위치와 공급 예산](docs/battle-placement.md)에서 1,024개 수량 끝점 중 710개 배치를 대조하고 314개를 미해결로 기록했습니다. 대표 8편성·197상태 중 현재 합성기의 60상태가 OBJ 한도로 실패했습니다. 첨부 영상에 따라 [전투 전체 표시 계약](docs/battle-scene-contract.md)을 먼저 등록했습니다. 원작 155분기 슬롯/6행동 스크립트, 겹친 메시지 창 복원과 전체 피해 숫자 32프레임을 검사했습니다. 다음은 등장부터 명령·행동·숫자·메시지·종료/복귀까지의 동시 자산과 교체 수명을 함께 측정합니다. 8개 통합 시나리오는 아직 미통과이며 개별 편성 실패는 그 회귀 입력으로 유지합니다. 일반 마법·소환·아군 물리 공격의 대상/위치 기준 및 남은 시전 조건도 등록했습니다. 유한 그림의 진단이며 정상 전투 실행기는 아직 아닙니다. 적 색·보스·대형 마법 예산까지 확인한 뒤 공유 규칙·전투 계산으로 넘어갑니다. [노이즈 원인과 변환 방식 비교](docs/audio-backlog.md)는 사용자 요청에 따라 후순위로 유지합니다. 아래 기능별 소개와 측정값은 해당 PR 당시의 기록이며 앞으로의 순서는 로드맵을 따릅니다.

현재 공개 단계는 **원작 사운드·공통 상태 기반과 일반맵 이동·NPC 한글 대화 연결 검증**입니다. 완성 게임이나 한글 패치 릴리스가 아닙니다. 앞서 만든 화면·던전·임의 전투 샘플은 표현 가능성 확인용이며, 새 게임 규칙의 기반으로 채택하지 않습니다. [전체 이식 계획](docs/port-plan.md)

원작 새 게임 초기화, 필드/전투 난수, 3개 저장 슬롯과 체크섬을 C로 옮겼습니다. GBC에서 133,114개 원작 비교, 저장 파일을 통한 재시작 복원, 손상 거부를 확인했습니다. 이름 입력·저장 메뉴·정상 전투 진입은 이후 연결합니다. [초기 상태·난수·저장 계약과 재현 명령](docs/state-save-rng.md)

일반맵 전체를 대상으로 하는 [자산 공급·배경 표시 검사](docs/map-assets.md)도 추가했습니다. 같은 로더에서 768개 선택 조합을 표시하며, `build/maps/ff3-map-viewer.gbc`에서 A/B로 맵, SELECT로 선택 조합, 방향키로 검사 카메라를 바꿀 수 있습니다. 실제 플레이어 이동·NPC·이벤트 실행과는 구분합니다.

[NPC 배치·그림·정적 포즈 검사](docs/field-objects.md)는 원작 표시 플래그와 초기화 함수를 맵 로더에 연결합니다. `build/objects/ff3-object-viewer.gbc`에서 같은 조작과 START 포즈 전환을 사용할 수 있습니다. 이동/대화는 후속 범위이며, 진단용 밀집 상태에서 발견한 OAM/스캔라인 한계도 문서에 남겼습니다.

[원작 문자열·한글 창](docs/text-window.md)은 원작 포인터/제어 코드를 분석하고 검수된 비공개 번역을 승인된 7×7 폰트로 맵/NPC 위에 표시합니다. `npm run build:text`로 `build/text/ff3-text-viewer.gbc`를 만듭니다. A는 다음 페이지/닫기/재열기, B는 닫기, 좌우는 검수 대사 선택입니다. `local.json.text`에 비공개 글꼴·번역·대응 파일이 필요합니다.

[NPC 조건·대사 선택·이름/아이템/금액 치환](docs/npc-dialogue.md)을 후속 진단 ROM에 연결했습니다. `local.json.dialogue`의 검수된 비공개 입력으로 `npm run build:dialogue`를 실행하면 `build/dialogue/ff3-dialogue-viewer.gbc`가 생성됩니다. A/B는 NPC 대화/페이지 확인, START는 검사 플래그 전환, SELECT는 치환 예시입니다. 일반 NPC 448개의 조건을 원작 코드와 대조하며, 검수된 두 분기는 실제 이벤트와 문자열 ID를 거쳐 한글 창으로 이어집니다. 미구현 이벤트는 실행 전에 거부합니다. 정상 이동·접근 판정, 선택지, 한글 이름 입력/저장은 다음 범위입니다.

[대사창 갱신과 원작 사운드의 동시 부하 검사](docs/dialogue-audio.md)를 추가했습니다. `npm run build:dialogue-audio`로 `build/dialogue-audio/ff3-dialogue-audio.gbc`를 만듭니다. LCD를 켜 둔 채 한글 글꼴과 창을 VBlank DMA로 갱신하고, 같은 원작 음악·효과음·페이드 순서를 창 부하 유무로 비교합니다. A/B·START·SELECT 조작은 NPC 진단 ROM과 같습니다. 원작 악보/효과음을 직접 해석하며 새 녹음은 만들지 않습니다.

후속 최적화로 창 전송/준비의 최악 시간이 155프레임(약 2.6초)에서 13프레임(약 0.218초)으로 줄었습니다. 문자열 처리와 입력 대기까지 포함한 응답은 중앙값 385.3ms, 최대 653.3ms였으며, 음악·효과음 지연과 큐 부족은 0건입니다. 측정 범위와 재현 절차는 [대사창·사운드 검증 기록](docs/dialogue-audio.md)을 참고하세요.

[플레이어 이동·방향·접근과 대화 복귀](docs/exploration.md)를 원작 일반맵에 연결했습니다. `npm run build:exploration`으로 `build/exploration/ff3-exploration.gbc`를 만듭니다. 방향키로 이동하고 NPC 앞에서 A로 대화하며, 대화 중 A/B로 확인하면 탐색으로 돌아옵니다. 원본 크기 플레이어, 카메라 스크롤, 한글 창과 원작 음악이 함께 동작합니다. 맵 29의 개발 진입이며 [일반 NPC 자율 이동·애니메이션](docs/npc-motion.md)도 연결했습니다. [이벤트 NPC 이동·대기·반복](docs/event-motion.md)은 맵 10의 원본 이벤트 118에 연결했습니다. `npm run build:event-motion`으로 별도의 `build/exploration-event/ff3-exploration.gbc`를 만들며, 앞의 NPC에게 A로 말을 걸어 확인합니다. 동행 NPC, 출입구·보물상자·전투는 후속 소비자입니다.

이동 화면은 비동기 배경/OAM 제출에 이어 오디오 생산의 반복 조회·상태 복사를 최적화했습니다. 이동 중 실제 갱신 간격은 최대 83.7→50.4ms, 95백분위 50.2→33.5ms로 줄었습니다. 준비부터 실제 스크롤 반영까지 최대 32.8ms이며, 원작 코드 비교 4,288건과 음악·효과음·페이드 동시 검증을 통과했습니다. 아직 60fps 고정 갱신은 아닙니다. 측정 범위와 남은 성능 과제는 [이동 검증 기록](docs/exploration.md)에 구분해 두었습니다.

청취 결과에서 잡음과 음색 차이가 지적되어, 사용자 결정에 따라 **음색 조정은 보류하고 원작 로직 이식을 진행**합니다. [보류 기록](docs/audio-backlog.md)

첫 통합 구간으로 **제단 동굴 맵 `$16`의 바위 통로 이벤트 `$71`**을 연결했습니다. 원본 맵·지형·팔레트·이벤트·악보로 BGM, 효과음, 화면 흔들림, 통로 변경을 실행합니다. 약 60초에 여섯 번 재로딩하는 검사에서 오디오 지연/큐 고갈 0, 원작 상태 및 실제 GBC VRAM 대조 통과를 확인했습니다. 선택된 이벤트 진입점의 검사이며 플레이어 이동이나 NPC 조건 선택까지 구현한 전체 플레이스루는 아닙니다. [구현·부하 결과·범위](docs/field-audio.md)

```powershell
node tools/build-native.mjs --scene --rom "D:/private/Final Fantasy III (Japan).nes" --gbdk "D:/tools/gbdk"
node tools/build-native-verifier.mjs
node tools/verify-native.mjs --scene
```

출력은 **`build/scene/ff3-field-audio.gbc` (256 KiB)**입니다. 자동으로 실행되며 START는 개발용 검사를 재시작합니다. 검증기는 `local.json`의 MesenCore/.NET 경로를 사용합니다. 생성 ROM과 추출 데이터는 로컬에만 남습니다.

현재 **음악 요청·이전 곡 복귀·템포·페이드·음표·반복·엔벌로프·효과음 제어**를 C로 옮기고 실제 GBC 음원 출력에 연결했습니다. 원작 악보를 GBC에서 직접 해석하며, 원본 반환 상태를 재생하는 콜백이나 미리 만든 APU 이벤트 파일을 재생 경로에서 사용하지 않습니다. [네이티브 엔진과 검증](docs/audio-native.md)

```powershell
node tools/build-native.mjs --rom "D:/private/Final Fantasy III (Japan).nes" --gbdk "D:/tools/gbdk"
```

출력은 **`build/native/ff3-native-audio.gbc` (256 KiB)**입니다. 좌우로 ID 선택, A 요청, B 정지, SELECT로 음악/효과음 전환, 위로 페이드아웃, 아래로 이전 곡 복귀, START로 자동 비교용 요청 순서를 실행합니다. 새 곡의 페이드인은 자동 비교와 엔진 API에 포함됩니다. 개발용 영문 메뉴이며 게임용 한글 UI가 아닙니다. 음색 근사 조정은 보류 상태입니다.

현재 엔진 검사와 과거 단계별 검사는 다음 명령으로 생성합니다.

```powershell
node tools/build-control.mjs --rom "D:/private/Final Fantasy III (Japan).nes" --gbdk "D:/tools/gbdk"
node tools/build-channel.mjs --rom "D:/private/Final Fantasy III (Japan).nes" --gbdk "D:/tools/gbdk"
node tools/build-engine.mjs --rom "D:/private/Final Fantasy III (Japan).nes" --gbdk "D:/tools/gbdk"
```

`build/engine/ff3-engine-test.gbc`는 완전한 C 엔진을 원본 실행과 틱별로 대조하는 무음 검사 ROM입니다. `build/control/`과 `build/channel/`은 이전 단계의 함수 경계/단위 검사입니다. 전체 게임이나 실기 성능 검증을 의미하지 않습니다.

`local.json`에 MesenCore와 .NET 경로를 설정한 후 다음 명령으로 상태와 실제 음원 레지스터를 비교할 수 있습니다. 녹음하지 않습니다.

```powershell
node tools/build-native-verifier.mjs
node tools/verify-native.mjs --engine
node tools/verify-native.mjs --engine --negative
node tools/verify-native.mjs
```

추가로 제공된 **VGZ 59개를 새 녹음 없이 GBC용 사운드 테스트 ROM으로 변환**했습니다. 4096 Hz 타이머와 사전 계산 버퍼로 재생하며, 49개 반복곡과 10개 종료곡을 처리합니다. [타이밍 재생 구현과 검증 범위](docs/timed-audio.md), [이전 입력 조사](docs/vgz-assessment.md)를 참고하세요. 이 VGZ 경로는 개발용 검증 입력이며, 최종 배포물의 원본 NES ROM 입력 계약은 유지합니다.

## VGZ 전체 곡 테스트

```powershell
node tools/build-timed.mjs --dir "D:/private/ff3-vgz" --gbdk "D:/tools/gbdk"
```

출력은 `build/timed/ff3-vgz-timed.gbc`입니다. 정지 상태에서 좌우로 곡 선택, A 재생, B 정지, SELECT로 DAC 타격음 근사 후보를 켜고 끕니다. 조작·번호 표시용 영문 개발 화면이며 게임용 한글 UI를 대체하지 않습니다.

아래 검사는 `local.json`의 MesenCore와 .NET 경로를 사용하며 **녹음하지 않습니다**. 소스 이벤트 상태, 루프/종료, 버퍼, 타이머를 대조합니다. 음색의 동일성이나 실기·게임 통합 성능을 보증하는 검사는 아닙니다.

```powershell
node tools/build-timed-verifier.mjs
node tools/verify-timed.mjs
node tools/verify-timed.mjs --track 3 --loops 2
```

## 기존 원본 ROM 입력 실험

- 원본 음악 65개 / 효과음 97개 슬롯의 헤더 목록 생성.
- 원본 ROM의 6502 사운드 드라이버를 빌드 시 실행해 APU 이벤트 추출. 악보를 새로 입력하지 않습니다.
- 동굴, 일반 전투, 승리, 효과음 4종, 전투+효과음, 보스, 최종 전투의 **7개 유한 구간(12–24초)**을 GBC 4채널 재생 데이터로 변환.
- 128 KiB GBC 전용 사운드 테스트 ROM 생성. 방향키로 선택, A 재생, B 정지, SELECT로 DMC 근사 타격음 설정 전환.
- NES 원본 드라이버 검증 ROM과 GBC ROM을 Mesen으로 각각 녹음하고, 메모리 상태를 대조한 뒤 로컬 A/B 청취 페이지 생성.

NES 비교 음원은 원본 사운드 드라이버·곡 데이터를 유지한 별도 검증 ROM에서 나옵니다. 게임을 실제 플레이하며 녹음한 음원은 아닙니다. 이 초기 경로는 유한 구간 비교를 보존합니다. VGZ 전체 곡 반복은 위의 별도 테스트에서 구현했으며, 현재 네이티브 경로에서 원작 음악 명령 해석기와 첫 필드 이벤트의 화면/사운드 호출을 연결했습니다.

## 로컬 빌드

Windows, Node.js 20 이상, [GBDK 4.5.0](https://github.com/gbdk-2020/gbdk-2020/releases/tag/4.5.0)이 필요합니다. 원본과 컴파일러의 허용 해시는 `spec/source.json`, `spec/toolchain.json`에 고정되어 있습니다. 지원하지 않는 ROM은 빌드를 중단합니다.

이 폴더에서 실행합니다.

```powershell
node tools/build-audio.mjs --rom "D:/private/Final Fantasy III (Japan).nes" --gbdk "D:/tools/gbdk"
```

출력: `build/audio/ff3-audio.gbc`, `report.json`, `catalog.json`, 원작 비교용 NES ROM과 비공개 중간 데이터. 빌드는 네트워크 접속이나 기존 추출물을 요구하지 않습니다. 생성 ROM은 로컬에서만 사용합니다.

반복 작업은 `local.example.json`을 `local.json`으로 복사하고 경로를 지정하면 편리합니다. `local.json`은 Git에서 제외됩니다.

```powershell
node --test tests/audio.test.mjs
```

이 명령은 CPU 연산/RLE 회귀 테스트와 **현재 입력 ROM에 대한** 전 슬롯 300틱 실행 및 원본 보호 영역 검사를 함께 수행합니다. 전체 곡 재생이나 청취 품질의 통과를 뜻하지 않습니다.

## 이전 녹음과 비교 청취 도구

아래는 첫 사운드 실험을 재현하는 별도 녹음 경로입니다. VGZ 타이밍 검증에는 실행하지 않으며 이번 작업에서도 새 녹음을 만들지 않았습니다.

추가로 .NET 8 SDK와 Windows x64 **MesenCore.dll / Mesen.dll 및 그 런타임 의존 파일**이 필요합니다. `local.json`의 `mesenCore`와 `dotnet`을 지정합니다. 검증에 사용한 빌드 정보는 [사운드 검증 기록](docs/audio-validation.md)에 기록합니다. 에뮬레이터의 C ABI는 공개 안정 API가 아니므로 다른 버전은 별도 확인이 필요합니다.

```powershell
node tools/build-capture.mjs
node tools/capture-audio.mjs
node tools/make-comparison.mjs
Start-Process ./evidence/audio/index.html
```

녹음은 에뮬레이터 내부 PCM 출력입니다. PC 스피커/마이크나 시스템 루프백을 녹음하지 않습니다. 각 콘솔은 별도 로컬 설정 폴더를 사용합니다. `--clip battle`로 한 구간을 재검사할 수 있지만 비교 페이지는 최종 빌드에 대한 7개 전체 검사 결과를 요구합니다.

청취 페이지에서 같은 위치로 A/B 전환, 평균 음량 보정 켜기/끄기, 처음 8초씩 이어 붙인 비교 WAV를 사용할 수 있습니다. 원본 녹음은 수정하지 않고 보정본을 별도로 만듭니다. 프레임 기준 녹음이며 샘플 단위 위상 일치를 보장하지 않습니다.

## 충실도와 남은 작업

원작 드라이버의 음표·템포·소프트웨어 엔벌로프·효과음 우선순위를 실행 결과에서 가져옵니다. GBC 하드웨어의 음색·노이즈·스윕과 음량 변경 때의 위상 재시작은 차이가 있습니다. NES `$4011` 직접 DAC 타격음은 짧은 CH4 노이즈로 근사하는 **비교 후보**이며 최종 채택하지 않았습니다. SELECT로 끌 수 있습니다. [변환 규칙과 근거](docs/audio-design.md)

전체 PRG 영역과 미해결 참조를 [데이터 등록부](docs/data-registry.md)에 정리했습니다. `node tools/register-data.mjs --rom "원본 ROM 경로"`로 로컬 보고서를 재생성할 수 있습니다. 일반 맵·월드 행·AI 로딩·조건 선택을 원작 코드와 대조했으며, 의미/도달성 미해결 항목은 별도로 유지합니다.

[은행·메모리·시간 기반](docs/platform-foundation.md)을 연결했습니다. 사운드 실행 코드를 교체 은행으로 옮기고, 데이터 접근 시 은행 복원과 메모리 보호를 검사합니다. 배터리 SRAM 헤더와 게임 상태 공간은 예약됐으며 저장 기능은 아직 구현하지 않았습니다. 다음은 원작 새 게임 초기값·공통 상태·RNG·저장 계약입니다. 이를 준비한 뒤 원작 NPC 조건·이동·장비·전투 계산을 연결합니다. [순서 재검토와 완료 조건](docs/implementation-roadmap.md)을 기준으로 진행하며 음색 조정은 보류 상태를 유지합니다.

## 저장소에 포함하는 범위

직접 작성한 코드·명세·검사 도구·문서와 파일 해시만 관리합니다. 원본 ROM, 생성 ROM, 추출한 음악/그래픽/텍스트, 녹음 WAV, 첨부 영상/추출 프레임, 메모리 덤프, 기존 폰트 원본은 업로드하지 않습니다. 제공받은 일본어·한국어 자료도 원본·대응표·파생 텍스트를 모두 비공개 로컬에 보관합니다. [번역 입력 관리](docs/localization-inputs.md), [출처 및 고지](THIRD-PARTY-NOTICES.md), `export-manifest.json`을 참고하세요.
