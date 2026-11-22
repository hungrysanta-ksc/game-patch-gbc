# Final Fantasy III — 원작 데이터 기반 한글 GBC 이식

NES 일본판 FF3의 게임 규칙과 데이터를 유지하면서 GBC용 실행 코드와 한글 표시 계층을 만드는 개발 프로젝트입니다. 최종 목표는 **사용자가 제공한 원본 ROM을 분석·추출·변환하고 GBC 코드와 다시 컴파일/링크하는 배포 패키지**입니다.

현재 공개 단계는 **원작 사운드 비교 실험**입니다. 완성 게임이나 한글 패치 릴리스가 아닙니다. 앞서 만든 화면·던전·임의 전투 샘플은 표현 가능성 확인용이며, 새 게임 규칙의 기반으로 채택하지 않습니다. [전체 이식 계획](docs/port-plan.md)

청취 결과에서 잡음과 음색 차이가 지적되어, 사용자 결정에 따라 **음색 조정은 보류하고 원작 로직 이식을 진행**합니다. [보류 기록](docs/audio-backlog.md)

현재 원작의 효과음 요청·정지·교체·채널 점유/해제·APU 출력 제어부를 C로 옮겼습니다. 음악 스크립트와 엔벌로프 본문은 다음 이식 대상입니다. [이식 범위와 원본 비교 검사](docs/audio-control.md)

```powershell
node tools/build-control.mjs --rom "D:/private/Final Fantasy III (Japan).nes" --gbdk "D:/tools/gbdk"
```

생성되는 `build/control/ff3-control-test.gbc`는 C 제어부를 원본 기준값과 비교하는 무음 자동 검사 ROM입니다. 청취용 플레이어나 완성 음악 엔진이 아닙니다.

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

NES 비교 음원은 원본 사운드 드라이버·곡 데이터를 유지한 별도 검증 ROM에서 나옵니다. 게임을 실제 플레이하며 녹음한 음원은 아닙니다. 이 초기 경로는 유한 구간 비교를 보존합니다. VGZ 전체 곡 반복은 위의 별도 테스트에서 구현했으며, 임의 시점 효과음 요청·실시간 원작 음악 명령 해석기·화면과 함께 실행하는 최종 엔진은 남아 있습니다.

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

다음 순서는 이 청취 결과를 바탕으로 출력 근사를 정리하고, 반복/분기와 임의 SFX 요청을 처리하는 GBC 음악 실행 계층으로 옮긴 뒤 한글 렌더링·맵 스크롤과 동시에 예산을 측정하는 것입니다. 그 후 원작 상태·이벤트·전투 로직 이식으로 진행합니다.

## 저장소에 포함하는 범위

직접 작성한 코드·명세·검사 도구·문서와 파일 해시만 관리합니다. 원본 ROM, 생성 ROM, 추출한 음악/그래픽/텍스트, 녹음 WAV, 메모리 덤프, 기존 폰트 원본은 업로드하지 않습니다. 제공받은 일본어·한국어 자료도 원본·대응표·파생 텍스트를 모두 비공개 로컬에 보관합니다. [번역 입력 관리](docs/localization-inputs.md), [출처 및 고지](THIRD-PARTY-NOTICES.md), `export-manifest.json`을 참고하세요.
