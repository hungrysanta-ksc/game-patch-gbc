# Final Fantasy III — 원작 데이터 기반 한글 GBC 이식

NES 일본판 FF3의 게임 규칙과 데이터를 유지하면서 GBC용 실행 코드와 한글 표시 계층을 만드는 개발 프로젝트입니다. 최종 목표는 **사용자가 제공한 원본 ROM을 분석·추출·변환하고 GBC 코드와 다시 컴파일/링크하는 배포 패키지**입니다.

현재 작업 순서는 [전체 구현 로드맵](docs/implementation-roadmap.md)을 따릅니다. 공통 기능을 의존 순서대로 이식하며 대표 구간을 수시로 연결하고, 전체 데이터는 일괄 검사합니다. 지역마다 별도 구현을 쌓거나 모든 시스템의 통합을 마지막까지 미루지 않습니다. [개발 스킬과 적용 범위](docs/development-skills.md), [PR 작업 규칙](AGENTS.md)

현재 공개 단계는 **원작 사운드 엔진과 필드 이벤트의 통합 검증**입니다. 완성 게임이나 한글 패치 릴리스가 아닙니다. 앞서 만든 화면·던전·임의 전투 샘플은 표현 가능성 확인용이며, 새 게임 규칙의 기반으로 채택하지 않습니다. [전체 이식 계획](docs/port-plan.md)

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

직접 작성한 코드·명세·검사 도구·문서와 파일 해시만 관리합니다. 원본 ROM, 생성 ROM, 추출한 음악/그래픽/텍스트, 녹음 WAV, 메모리 덤프, 기존 폰트 원본은 업로드하지 않습니다. 제공받은 일본어·한국어 자료도 원본·대응표·파생 텍스트를 모두 비공개 로컬에 보관합니다. [번역 입력 관리](docs/localization-inputs.md), [출처 및 고지](THIRD-PARTY-NOTICES.md), `export-manifest.json`을 참고하세요.
