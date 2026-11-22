# 빌드와 재현

## 환경과 입력

제품 빌드에는 Python 3.12 표준 라이브러리와 외부 Floating IPS v198만 필요합니다. 원본·도구·비공개 입력의 지문이 다르면 출력을 거부합니다. CLI의 기본 작업 위치는 이 maintenance 폴더입니다.

1. [설치 안내](../INSTALL.md)에 해당하는 원본 ROM을 준비합니다.
2. `config/release-v1.0.0.json`의 `private_inputs`에 있는 다섯 입력을 같은 상대 경로로 준비합니다. 원본 TSV/번역 JSON, 폰트, 타이틀 판, 문구 override를 포함한 v027 명세입니다. 이 파일들은 공개 저장소에서 내려받을 수 없습니다.
3. [Floating IPS v198](https://github.com/Sir-Walrus/Flips/releases/tag/v198)의 Windows 실행 파일을 준비합니다. 검증한 실행 파일의 SHA-256은 명세에 있습니다.

권한 있는 로컬 입력 폴더에서 가져오려면 다음을 실행합니다. 다섯 파일을 먼저 모두 검사하고 다른 내용의 기존 입력을 덮어쓰지 않습니다.

```powershell
python scripts/install_private_inputs.py --from-directory 'D:/private/hp1'
python scripts/build_release.py --rom 'D:/games/original.gbc' --flips 'D:/tools/flips.exe'
```

`build_release.py`가 원본 추출 → 누적 ROM 빌드 → BPS 생성 → BPS 재적용 → 잘못된 원본/손상 패치 거부 → ZIP 검사를 순서대로 실행합니다. 기본 문서 경로는 상위 게임 폴더이며, ZIP에는 BPS 한 개와 사용 문서 네 개, 적용 검증 manifest가 들어갑니다. ZIP의 시간/파일 속성을 고정하여 같은 도구와 입력에서 재현성을 검사할 수 있습니다. ROM과 세이브는 ZIP에 넣지 않습니다.

출력:
- `out/runtime-v027/hp1-korean-runtime-v027.gbc` — 로컬 검증 전용
- `out/release-v1.0.0/hp-ss-gbc-v1.0.0.bps`
- `out/release-v1.0.0/hp-ss-gbc-v1.0.0.zip`
- `out/release-v1.0.0/verification.json`

## 개발 빌드

```powershell
$env:HP1_SOURCE_ROM='D:/games/original.gbc'
python scripts/extract_source.py
python scripts/build_runtime.py --spec config/runtime-v027.json
python -m unittest discover -s tests -v
```

원본 경로 환경 변수가 없으면 `roms/`와 source profile의 파일명을 사용합니다. 다른 게임의 폴더나 사용자 홈 경로를 요구하지 않습니다.

`import_approved_translation.py`는 정확한 승인 TSV의 지문, ID, 보호 원문과 제어 토큰을 검사하여 로컬 translation.json을 재생성합니다. 입력의 번역 문구를 고치거나 자동 승인하지 않습니다. 새 번역/프로필을 채택할 때에는 고정된 1.0.0 명세를 덮어쓰지 말고 새 버전 명세와 QA 근거를 만드세요.

## 검사 구분

소스만 있는 상태에서는 독립 코덱·한글 검사 7건을 실행할 수 있습니다. 기존 v026 산출물이 없으면 메모리 회귀 클래스 6건은 **명시적으로 건너뛰며**, 이것을 전체 검사 통과로 보고하지 않습니다.

6건까지 실행하려면 별도로 보유한 과거 `config/runtime-v026.json`과 당시 입력을 준비해 v026을 빌드합니다. 두 메모리 ledger는 함께 공개되어 있습니다. 이 과거 프로필은 1.0.0 배포물을 만들기 위한 필수 입력이 아닙니다.

실행 검증은 선택적으로 PyBoy 2.7.0, Pillow, NumPy와 별도 libretro DLL을 사용합니다. 에뮬레이터/패키지는 동봉하지 않습니다. PyBoy의 통제 CPU 검사와 최종 화면 QA를 구분하며, 화면은 Gambatte/VBA-M으로 확인했습니다.

```powershell
python research/probe_approved_decode.py v027
python research/replay_font_poc.py out/runtime-v027/hp1-korean-runtime-v027.gbc work/replay 'D:/cores/vbam_libretro.dll' research/routes/v027-save-reload.json
```

재생 JSON의 `initial_sram`은 사용자가 보유한 해당 재현 세이브로 바꿔야 합니다. 공개 저장소에는 세이브가 없습니다. 경로에 적힌 세이브 지문과 다른 상태라면 같은 재현 검사가 아닙니다. `check_house_scores_v026.py`는 원본 및 과거 v025/v026 빌드를 비교하는 역사적 회귀 도구이고, `check_menu_v011.py`는 v010/v011의 기록을 요구합니다. 실행에 필요한 과거 결과가 없으면 해당 검사를 수행했다고 보고하지 마세요.
