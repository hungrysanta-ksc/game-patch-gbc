# 해리 포터와 마법사의 돌 GBC 한글 패치

[전체 GBC 패치 목록](https://github.com/hungrysanta-ksc/game-patch-gbc) · [유지보수 소스와 빌드 안내](https://github.com/hungrysanta-ksc/game-patch-gbc/tree/main/games/harry-potter-sorcerers-stone/maintenance)

공개 버전 **1.0.0** / 내부 빌드 **v027**

게임보이 컬러용 **Harry Potter and the Sorcerer's Stone**의 비공식 한국어 번역 패치입니다. 사용자 검수와 누적 플레이 교정을 반영한 첫 정식 배포판입니다.

## 다운로드

[1.0.0 릴리즈](https://github.com/hungrysanta-ksc/game-patch-gbc/releases/tag/hp-ss-gbc-v1.0.0)에서 ZIP을 받으세요. **BPS 한 종류만 배포합니다.** 치트 메뉴가 함께 들어 있으며, 치트를 실행하지 않아도 일반 플레이가 가능합니다.

## 추가 기능

- 다국어 선택을 제거하고 한국어로 고정했습니다. (용량확보)
- 필드에서 B를 누른 채 이동하면 두 배 속도로 달립니다.
- START 메뉴에서 레벨·체력(SP)·마력(MP)을 확인할 수 있습니다.
- 메뉴와 전투가 마지막 커서 위치를 기억합니다.
- 전투 중 대기 시간과 일부 연출을 수정해 속도를 개선했습니다.
- 필드에서 획득할 수 있는 아이템이 화살표로 표시합니다.
- 치트 기능을 추가했습니다.

## 치트 메뉴

필드에서 **START + SELECT**를 함께 누르면 치트 메뉴가 열립니다.

- 경험치 3배: 켜기/끄기
- 시클 3배: 켜기/끄기
- 주문 전체 습득
- 카드 전체 습득

옵션과 습득 결과는 게임 내 저장에 반영되므로 먼저 세이브를 백업하세요.

## 설치와 세이브

1. 수정하지 않은 지원 버전의 원본 ROM과 기존 세이브를 백업합니다.
2. [INSTALL.md](INSTALL.md)의 크기·SHA-256을 확인합니다.
3. Floating IPS의 Apply Patch로 BPS를 원본에 적용합니다.
4. 결과 ROM을 새로 실행하고 게임 내 이어하기로 저장 파일을 불러옵니다.

ROM 파일은 동봉하지 않습니다. 기존 한글판에 덧씌우지 마세요. 강제 저장 상태 대신 게임 내 저장 파일을 사용하세요.

## 화면과 변경 이력

[릴리즈 스크린샷](https://github.com/hungrysanta-ksc/game-patch-gbc/releases/tag/hp-ss-gbc-v1.0.0) · [변경 내역](CHANGELOG.md) · [기술 문서](https://github.com/hungrysanta-ksc/game-patch-gbc/tree/main/games/harry-potter-sorcerers-stone/maintenance/docs)

## 오류 제보

[Issues](https://github.com/hungrysanta-ksc/game-patch-gbc/issues)에 게임 이름, 패치 버전, 실행 환경, 장소와 재현 순서, 기대 결과와 실제 결과를 적어 주세요. 가능하면 화면과 결과 ROM의 SHA-256도 알려 주세요. 공개 게시물에는 ROM, 전체 대사 파일, 세이브 파일을 첨부하지 마세요.

## 이용 및 크레딧

무료 비상업적 팬 프로젝트입니다. 패치 판매·유료 배포 또는 패치된 ROM·카트리지와 묶은 판매에 사용하지 말아 주세요. 소개할 때에는 저장소나 릴리즈 링크를 공유해 주세요.

게임 및 해리 포터 관련 저작물·상표의 권리는 각 권리자에게 있습니다. 관련 권리자와 제휴하거나 후원·승인을 받은 제품이 아닙니다. 권리 관련 요청이나 기술적 문제를 확인하면 수정 또는 배포 중단 등 필요한 조치를 취하겠습니다.

- 작업·배포·문의: [hungrysanta-ksc](https://github.com/hungrysanta-ksc)
- 화면 표시 글꼴: **7x7 yamche 변형 [작자미상]**
- 패치 적용: [Floating IPS](https://github.com/Sir-Walrus/Flips)
- 출처 및 적용 범위: [제3자 고지](THIRD-PARTY-NOTICES.md)
