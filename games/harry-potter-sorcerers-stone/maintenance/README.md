# 마법사의 돌 1.0.0 유지보수 소스

이 폴더는 정식판 1.0.0(내부 v027)의 누적 런타임 소스와 빌드·검증 도구를 보관합니다. 기존 패치 ROM을 수정하는 방식 대신, 지원 원본과 승인 입력에서 전체 변경을 다시 만듭니다.

**공개 소스만으로는 번역판을 빌드할 수 없습니다.** ROM, 번역 원문/TSV와 문구 포함 런타임 명세, 선택한 폰트와 타이틀 판 자산은 별도 로컬 입력입니다. 필요한 상대 경로와 SHA-256은 [릴리즈 명세](config/release-v1.0.0.json)에 고정했습니다. 이 입력을 정당하게 보유한 유지보수자는 [BUILD.md](BUILD.md)대로 같은 ROM과 단일 BPS ZIP을 재현할 수 있습니다. 일반 사용자는 [설치 안내](../INSTALL.md)의 BPS를 적용하면 됩니다.

## 구성

| 경로 | 역할 |
|---|---|
| `src/text_codec.py`, `hangul_encoding.py` | 원본 Huffman·descriptor, 한글 인코딩 |
| `src/compact_runtime.py`, `runtime/*.asm` | 4 MiB 배치, 글리프·문자열·변수 런타임 |
| `src/menu_runtime.py`, `runtime/menu/*.asm` | 상태 패널과 커서 수명 |
| `src/battle_edition.py` | 한글판 타이틀, 전투 대기, 네 치트 |
| `src/event_pickups.py`, `forest_pickup_positions.py` | 실제 이벤트 조건과 검토한 조사 위치 |
| `src/house_scores.py` | 원본 점수표 보존과 제한된 저장값 복구 |
| `src/memory_layout.py`, `config/memory-layout-*.json` | 등록된 코드 내용·배치·뱅크별 RAM 검사 |
| `scripts/` | 원본 추출, 승인 입력 가져오기, 누적 ROM·릴리즈 빌드 |
| `tests/` | 코덱 경계와 메모리 회귀 |
| `research/` | CPU 디코더·점수·옛 메뉴 검사 및 두 코어 입력 재생 |
| `docs/` | 구조·버그·검증 범위·소스 공개 기록 |

- [구조](docs/architecture.md)
- [메모리 배치](docs/memory-map.md)
- [실제 버그와 회귀 조건](docs/bugs-and-regressions.md)
- [검증과 한계](docs/verification.md)
- [공개 입력/제외 목록](docs/source-export.md)
- [다른 게임에 적용할 작업 원칙](../../../guides/gbc-hp1-lessons.md)

코드의 기존 MIT 고지는 [LICENSE](LICENSE)에 보존합니다. 게임·폰트·스크린샷·번역의 권리를 이 코드 라이선스로 확대하지 않습니다.
