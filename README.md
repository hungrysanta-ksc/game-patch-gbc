# GBC 게임 한글 패치

게임보이 컬러(Game Boy Color) 게임의 비공식 한글 패치를 모아 배포하는 저장소입니다.

**패치 파일과 사용 안내만 제공합니다.** 게임 원본 ROM, 패치가 적용된 ROM, ROM 다운로드 링크는 제공하지 않습니다. 정품 게임을 보유하고 적법하게 준비한 지원 버전의 원본 파일이 필요합니다.

## 게임 목록

| 게임 | 공개 버전 | 다운로드 | 안내 |
|---|---|---|---|
| 해리 포터와 비밀의 방 | v0.8.1 · 사전 공개 | [일반판·디버그판](https://github.com/hungrysanta-ksc/game-patch-gbc/releases/tag/hp-cos-gbc-v0.8.1) | [소개](games/harry-potter-chamber-of-secrets/README.md) · [설치](games/harry-potter-chamber-of-secrets/INSTALL.md) |

## 다운로드와 설치

1. 위 목록에서 게임의 설치 안내를 확인합니다.
2. 지원 원본의 버전·크기·해시를 확인하고 ROM과 세이브를 백업합니다.
3. 해당 게임의 릴리스에서 패치 ZIP을 받습니다.
4. ZIP에 포함된 안내에 따라 패치를 적용합니다.

패치 형식, 적용 도구, 세이브 호환성, 알려진 문제는 게임별 문서에 안내합니다. 다른 게임이나 지원하지 않는 버전에는 패치를 적용하지 마세요.

## 저장소 구성

```text
README.md
games/
  harry-potter-chamber-of-secrets/
    README.md
    INSTALL.md
    THIRD-PARTY-NOTICES.md
    licenses/
```

게임별 안내와 고지는 `games/<게임 이름>/`에 모읍니다. 패치 ZIP은 [GitHub Releases](https://github.com/hungrysanta-ksc/game-patch-gbc/releases)에 게임별로 배포하며, 각 ZIP에 해당 게임의 안내와 고지를 함께 넣습니다.

## 버전 관리

공개 버전은 게임별로 독립적으로 관리하며, 내부 빌드 번호와 구분합니다. 릴리스 태그에는 게임 식별자를 포함합니다. 예: `hp-cos-gbc-v0.8.1`.

각 게임의 현재 버전과 향후 계획은 해당 게임의 소개 문서를 참고하세요.

## 오류 제보

[Issues](https://github.com/hungrysanta-ksc/game-patch-gbc/issues)에 **게임 이름, 패치 버전, 패치 종류, 실행 환경, 재현 순서**를 적어 주세요. 가능하면 문제가 보이는 화면도 함께 알려 주세요.

공개 게시물에 ROM, 게임 전체 대사, 세이브 파일을 첨부하지 마세요. ROM 입수처 문의는 받지 않습니다.

## 이용 및 공유 안내

패치는 무료로 제공하는 비상업적 팬 프로젝트입니다. 판매·유료 배포 또는 패치된 ROM이나 게임기·카트리지와 묶은 판매에 사용하지 말아 주세요. 다른 곳에 소개할 때에는 해당 게임의 소개 또는 릴리스 링크를 공유해 주세요.

게임과 관련 저작물·상표의 권리는 각 권리자에게 있습니다. 이 저장소의 패치는 관련 권리자와 제휴하거나 이들의 후원·승인을 받은 제품이 아닙니다. 게임별 출처와 제3자 고지는 각 게임 폴더에서 확인할 수 있습니다.

**기술적 문제나 권리 관련 문제 등으로 패치 배포가 언제든지 중단될 수 있습니다.** 권리 관련 요청은 내용을 확인하여 수정 또는 배포 중단 등 필요한 조치를 취하겠습니다.

배포·문의: [hungrysanta-ksc](https://github.com/hungrysanta-ksc)
