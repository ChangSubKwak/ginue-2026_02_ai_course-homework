// func-02-settings.js — 분수교구함 QA: 표시 설정·저장/복원·모달·도움말·테마·큰 글씨·저장소 이상 입력 검증 (pw-run.js 모듈)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const st = () => page.evaluate(() => window.__app.getState());
  const text = async sel => (await page.locator(sel).evaluate(el => el.textContent)).replace(/\s+/g, ' ').trim();
  const count = sel => page.locator(sel).count();
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const toastTexts = () => page.locator('#toast-root .toast').allTextContents();
  const ls = key => page.evaluate(k => localStorage.getItem(k), key);
  const KEY = 'edu.fraction-kit.v2.state', TKEY = 'edu.fraction-kit.theme';

  // ---- 저장 구조 ----
  expect(await ls(KEY) === null, '첫 실행: 저장값 없음');
  await page.click('[data-action="d+"]');
  const saved = JSON.parse(await ls(KEY));
  expect(saved && saved.version === 2 && saved.n === 3 && saved.d === 5, `저장 키 ${KEY}, version 2, n/d 반영`);
  expect(saved.show && typeof saved.show.bar === 'boolean' && Array.isArray(saved.chain) && typeof saved.big === 'boolean', '저장 필드 show/chain/big');

  // ---- AC9: 소수 체크박스 끄기 + 새로고침 유지 ----
  await page.uncheck('[data-show="decimal"]');
  expect(await page.locator('#decimal').isHidden(), 'AC9 소수 체크 해제 → 소수 숨김');
  expect((await st()).show.decimal === false, 'AC9 state.show.decimal=false');
  await reload();
  expect(await page.locator('#decimal').isHidden() && !(await page.isChecked('[data-show="decimal"]')), 'AC9 새로고침 후 소수 숨김 유지');
  expect((await st()).n === 3 && (await st()).d === 5, '새로고침 후 분수 3/5 복원');
  await page.check('[data-show="decimal"]');
  expect(await page.locator('#decimal').isVisible(), '소수 체크 → 다시 표시');
  await page.uncheck('[data-show="reading"]');
  expect(await page.locator('#reading').isHidden(), '읽기 체크 해제 → 읽기 숨김');
  await page.check('[data-show="reading"]');
  expect(await page.locator('#reading').isVisible(), '읽기 체크 → 다시 표시');

  // ---- AC10: 모델 토글 ----
  await page.click('[data-model="circle"]');
  expect(await page.locator('#model-circle').isHidden() && await page.locator('[data-model="circle"]').getAttribute('aria-pressed') === 'false', 'AC10 원 토글 끄기 → 원 숨김');
  await page.click('[data-model="bar"]');
  expect(await page.locator('#model-bar').isHidden(), 'AC10 막대 토글 끄기 → 막대 숨김');
  await page.click('[data-model="line"]');
  expect(await page.locator('#model-line').isVisible() && (await st()).show.line === true, 'AC10 마지막 수직선은 꺼지지 않음');
  expect((await toastTexts()).some(t => t.includes('최소')), 'AC10 마지막 모델 끄기 시 안내 토스트');
  await shot('settings-01-line-only');
  await reload();
  const s10 = await st();
  expect(!s10.show.bar && !s10.show.circle && s10.show.line, '새로고침 후 모델 표시 설정 복원(수직선만)');
  expect(await page.locator('#model-bar').isHidden() && await page.locator('#model-line').isVisible(), '복원 후 DOM도 수직선만 표시');
  await page.click('[data-model="bar"]'); await page.click('[data-model="circle"]');
  expect(await page.locator('#model-bar').isVisible() && await page.locator('#model-circle').isVisible(), '막대·원 다시 켜기');
  expect(await count('#svg-bar .cell') === 5 && await count('#svg-circle .cell') === 5, '다시 켠 모델이 현재 분수로 렌더됨');
  // API setShow 경계: 이미 꺼진 모델에 setShow(false) 호출
  await act('setShow', 'circle', false);
  expect((await st()).show.circle === false, 'setShow(circle,false) → 꺼짐');
  await act('setShow', 'circle', false);
  const circAfter = (await st()).show.circle;
  expect(circAfter === false, 'setShow(circle,false) 재호출 시 꺼진 상태 유지(토글이 아니어야 함)');
  await act('setShow', 'circle', true);
  expect((await st()).show.circle === true, 'setShow(circle,true) → 켜짐');
  await act('setShow', 'bogus', true);
  expect(!('bogus' in (await st()).show), 'setShow(알 수 없는 키) 무시');
  await act('toggleModel', 'decimal');
  expect((await st()).show.decimal === true, 'toggleModel(decimal) 무시');

  // ---- AC11: 처음 상태로(모달) ----
  await act('setFraction', 7, 4);
  await act('split', 2);
  await page.click('[data-action="big"]');
  await page.click('[data-model="line"]');
  await page.uncheck('[data-show="reading"]');
  // 취소 경로 1: ESC
  await page.click('[data-action="reset"]');
  await sleep(100);
  expect(await count('#modal-root .modal[role="dialog"]') === 1, 'AC11 처음 상태로 → 확인 모달 표시');
  expect(await text('#modal-root h2') === '처음 상태로 되돌릴까요?', 'AC11 모달 제목');
  const focusedBtn = await page.evaluate(() => document.activeElement && document.activeElement.textContent);
  expect(focusedBtn === '취소', `모달 열림 시 첫 버튼(취소)에 포커스 (실제: ${focusedBtn})`);
  expect(await page.locator('#modal-root .modal').getAttribute('aria-modal') === 'true', '모달 aria-modal');
  await page.keyboard.press('Escape');
  await sleep(50);
  expect(await count('#modal-root .modal') === 0, 'AC11 ESC로 모달 닫힘');
  expect((await st()).n === 14 && (await st()).d === 8, 'AC11 ESC 취소 시 상태 유지(14/8)');
  const focusBack = await page.evaluate(() => document.activeElement && document.activeElement.dataset.action);
  expect(focusBack === 'reset', `모달 닫힘 후 원래 버튼으로 포커스 복귀 (실제: ${focusBack})`);
  // 취소 경로 2: 배경 클릭
  await page.click('[data-action="reset"]');
  await sleep(50);
  await page.mouse.click(5, 5);
  await sleep(50);
  expect(await count('#modal-root .modal') === 0 && (await st()).d === 8, '배경 클릭으로 모달 닫힘, 상태 유지');
  // 취소 경로 3: 취소 버튼
  await page.click('[data-action="reset"]');
  await sleep(50);
  await page.click('#modal-root .modal-foot .btn:not(.primary)');
  expect(await count('#modal-root .modal') === 0 && (await st()).d === 8, '취소 버튼으로 모달 닫힘, 상태 유지');
  // 모달 열림 중 단축키 무시 + Tab 포커스 트랩
  await page.click('[data-action="reset"]');
  await sleep(50);
  await page.keyboard.press('ArrowRight');
  expect((await st()).n === 14, '모달 열림 중 → 단축키 무시');
  await page.keyboard.press('Shift+Tab');
  let inModal = await page.evaluate(() => !!document.activeElement.closest('#modal-root'));
  expect(inModal, 'Shift+Tab 포커스 트랩(모달 안 유지)');
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
  inModal = await page.evaluate(() => !!document.activeElement.closest('#modal-root'));
  expect(inModal, 'Tab 6회 후에도 포커스 모달 안');
  await shot('settings-02-reset-modal');
  // 확인
  await page.click('#modal-root .btn.primary');
  await sleep(100);
  const s11 = await st();
  expect(s11.n === 3 && s11.d === 4 && s11.show.bar && s11.show.circle && s11.show.line, 'AC11 확인 → 3/4·세 모델 켜짐');
  expect(s11.big === false && s11.chain.length === 0 && s11.show.reading === true && s11.show.decimal === true, 'AC11 큰 글씨·사슬·읽기 체크도 기본값');
  expect(await page.evaluate(() => document.documentElement.dataset.big) === undefined, 'AC11 html[data-big] 제거');
  expect((await toastTexts()).some(t => t.includes('처음')), 'AC11 초기화 성공 토스트');
  const savedR = JSON.parse(await ls(KEY));
  expect(savedR.n === 3 && savedR.d === 4, 'AC11 초기화가 저장소에도 반영');
  expect(await count('#modal-root .modal') === 0, 'AC11 확인 후 모달 닫힘');

  // ---- 도움말 모달 ----
  await page.click('[data-action="help"]');
  await sleep(50);
  expect(await count('#modal-root .modal') === 1 && (await text('#modal-root h2')).includes('사용법'), '도움말 모달 열림');
  expect(await count('#modal-root .modal-body ol > li') === 3, '도움말 3단계');
  const helpBody = await text('#modal-root .modal-body');
  expect(helpBody.includes('수업 팁') && helpBody.includes('동치분수'), '도움말 수업 팁(동치분수 시연)');
  expect(helpBody.includes('←/→') && helpBody.includes('Esc'), '도움말 단축키 안내');
  expect(await count('#modal-root .modal-foot .btn') === 1 && await text('#modal-root .modal-foot .btn') === '닫기', '도움말: 닫기 버튼만');
  await shot('settings-03-help');
  await page.keyboard.press('Escape');
  expect(await count('#modal-root .modal') === 0, '도움말 ESC 닫힘');
  await page.click('[data-action="help"]');
  await sleep(50);
  await page.click('#modal-root .modal-x');
  expect(await count('#modal-root .modal') === 0, '도움말 × 버튼 닫힘');
  await page.click('[data-action="help"]');
  await sleep(50);
  await page.click('#modal-root .modal-foot .btn');
  expect(await count('#modal-root .modal') === 0, '도움말 닫기 버튼 닫힘');
  // 모달 중복 열기 방지(배경이 덮으므로 두 번 열리지 않아야 함)
  await page.click('[data-action="help"]');
  await sleep(50);
  await page.click('[data-action="help"]', { force: true, timeout: 2000 }).catch(() => {});
  await sleep(50);
  const modalCount = await count('#modal-root .modal');
  expect(modalCount === 1, `모달 중복 열림 없음 (실제 ${modalCount})`);
  await page.keyboard.press('Escape');
  await sleep(50);
  const remaining = await count('#modal-root .modal');
  expect(remaining === 0, `ESC 후 남은 모달 0 (실제 ${remaining})`);
  while (await count('#modal-root .modal')) { await page.keyboard.press('Escape'); await sleep(30); }

  // ---- 테마 ----
  const bgLight = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(await text('#btn-theme') === '🌙', '라이트 상태 아이콘 🌙');
  await page.click('#btn-theme');
  expect(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', '테마 토글 → data-theme=dark');
  expect(await text('#btn-theme') === '☀️', '다크 상태 아이콘 ☀️');
  expect(await ls(TKEY) === '"dark"', `테마 저장 ${TKEY}="dark"`);
  const bgDark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bgLight !== bgDark, `다크 body 배경 변경 (${bgLight} → ${bgDark})`);
  await reload();
  expect(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark' && await text('#btn-theme') === '☀️', '새로고침 후 다크 테마 유지');
  await page.click('#btn-theme');
  expect(await page.evaluate(() => document.documentElement.dataset.theme) === 'light' && await ls(TKEY) === '"light"', '다시 토글 → light 저장');

  // ---- AC14: 큰 글씨 ----
  const symBefore = await page.locator('#sym').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  const btnBefore = await page.locator('[data-action="split2"]').evaluate(el => el.getBoundingClientRect().height);
  await page.click('[data-action="big"]');
  const symAfter = await page.locator('#sym').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  const btnAfter = await page.locator('[data-action="split2"]').evaluate(el => el.getBoundingClientRect().height);
  expect(symAfter / symBefore >= 1.3, `AC14 큰 글씨: 기호 글꼴 ${symBefore}px → ${symAfter}px (${(symAfter / symBefore).toFixed(2)}배)`);
  expect(btnAfter > btnBefore && btnAfter >= 60, `큰 글씨: 버튼 높이 ${btnBefore} → ${btnAfter}px`);
  expect(await page.locator('[data-action="big"]').getAttribute('aria-pressed') === 'true', '큰 글씨 aria-pressed=true');
  const layoutCols = await page.locator('.layout').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(layoutCols === 1, `큰 글씨: 한 열 배치 (열 수 ${layoutCols})`);
  const overflowBig = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(!overflowBig, '큰 글씨 1280px: 가로 스크롤 없음');
  await shot('settings-04-big');
  await reload();
  expect((await st()).big === true && await page.evaluate(() => document.documentElement.dataset.big) === 'on', '새로고침 후 큰 글씨 유지');
  await page.click('[data-action="big"]');
  expect((await st()).big === false, '큰 글씨 끄기');

  // ---- 사슬 복원 ----
  await act('setFraction', 3, 4);
  await act('split', 2);
  await reload();
  const sc = await st();
  expect(sc.chain.length === 2 && await text('#chain') === '3/4 = 6/8', '새로고침 후 동치 사슬 복원');

  // ---- 저장소 이상 입력(깨진 JSON·범위 초과·XSS 문자열) ----
  await page.evaluate(k => localStorage.setItem(k, '{not json'), KEY);
  await reload();
  let s = await st();
  expect(s.n === 3 && s.d === 4, '깨진 JSON 저장값 → 기본값 3/4');
  await page.evaluate(k => localStorage.setItem(k, JSON.stringify({ version: 2, n: 999, d: -3, show: { bar: false, circle: false, line: false, decimal: 'yes' }, big: 'x', chain: 'nope' })), KEY);
  await reload();
  s = await st();
  expect(s.d === 1 && s.n === 2, '범위 초과 n/d → 클램프(2/1)');
  expect(s.show.bar === true && s.show.decimal === true && s.big === true, '모든 모델 꺼짐 저장값 → 막대 켜짐, 비불리언 show 무시, big 불리언화');
  expect(s.chain.length === 0, 'chain 비배열 → 빈 배열');
  await page.evaluate(k => localStorage.setItem(k, JSON.stringify({ version: 1, n: 1, d: 2 })), KEY);
  await reload();
  s = await st();
  expect(s.n === 3 && s.d === 4, 'version 1 저장값 → 무시하고 기본값');
  await page.evaluate(k => localStorage.setItem(k, JSON.stringify({ version: 2, n: '<img src=x onerror=window.__xss=1>', d: '<script>window.__xss=1</script>', chain: [{ n: '<b>x</b>', d: 2 }] })), KEY);
  await reload();
  s = await st();
  expect(s.n === 3 && s.d === 4 && await page.evaluate(() => !window.__xss) && await count('#chain img, #chain b') === 0, 'XSS 문자열 저장값 → 무시, 스크립트 미실행');
  // chain 항의 n이 분모×2 범위를 벗어난 저장값
  await page.evaluate(k => localStorage.setItem(k, JSON.stringify({ version: 2, n: 3, d: 4, show: { bar: true, circle: true, line: true, decimal: true, reading: true }, big: false, chain: [{ n: 3, d: 4 }, { n: 500, d: 4 }, { n: -7, d: 4 }] })), KEY);
  await reload();
  s = await st();
  const badChain = s.chain.filter(f => f.n < 0 || f.n > f.d * 2);
  expect(badChain.length === 0, `저장 chain 항의 분자 범위 검증 (범위 밖 항 ${badChain.length}개 복원됨)`);
  if (badChain.length) {
    await page.click('#chain .term[data-chain="1"]');
    const s2 = await st();
    expect(s2.n >= 0 && s2.n <= s2.d * 2, `범위 밖 사슬 항 클릭 → 상태 범위 안 (실제 n=${s2.n}, d=${s2.d})`);
    log('after bad chain click: ' + JSON.stringify(s2) + ' cap=' + await text('#cap-bar'));
    await shot('settings-05-bad-chain');
  }
  // 테마 저장값 이상
  await page.evaluate(k => localStorage.setItem(k, '"<script>x</script>"'), TKEY);
  await reload();
  const thv = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(await page.evaluate(() => !window.__xss) , '테마 저장값 XSS 문자열 → 스크립트 미실행');
  log('theme attr with bogus saved value: ' + thv);
  await page.evaluate(k => localStorage.removeItem(k), TKEY);
  await page.evaluate(k => localStorage.removeItem(k), KEY);

  // ---- localStorage 사용 불가(토스트 1회, 메모리 동작) ----
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); }, configurable: true });
  });
  await reload();
  s = await st();
  expect(s.n === 3 && s.d === 4, 'localStorage 차단: 기본값으로 시작, 예외 없음');
  await page.click('[data-action="d+"]');
  await sleep(100);
  let toasts = await toastTexts();
  expect(toasts.filter(t => t.includes('저장소')).length === 1, 'localStorage 차단: 첫 저장 시 안내 토스트 1회');
  await page.click('[data-action="d+"]');
  await page.click('[data-action="n+"]');
  await sleep(100);
  toasts = await toastTexts();
  expect(toasts.filter(t => t.includes('저장소')).length === 1, 'localStorage 차단: 추가 조작에도 토스트 중복 없음');
  expect((await st()).d === 6 && (await st()).n === 4, 'localStorage 차단: 메모리로 정상 동작(4/6)');
  await page.click('#btn-theme');
  expect(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'localStorage 차단: 테마 토글 동작');
  await shot('settings-06-storage-blocked');
};
