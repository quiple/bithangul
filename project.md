# 프로젝트 명세: 한글 픽셀 폰트 생성기 (Hangul Pixel Font Generator)

## 1. 개요

사용자가 16x16 크기의 픽셀 컴포넌트를 직접 디자인하고, 특정 초/중/종성 조합 조건(Custom Typeface Set)에 따라 11,172자의 완성형 한글 음절을 생성 및 내보내기(BDF, HEX)하는 도구입니다.

## 2. 기술 스택

- **Framework**: Svelte / SvelteKit
- **Language**: TypeScript
- **UI Component**: shadcn-svelte
- **Icons**: Lucide Svelte
- **Performance**: Web Worker (글리프 합성), Virtual List (프리뷰 렌더링)

## 3. 핵심 데이터 구조 (Types)

```typescript
// src/lib/types.ts
export interface PixelComponent {
  id: string
  bitmap: number[][] // 16x16 이진 배열 (0: off, 1: on)
  targets: {
    chosung: number[] // 적용될 초성 인덱스 (0~18)
    jungsung: number[] // 적용될 중성 인덱스 (0~20)
    jongsung: number[] // 적용될 종성 인덱스 (0~27, 0은 종성 없음)
  }
}

export interface FontProject {
  name: string
  components: PixelComponent[]
}
```

## 4. 상세 UI/UX 명세

### A. 상단 툴바 (Top Toolbar)

- **파일 메뉴**:
  - `저장`: 현재 `FontProject` 데이터를 `.json` 파일로 로컬 다운로드.
  - `불러오기`: `.json` 파일을 업로드하여 상태 복구.
- **실행 버튼**:
  - `생성`: 설정된 컴포넌트 조합 로직을 실행하여 우측 프리뷰 갱신.
  - `BDF 내보내기`: 조합된 비트맵을 BDF(Glyph Bitmap Distribution Format)로 변환 후 다운로드.
  - `hex 내보내기`: GNU Unifont .hex 형식으로 변환 후 다운로드.

### B. 좌측 패널: 컴포넌트 관리 및 편집 (Component Editor)

- **목록 뷰 (Default)**:
  - 우측 상단 `+` 버튼 클릭 시 신규 컴포넌트 생성 및 **편집 화면** 진입.
  - 기존 컴포넌트 클릭 시 해당 데이터로 **편집 화면** 진입.
- **편집 화면 (Edit Mode)**:
  - 우측 상단 `저장`, `취소` 버튼 표시.
  - **중앙**: 16x16 픽셀 그리드 캔버스. 클릭 및 드래그로 픽셀 수정.
  - **하단**: 초성(19), 중성(21), 종성(28) 체크박스 그룹.
    - **조합 로직**: 선택된 각 그룹 내의 인덱스들은 `OR`로 작동하지만, 그룹 간(초-중-종)에는 `AND`로 작동함.
    - 예: 초성 'ㄱ', 중성 'ㅏ' 선택 시 => 종성에 상관없이 '가', '각', '간'... 등에 모두 해당 컴포넌트가 적용됨.

### C. 우측 패널: 완성형 프리뷰 (Font Preview)

- **Virtual Scroll**: 11,172자(가~힣)를 그리드 형태로 효율적으로 렌더링하여 성능 최적화.
- **업데이트 방식**: '생성' 버튼 클릭 시 Web Worker를 통해 11,172자의 비트맵을 합성하여 결과물 표시.

## 5. 주요 알고리즘 및 참고 사항

### 한글 음절 분해 공식

- `S = 유니코드 - 0xAC00`
- 초성 인덱스: `Math.floor(S / 588)`
- 중성 인덱스: `Math.floor((S % 588) / 28)`
- 종성 인덱스: `S % 28`
- _참고_: [es-hangul constants](https://github.com/toss/es-hangul/blob/main/src/_internal/constants.ts)

### 비트맵 합성 로직

1. 11,172개의 각 음절에 대해 루프 실행.
2. 각 음절의 초/중/종성 인덱스를 추출.
3. 전체 `components` 리스트를 필터링하여, 현재 음절의 인덱스가 `targets`에 포함된 모든 컴포넌트를 추출.
   - 조건: `(comp.targets.chosung.includes(currentCho) && comp.targets.jungsung.includes(currentJung) && comp.targets.jongsung.includes(currentJong))`
4. 추출된 컴포넌트들의 `bitmap` 데이터를 Bitwise OR 연산으로 중첩.

## 6. 데이터 영속성

- 모든 데이터는 브라우저 메모리 내에서 관리하며, 사용자가 명시적으로 '저장' 버튼을 눌러 `.json` 파일로 내려받아 백업할 수 있도록 함.
