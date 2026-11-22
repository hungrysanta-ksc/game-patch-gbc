# 개발 스킬과 적용 범위

2026-11-23 사용자 요청에 따라 GitHub 스킬을 조사하고 다음 두 스킬을 Codex 사용자 스킬 폴더에 설치했다. 공식 `skill-installer`의 설치 도구를 사용했고 커밋을 고정했다. 다음 대화 턴부터 스킬 목록에 반영된다. 현재 작업에서도 원문을 읽고 조사·계획에 반영했다. 스킬이나 부속 외부 코드를 이 게임 저장소에 복사하지 않는다.

| 스킬 | 고정 출처 | 적용 |
|---|---|---|
| `nes-reverse-engineering` | [MikeWuPing/nes-reverse-engineering](https://github.com/MikeWuPing/nes-reverse-engineering/tree/5baa80f85760baaeeacf2e08c6147833315d770a), MIT | 원작 주소·소비 코드에 근거한 데이터 등록, 6502 정수/캐리·상태 전이 보존, 추출/호스트/GBC 단계별 대조 |
| `gb-hardware-research` | [rmstdope/neser](https://github.com/rmstdope/neser/tree/d3ca0d6f6e51c54c7437914fe42a29ee141ab243/.github/skills/gb-hardware-research), MIT | Pan Docs 우선 조사, 사양과 에뮬레이터 구현 근거 구분, 뱅킹·VRAM·OAM·IRQ 위험 확인 |

기존 `create-kr-patch`는 한글 텍스트 소비 경로, 번역 입력 보호, 재현 빌드와 누락 없는 최종 검증을 계속 담당한다. 새 스킬 설치를 위해 기존 Mesen/emucap 연결이나 GBDK 버전을 바꾸지 않았다.

## 프로젝트 적용 규칙

- NES 스킬의 기본 추출 템플릿은 UxROM/16 KiB 가정이 있다. FF3는 MMC3/8 KiB 은행이므로 그대로 실행하지 않는다. 현재 FF3 주소 변환과 원작 소비 코드를 기준으로 한다.
- 스킬의 일반적인 RLE·메타스프라이트 예제는 FF3 포맷 명세가 아니다. 이번 레이아웃 256슬롯 검사는 FF3 `3E/CBFA` 실행과 직접 대조했다.
- 원작 기계어를 GBC에서 통째로 에뮬레이트하는 방향으로 바꾸지 않는다. 원작 코드 실행은 개발용 기준 도구이며 제품은 이식한 C/SM83 코드와 추출 데이터를 실행한다.
- 미구현 분기를 no-op으로 두는 예시는 채택하지 않는다. 프로젝트의 명시적 오류 정책이 우선한다. 도달하지 않는 코드도 간접 호출·이벤트 참조 확인 없이 제거하지 않는다.
- GB 스킬의 NESER 전용 캡처 승인 절차·로컬 경로·타이밍 구현 가정은 이 프로젝트에 자동 적용하지 않는다. 현재는 Mesen 검증을 유지하고, 사양 불명확/실기 차이 조사에서만 독립 에뮬레이터·하드웨어 관측을 추가한다. 특정 에뮬레이터와 일치한다는 사실을 실기 합격으로 바꾸지 않는다.
- GBDK 문서는 최신판과 고정 4.5.0이 다를 수 있다. 뱅킹 설계는 공식 문서를 참고하되 ABI와 생성 기계어는 현재 고정 도구에서 확인한다.

## 조사 후 설치하지 않은 후보

- [Gearboy skills](https://github.com/drhelius/Gearboy/tree/master/skills): SM83 디버깅에 유용하지만 Gearboy MCP를 요구한다. 현재 연결된 Mesen/emucap 경로가 있어 이번 작업에서 추가하지 않았다.
- [mesence-claude-plugin](https://github.com/sadnescity/mesence-claude-plugin): NES 조사 절차는 참고 후보지만 다른 도구 API를 사용한다. 동일한 Mesen 이름만 보고 현재 emucap에 명령을 그대로 적용하지 않는다.
- [retro-game-mechanics](https://github.com/YinsenWANG/retro-game-mechanics): 원작 분석 보고서 중심이며 이식 구현 순서를 제공하는 스킬은 아니다. 현재 원작 분석 자료와 기존 스킬로 필요한 역할을 충족한다.
- 웹 포팅 전용 스킬이나 특정 다른 GBDK 게임의 `make test` 래퍼는 이번 CGB 대상·프로젝트 구조에 직접 맞지 않아 설치하지 않았다.

## 재설치

스킬이 필요한 개발 환경에서 공식 `skill-installer/scripts/install-skill-from-github.py`에 다음 인자를 사용한다. 사용자 스킬 폴더에 이미 설치돼 있으면 덮어쓰지 말고 버전부터 확인한다.

```text
--repo MikeWuPing/nes-reverse-engineering --ref 5baa80f85760baaeeacf2e08c6147833315d770a --path . --name nes-reverse-engineering
--repo rmstdope/neser --ref d3ca0d6f6e51c54c7437914fe42a29ee141ab243 --path .github/skills/gb-hardware-research
```

이 스킬들이 없어도 사용자 배포 빌더는 실행돼야 한다. 분석자의 스킬·네트워크·비공개 참고 자료를 최종 ROM 빌드의 숨은 의존성으로 만들지 않는다.
