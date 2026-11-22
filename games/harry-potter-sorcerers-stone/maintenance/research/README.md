# 실행 조사 도구

이 도구들은 제품 빌드와 별도다. 정확한 ROM과 사전 조건이 필요하며, 함수 하네스/메모리 개입을 자연 플레이로 보고하지 않는다.

- probe_approved_decode.py: 버전 인수(예: v027)를 받아 모든 번역 descriptor와 숫자 변수를 실제 CPU 루틴으로 검사.
- probe_variable_slots.py: 초기 변수 치환 문제를 재현한 함수 단위 도구. 과거 입력을 전제로 한다.
- check_house_scores_v026.py: 원본/v025/v026의 점수 계산, 한정된 세이브 복구, 커서 분기 비교.
- check_menu_v011.py: v010/v011 메뉴 개편의 과거 산출물·화면을 비교.
- replay_font_poc.py: ROM/출력 폴더/libretro DLL/입력 JSON을 받아 콜드 부팅 및 컨트롤러 재생. trace에 ROM·코어·세이브 지문과 상태 개입을 기록.
- routes/: 개인 저장 파일의 내용을 제외한 입력 일정. initial_sram의 상대 경로에 지문이 맞는 재현 세이브를 준비해야 한다.

PyBoy는 외부 패키지로 설치하거나 사용자가 정한 PYTHONPATH에서 제공한다. 소스가 특정 사용자의 형제 프로젝트에서 패키지를 몰래 가져오지 않는다. Windows libretro 재생에는 Pillow와 NumPy가 필요하다.
