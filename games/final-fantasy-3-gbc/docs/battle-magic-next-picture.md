# 원작 대기 중 다음 마법 그림 준비

기준은 PR 93 병합 `6147e92b8268c26cff522070ed1ac0d3a4f96ab7`과
[현재 타일 합성](battle-freeze-cell-cache.md)이다. 기존 적→아군 일반 마법의
다음 그림 준비를 현재 그림의 유지 시간과 겹친다. 새로운 마법 종류나 정상
전투 계산·메뉴 통합의 완료로 세지 않는다.

## 원작과 현재/다음 그림의 소유권

원작 `33/B6F3`은 대상별 효과음을 요청한다. `B6FA → B711 → B7CF`는 다음
그림을 풀고 `B765..B797`에서 좌표·타일·속성을 OAM으로 옮긴다.
`B7A9..B7B4`는 같은 그림으로 네 번의 VBlank를 기다린다. 그림이 끝나면
`B70B..B70E`에서 지우고 한 번 기다린 뒤 `B6DD` 대상 순회를 계속한다.
`2F/B15E`의 적 시전 분기와 `B175`의 숫자 자원 복구는 그대로다.

이전 GBC 경로는 같은 그림의 세 번의 유지 대기를 끝내고 나서 다음 그림을
계산했다. 이번에는 현재 그림의 첫 게시 뒤 남은 세 대기에 다음 작업을 나눈다.

1. 다음 시퀀스 커서를 복사해서 다음 원작 OAM 160바이트를 계산한다.
2. 다음 원작 OAM을 비활성 GBC OAM 페이지의 좌표·타일쌍으로 변환한다.
3. 다음 페이지의 객체 수와 각 주사선 한도를 검증한다.

각 단계는 **현재 페이지의 게시를 먼저 요청하고** 실행한다. VBlank가 오면
현재 그림을 다시 표시할 수 있다. 준비 단계가 끝나도 원작 대기를 생략하지 않고,
네 번의 게시 경계 뒤에만 다음 원작 OAM·시퀀스·그림과 준비된 페이지를 확정한다.
한 단계가 VBlank보다 오래 걸리면 전체 간격은 여전히 늘어날 수 있다.

현재 `animation_source`는 네 대기 동안 그대로 유지한다. 다음 원작 OAM은
기존 `battle_workspace.map[144..303]`, 다음 GBC OAM은 비활성 shadow만 소유한다.
주사선 카운터 `[0..143]`, 남겨둘 아군 `[576..607]`, 타일쌍 표 `[608..625]`와
겹치지 않는다. 동결·자원 대여 완료 뒤 시작하고 복구 전에 수명을 끝낸다.
추가 WRAM 은행이나 미리 그린 프레임 자산을 사용하지 않는다.

예측 범위는 같은 대상의 다음 그림 또는 끝의 빈 그림까지다. 다음 대상으로
넘어가지 않으며 소리도 미리 요청하지 않는다. 대상 첫 그림·최초 자원 준비는
동기 경로로 남는다. 원작 네 번 대기와 대상별 소리 요청의 논리 순서는 보존하되,
실제 시간은 GBC 준비 비용을 포함하므로 원작 속도 달성과 구별한다.

## 비용과 해석

동일 35게시 마법의 전체 행동은 2,579.438ms→2,227.741ms(약 13.6% 감소),
초기 준비 이후 최장 게시 간격은 100.444ms→66.970ms다. 초기 준비 포함 최대
간격은 1,155.021ms→1,138.298ms이며, 원작 속도나 초기 준비 0.5초에 도달한
것은 아니다. 초기 자원 보존/복구는 계속 남아 있고 이번에는 그 알고리즘을 바꾸지 않았다.

현재 그림의 게시 요청과 다음 그림 계산이 겹치므로, 기존 비용 계측의
`party_pending` 구간에는 다음 그림의 일부 계산도 포함된다. `publish`와
`prepare` 분류만 비교해 계산이 사라졌다고 주장하지 않는다. 같은 원작 프레임 수,
실제 DMA 게시 간격, 전체 행동 시간과 오디오 완주를 함께 비교한다.

추가 고정 상태는 16바이트이며 WRAM 끝은 `$CF92`(경계까지 110바이트)다.
은행 65 코드 길이는 `$0EFC`다. 다음 원작 OAM 160바이트는 기존 scratch를
재사용하고 추가 OAM/WRAM 은행은 만들지 않는다.

## 검증 경계

최종 ROM `d1c78fae0a24af4664e90cdcfb22d5b4f7c11674335639f370ffed315f42a041`에서
940개 화면과 11회 × 7,200 = 79,200 오디오 틱을 통과했다. 원작 OAM·전체 픽셀,
효과음 요청과 원작 명령/변환 출력 해시를 대조했으며 오디오 부족·늦은 처리와
불법 VRAM/OAM 접근은 0이다. 선행 준비 140회의 560개 경계 검사에서 현재 그림
변경·조기 페이지 전환·대기 순서 오류·조기 효과음 요청은 없었다.

| 자동 재생 | 게시 수 | PR 93 전체 | 이번 전체 | 이번 초기 이후 최대 간격 |
| --- | ---: | ---: | ---: | ---: |
| 대표 마법 | 35 | 2,579.438ms | 2,227.741ms | 66.970ms |
| 최대 30쌍 마법 | 35 | 2,579.366ms | 2,261.079ms | 50.247ms |
| 아군 4명 대상 | 142 | 5,694.571ms | 4,170.391ms | 83.726ms |

전체 대상에서 약 84ms가 남으므로 대표 사례의 67ms를 모든 마법의 상한으로
보면 안 된다. 초기 포함 최대 간격도 최대 30쌍 사례에서는 1,155.021ms로 남는다.
양손 지팡이 회귀는 83게시/2,110.162ms·최대 간격 83.956ms로 사실상 같다.

캐시·지도·패턴 복구 13회와 상주 효과 풀 593회 검사, 호스트 테스트 10/10도
통과했다. 공개 소스 627개의 독립 재빌드에서 ROM 3개를 포함한 12개 산출물이
바이트 단위로 일치했다. 고정 MesenCore SHA-256은
`1ba99d2c848e007c60cbd7fceca058440758eb44837a93a6724d29d72723c994`다.

새 읽기 전용 `battle-magic-ahead-audit.mjs`는 준비 시작 때 현재 원작 OAM과
활성 shadow를 보관한다. 각 단계에서 둘 다 변하지 않았는지와 활성 페이지가
그대로인지 검사한다. 단계 2/3/4/확정 때 게시 수가 각각 0/1/2/3 증가했는지
확인하고 준비 중 새 효과음 요청을 금지한다. 준비 횟수는 실제 NES 실행에서
`B7AD`에 도달한 횟수를 4로 나눈 값과 대조한다.

기존 검증은 모든 원작 OAM 바이트·전체 화면 픽셀·요청 순서·오디오 소비 해시,
지도와 패턴 복구·VRAM/OAM 접근 한도를 계속 검사한다. 합격 범위는 기존
진단 소비자이며 아군 시전/발사·적 대상·반사·특수/소환·정상 전투는 별도다.
R2 0/8·제품 0/3은 유지하고 원본 ROM·번역·추출 자산·캡처는 공개하지 않는다.

재현은 다음 명령으로 수행한다. 전수 픽셀 캡처와 자동 재생 시간 측정은 같은
ROM에서 별도로 실행하며 둘 다 완전한 오디오 일정을 소비한다.

```text
node tools/build-battle-party-oam.mjs --effects
node --test tests/battle-animation.test.mjs tests/battle-magic-frames.test.mjs tests/battle-magic-video.test.mjs
node tools/verify-battle-magic.mjs
node tools/verify-battle-magic.mjs --back --status --skip-build
node tools/verify-battle-magic.mjs --flips --skip-build
node tools/verify-battle-magic.mjs --flips --back --status --skip-build
node tools/verify-battle-magic.mjs --auto --skip-build
node tools/verify-battle-magic.mjs --auto --case 1 --skip-build
node tools/verify-battle-magic.mjs --auto --case 2 --skip-build
node tools/verify-battle-effects.mjs
node tools/verify-battle-strike.mjs --numbers --skip-build
node tools/verify-battle-hit.mjs --numbers --back --skip-build
node tools/verify-battle-strike.mjs --auto --skip-build
```
