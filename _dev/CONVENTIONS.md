# 공통 구현 규약 (5개 교육용 앱 공통)

과제 "바이브코딩으로 만드는 교육용 앱 개발"의 5개 앱은 서로 독립된 폴더이지만, 아래 규약을 똑같이 따라 하나의 포트폴리오처럼 보이고 동작해야 한다.

## 1. 파일 구조 (앱 폴더 = `D:\workspace\ginue-2026_02_ai_course-homework\<folder_slug>\`)

```
<folder_slug>/
  index.html        완전한 HTML 문서 (<!doctype html>, <html lang="ko">). <title>는 앱 이름만
  css/style.css     모든 스타일 (인쇄 스타일 포함)
  js/data.js        샘플 데이터·상수·콘텐츠 (전역 const APP_DATA = {...}). 데이터가 적으면 생략 가능
  js/app.js         앱 로직. 길어지면 js/storage.js, js/ui.js, js/game.js 등으로 나누고 index.html에서 순서대로 로드
  README.md         아래 10절 템플릿
  assets/           (선택) 로컬 SVG/PNG. 외부 URL 이미지 금지. 가능하면 인라인 SVG·이모지·CSS로 해결
```
- 폴더 밖의 파일을 절대 참조하지 않는다(각 앱은 완전히 독립, 공통 파일 없음. 중복 코드 허용).
- `docs/` 폴더는 나중에 문서 작성 단계에서 생성되므로 만들지 않는다.

## 2. 실행 환경 (가장 중요)
- `index.html`을 **더블클릭(file://)** 해서 실행된다. 따라서:
  - ES 모듈 금지: `type="module"`, `import`/`export` 사용 금지. 일반 `<script src>`를 body 끝에 순서대로.
  - `fetch`/XHR로 로컬 파일(JSON, CSV, SVG) 읽기 금지(file://에서 CORS 차단). 데이터는 `js/data.js`에 JS 객체로 포함.
  - `<a download>` + Blob으로 파일 저장은 가능. `<input type="file">`과 드래그앤드롭 + FileReader로 읽기 가능.
- 외부 라이브러리 금지(CDN 스크립트 금지). 차트·드래그·애니메이션·달력·사운드는 SVG/Canvas/DOM/Web Audio로 직접 구현.
- Google Fonts `<link>`만 허용하되 반드시 시스템 폰트 대체 스택을 둔다: `"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`. 오프라인(폰트 로드 실패)에서도 레이아웃이 깨지지 않아야 한다.
- 최신 Chrome/Edge 기준. 태블릿·전자칠판 터치 사용을 고려해 터치 타깃 44px 이상.
- `alert()`, `confirm()`, `prompt()` **절대 금지** → 인앱 모달(확인/취소)과 토스트로 대체.
- `window.print()`는 인쇄가 핵심 기능인 앱에서만 사용하고 `@media print` 스타일을 반드시 포함.
- `console.error`/경고가 0건이어야 한다. 전역 예외 없음.

## 3. HTML 뼈대

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>앱이름</title>
  <meta name="description" content="한 줄 소개">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=...&display=swap">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <header class="app-header">  로고(인라인 SVG 또는 이모지 span) + <h1>앱 이름</h1> + 태그라인 + 우측 툴바
      툴바: 테마 토글(🌙/☀️), 도움말(?), 데이터(내보내기/가져오기/샘플로 초기화) — 아이콘 버튼엔 aria-label
  </header>
  <nav class="tabs" role="tablist"> (화면이 여러 개일 때 탭)  </nav>
  <main id="app"> <section data-view="..." hidden> ... </section>  (표시/숨김은 `hidden` 속성 토글) </main>
  <footer class="app-footer"> 바이브코딩으로 만드는 교육용 앱 · <앱 이름> · 2026 · 내장된 데이터는 모두 가상의 샘플입니다 </footer>
  <div id="modal-root"></div>  <div id="toast-root" aria-live="polite"></div>
  <script src="js/data.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

## 4. 테마 토큰 (반드시 이 형태, 라이트+다크 모두 디자인)

```css
/* 레이아웃 컨셉 한 줄 주석 */
:root {
  --bg: ...; --surface: ...; --surface-2: ...; --fg: ...; --fg-muted: ...; --border: ...;
  --accent: <visual_identity.accent_hex>; --accent-fg: ...; --accent-soft: ...;
  --ok: ...; --warn: ...; --danger: ...; --info: ...;
  --radius: 12px; --radius-sm: 8px; --shadow: ...;
  --font-display: "<font_display>", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
  --font-body: "<font_body>", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: ...; --surface: ...; /* 모든 색 토큰 다크 값 */ color-scheme: dark; }
}
:root[data-theme="dark"] { /* 위와 동일한 다크 값 */ color-scheme: dark; }
body { background: var(--bg); color: var(--fg); font-family: var(--font-body); margin: 0; }
```
- 모든 색은 토큰으로만 쓴다. 컴포넌트 규칙에 리터럴 색 금지(차트 시리즈 색도 토큰 `--chart-1..6`으로, 두 테마 모두에서 보이게).
- 다크 모드의 액센트는 밝기를 올려 대비를 확보한다. 라이트에서 글자 대비 4.5:1 이상.
- 테마 토글 버튼: `documentElement.dataset.theme = 'light' | 'dark'` 설정, 선택값은 localStorage `edu.<slug>.theme`에 저장. 저장값이 없으면 속성을 두지 않아(system) OS 설정을 따른다.

## 5. 레이아웃·반응형·접근성
- `body`(또는 `.page` 래퍼)에 `padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));`, 세로는 `padding-block`.
- 400px 폭에서 **가로 스크롤 금지**. 표/차트/코드만 자체 `overflow-x: auto` 컨테이너 안에서 넓어질 수 있다. flex/grid 자식에 `min-width: 0`.
- flex/grid + `gap`으로 간격. 좁은 폭에서는 1열로 쌓인다. 이미지·aspect-ratio 박스는 `max-width: 100%`.
- 숫자 열: `font-variant-numeric: tabular-nums`. 제목: `text-wrap: balance`.
- `@media (prefers-reduced-motion: reduce)`에서 애니메이션 최소화. `:focus-visible` 포커스 링. 아이콘 버튼 `aria-label`. 탭은 `role="tab"`/`aria-selected`.
- 첫 화면은 **샘플 데이터가 채워진 실제 작업 상태**로 열린다(빈 껍데기 금지). 빈 상태(empty state)는 설명 + 행동 버튼.

## 6. 데이터·저장
- localStorage 접근은 모두 `storage` 래퍼(try/catch)로. 실패 시 메모리로만 동작하고 토스트로 1회 안내.
  ```js
  const storage = { key: k => 'edu.<slug>.' + k,
    get(k, d) { try { const v = localStorage.getItem(this.key(k)); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(this.key(k), JSON.stringify(v)); return true; } catch (e) { return false; } },
    remove(k) { try { localStorage.removeItem(this.key(k)); } catch (e) {} } };
  ```
- 저장 데이터에 `version: 1` 포함. 첫 실행(저장 없음) → `APP_DATA` 샘플 로드. "샘플로 초기화"는 모달 확인 후 복원.
- 내보내기: JSON(전체 백업) / CSV(표 데이터). CSV는 UTF-8 BOM(`\uFEFF`) 포함(엑셀 한글 깨짐 방지), 쉼표·줄바꿈·따옴표 이스케이프.
- 가져오기: `<input type="file">` + 드래그앤드롭. JSON 구조 검증 → 오류 시 토스트, 성공 시 모달 확인 후 덮어쓰기.
- 사용자 입력을 `innerHTML`에 넣을 때는 반드시 `escapeHtml()`.

## 7. UI 공통 컴포넌트 (각 앱이 자체 구현, 이름·동작 통일)
- `showToast(message, type = 'info' | 'success' | 'warn' | 'error', ms = 2500)` — 우하단 스택, 자동 사라짐.
- `showModal({ title, body, confirmText = '확인', cancelText = '취소', danger = false })` → `Promise<boolean>`. ESC·배경 클릭으로 닫기, 열릴 때 첫 버튼에 포커스, 닫히면 원래 요소로 포커스 복귀. body는 문자열(HTML) 또는 Node.
- 도움말 모달(툴바 `?` 버튼): 앱 사용법 3~6단계 + 팁 + 단축키. 내용은 README의 "사용 방법"과 일치.
- 확인이 필요한 파괴적 동작(삭제, 초기화, 덮어쓰기)은 반드시 모달 확인.

## 8. 코드 스타일
- `'use strict';` + IIFE 또는 단일 네임스페이스 객체. `const`/`let`, 템플릿 리터럴, 화살표 함수.
- **상태 → 렌더 단방향**: `state` 객체 + `render()` (또는 화면별 render 함수). 이벤트는 위임(delegation) 위주, `data-action` 속성.
- 파일 상단에 파일 설명 주석, 함수마다 한 줄 한국어 주석. 매직 넘버는 상수로.
- 랜덤 요소(배치, 문제 출제)는 "다시 생성" 가능. 필요하면 간단한 시드 랜덤(mulberry32) 사용.
- 코드량 목표: 앱당 HTML+CSS+JS 합계 1,200~2,500줄(README 제외). 과도하게 적거나 많지 않게.

## 9. 인쇄(해당 앱만)
```css
@media print { .app-header .toolbar, .tabs, .no-print, button { display: none !important; }
  :root { --bg: #fff; --fg: #000; ... }  body { background: #fff; }  .card, tr { break-inside: avoid; } }
```
인쇄 미리보기에서 A4 세로 1~2장에 알맞게 배치. 인쇄용 제목(학교·학급·날짜)이 보이도록.

## 10. README.md 템플릿 (한국어)
```
# <앱 이름> — <태그라인>
**카테고리:** 0N. <카테고리명>  |  **대상:** ...  |  **기술:** HTML/CSS/JS (외부 라이브러리 없음)
## 소개 (문제와 해결, 3~5문장)
## 실행 방법 (index.html 더블클릭 / 로컬 서버 / 권장 브라우저)
## 주요 기능 (표 또는 목록)
## 화면 구성 (화면별 설명)
## 사용 방법 (단계별, 도움말 모달과 동일)
## 데이터 저장·내보내기·가져오기
## 샘플 데이터 안내 (가상의 학교/학급/학생임을 명시)
## 파일 구조
## 기술적 특징 (대표 기술 1~2개 설명, 알고리즘 요약)
## 제한 사항 및 향후 개선
## 바이브코딩 개발 과정 (AI와 어떤 프롬프트·단계로 만들었는지 5~8줄)
```

## 11. 빌더 자가 점검 체크리스트 (완료 전 반드시 실행)
1. `node <tools>/lint-app.js <앱 폴더>` → issues 0건.
2. `node <tools>/pw-check.js <앱 폴더>/index.html <결과 폴더>` → problems 0건, 스크린샷 3장(desktop-light/dark, mobile) 열어서 확인.
3. 스펙의 acceptance_criteria를 하나씩 직접 확인(필요하면 `pw-run.js` 테스트 모듈 작성).
4. 새로고침 후 데이터 복원, "샘플로 초기화", JSON 내보내기/가져오기 동작 확인.
5. 400px 폭에서 모든 화면 사용 가능(가로 스크롤 없음), 다크 모드에서 모든 글자·차트 읽힘.
