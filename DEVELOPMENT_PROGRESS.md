# SubSync Frontend 개발 진행 기록

## 2026-09-04

- 단어에 표시되는 Hover 뜻 창으로 마우스를 이동할 때 창이 사라지는 문제를 개선
- 자막, 퀵바, 앱 창을 드래그해서 이동할 수 있도록 개선
- 자막 드래그 시작 시 아래로 튀는 위치 점프 문제를 수정
- 비로그인 배지 제거, 퀵바 아이콘 변경, 메인 패널 8방향 리사이즈 및 하단 Script 병합
- YouTube 컨트롤 상태에 따른 자막 자동 이동을 제거하고 더블클릭 시 기본 위치로 복귀하도록 개선
- 메인 패널을 퀵바 아래에 배치하고 iOS/macOS 느낌의 펼침·접힘 애니메이션을 적용
- 버튼, 탭, Script, 자막, 툴팁, 팝업, 모달 및 동적 콘텐츠 전체에 공통 인터랙션 애니메이션을 적용
## 2026-09-05
- 메인 패널 세로 확장 시 Script와 AI Tutor 내부가 남는 높이를 채우도록 개선
- 최초 트랙 수신 전 잘못된 전체 transcript 요청과 자막 중복 빌드 경쟁 문제를 수정
- Script 모션 적용 후 긴 자막 행이 잘리는 문제를 수정
- 현재 자막 미리보기의 고정 높이 클리핑과 긴 문장 줄바꿈 문제를 수정
- 드래그 후 자막 문장 길이 변화로 가로 중심축이 이동하는 문제를 수정
- 영상학습의 중복 Script 열기 버튼을 제거하고 전체 Script 패널 접기·펼치기를 추가
- Script 헤더 중앙 접기 배치와 전용 돋보기·접기 SVG 아이콘을 적용
- 접기 아이콘을 예시처럼 투명 배경의 두꺼운 회색 V자 형태로 개선
- 접기 아이콘을 원형 테두리와 내부 chevron 조합의 중립 회색 스타일로 개선
- 접기 아이콘을 50% 축소하고 Script 카드 헤더 높이를 함께 줄임
- 검색·접기 아이콘을 약 20% 확대하고 접힌 카드 hover 준비 애니메이션을 Script 영역에 한정해 적용
- 기존에 잘못 적용된 Script 카드 focus 기반 준비 애니메이션을 제거하고 마우스 hover만 유지
- 접힌 카드 hover 시 카드 전체 이동 대신 헤더 아래 펼쳐질 Script 패널 상단 peek 영역이 아래로 확장되도록 교정
- 화이트·다크 테마 설정을 추가하고 저장값에 따라 전체 SubSync UI 색상을 전환
- 글라스 테마 옵션을 추가하고 반투명 tinted glass, radial gradient, blur, saturate, glow 테두리를 전체 패널에 적용
- 글라스 패널 중앙의 보라색 ambient radial light와 purple glow shadow를 제거하고 청록 tint·필요한 UI 강조색만 유지
- 테마 변경 시 SubSync UI 표면·텍스트·테두리·그림자가 280ms transition으로 전환되도록 개선
- 단어 호버 툴팁의 wheel 이벤트가 YouTube 문서로 전파되지 않도록 차단
- 재생 중에만 Script 자동 스크롤을 추적하고, 일시정지 중에는 현재 cue 포커스만 유지
- 현재 Script 행을 end_timestamp 구간으로 판별해 정지 위치에서도 정확히 강조
- Script 자동 추적 위치를 목록 중앙이 아닌 윗단 기준선(16px 아래)에 고정
- Coolicons를 참고한 오리지널 SVG 아이콘 6종을 추가하고 주요 기능 메뉴에 적용
- 고정 Rounded Background layer를 제거하고 Chromium SVG feTurbulence·feDisplacementMap 기반의 정적 배경 굴절 Glass 효과를 메인 및 내부 surface에 적용
- 글라스 필터의 자동 turbulence 애니메이션을 제거하고 정적 refraction만 유지
- 이미지 기준 블루 팔레트(#3F7FF5)를 다크·화이트·글라스 테마와 공통 액션·Tutor·자막·Script 스타일에 적용
- Glass 설정 카드만 어두운 청록 차콜 표면(rgba 0.78)으로 조정해 설명 텍스트 대비를 개선
- Glass Tutor·Script 패널에도 설정 카드와 동일한 어두운 표면·테두리·정적 굴절 계층을 적용
- Glass 메인 패널 외곽선을 제거하고 내부 경계선을 중성 회색으로 통일했으며 패널 청록 틴트를 중성 차콜·화이트 sheen으로 교체
- Tutor 마운트 호스트의 중복 `subsync-tutor-box` 클래스를 제거하고 실제 Tutor surface가 한 번만 렌더되도록 회귀 테스트를 추가
