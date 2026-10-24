// func-boards.js — 비교·통분 보드와 덧셈·뺄셈 단계 시각화 검증 (AC6~AC8) + 키패드·칩·자동 재생·오개념 거울·경계값
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const S = () => page.evaluate(() => window.__app.getState());
  const txt = sel => page.locator(sel).first().innerText();
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const toasts = () => page.evaluate(() => [...document.querySelectorAll('#toast-root .toast')].map(t => t.textContent));
  const norm = s => s.replace(/\s+/g, ' ').trim();
  const modalCount = () => page.locator('.modal[role=dialog]').count();
  let s;

  // ---------- 비교·통분 탭 열기 ----------
  await page.click('[data-tab=compare]'); await sleep(150);
  expect(!(await page.locator('[data-view=compare]').isHidden()) && (await page.locator('.tabs [data-tab=compare]').getAttribute('aria-selected')) === 'true', '비교·통분 탭 열림');
  s = await S(); expect(s.compare.a.n === 2 && s.compare.a.d === 3 && s.compare.b.n === 3 && s.compare.b.d === 5, '비교 기본값 2/3 vs 3/5');
  expect(await page.locator('#cmp-inputs .ab-block.a .chip').count() === 12 && await page.locator('#cmp-inputs .ab-block.b .chip').count() === 12, 'A·B 빠른 선택 칩 12개씩');
  expect(await page.locator('.cmp-line .pt.f-a').count() === 1 && await page.locator('.cmp-line .pt.f-b').count() === 1, '수직선에 A·B 점');
  const chipA = (n, d) => page.click(`#cmp-inputs .ab-block.a .chip[data-n="${n}"][data-d="${d}"]`);
  const chipB = (n, d) => page.click(`#cmp-inputs .ab-block.b .chip[data-n="${n}"][data-d="${d}"]`);

  // ---------- AC6 2/3 vs 3/5 통분 ----------
  await chipA(2, 3); await chipB(3, 5);
  expect((await page.locator('#cmp-inputs .ab-block.a .chip[data-n="2"][data-d="3"]').getAttribute('aria-pressed')) === 'true', '선택 칩 aria-pressed');
  expect(await page.locator('.cmp-bars [data-who=a] .cell').count() === 3 && await page.locator('.cmp-bars [data-who=b] .cell').count() === 5, 'A 3칸·B 5칸');
  const fa = await page.locator('.cmp-bars [data-who=a] .bar-frame').boundingBox(), fb = await page.locator('.cmp-bars [data-who=b] .bar-frame').boundingBox();
  expect(Math.abs(fa.width - fb.width) < 1, '두 막대 같은 폭');
  expect((await txt('.cmp-formula')).includes('같은 분모로 맞추기'), '시작 전 안내 문구');
  await page.click('[data-action=cmp-start]'); await sleep(500);
  s = await S(); expect(s.compare.step === 1, 'AC6 맞추기 → 1단계');
  expect(await page.locator('.cmp-bars [data-who=a] .cell').count() === 15 && await page.locator('.cmp-bars [data-who=a] .div.new').count() === 12, 'AC6 1단계: A 15등분, 새 분할선 12개(14−2)');
  expect(await page.locator('.cmp-steps li.active').count() === 1 && (await txt('.cmp-steps li.active')).includes('A 재분할'), '단계 표시기 ① 강조');
  let f = await txt('.cmp-formula'); expect(f.includes('2/3 = 10/15') && !f.includes('3/5 = 9/15'), 'AC6 1단계 식 2/3 = 10/15');
  await page.click('[data-action=cmp-next]'); await sleep(500);
  expect(await page.locator('.cmp-bars [data-who=b] .cell').count() === 15 && (await txt('.cmp-formula')).includes('3/5 = 9/15'), 'AC6 2단계: B 15등분 + 3/5 = 9/15');
  await page.click('[data-action=cmp-next]'); await sleep(200);
  f = await txt('.cmp-formula');
  expect(f.includes('10/15 > 9/15 → 2/3 > 3/5') && f.includes('차이: 1/15'), 'AC6 3단계 비교식 + 차이 1/15');
  expect(await page.locator('[data-action=cmp-next]').isDisabled() && await page.locator('[data-action=cmp-auto]').isDisabled(), '3단계 후 다음·자동 재생 비활성');
  expect(await page.locator('.cmp-bars [data-who=a] .cell-label').count() === 0, 'L=15: 칸 번호 라벨 생략(d>12)');
  // 겹쳐 보기
  await page.click('[data-action=cmp-overlay]'); await sleep(150);
  s = await S(); expect(s.compare.overlay === true, 'AC6 겹쳐 보기 켜짐');
  const ov = await page.evaluate(() => { const e = document.querySelector('.cmp-bars .cell.ov'); return e ? { op: getComputedStyle(e).opacity, w: +e.getAttribute('width') } : null; });
  expect(ov && Math.abs(+ov.op - 0.55) < 0.01 && Math.abs(ov.w - 600) < 1, 'AC6 B 반투명(0.55) 오버레이 폭 = 3/5: ' + JSON.stringify(ov));
  const hatch = await page.evaluate(() => { const e = document.querySelector('.cmp-bars .hatch'); return e ? { x: +e.getAttribute('x'), w: +e.getAttribute('width'), fill: e.getAttribute('fill') } : null; });
  expect(hatch && Math.abs(hatch.x - 600) < 1 && Math.abs(hatch.w - (1000 * (2 / 3 - 3 / 5))) < 1 && hatch.fill.includes('hatch-diff'), 'AC6 차이 구간 빗금 [3/5, 2/3): ' + JSON.stringify(hatch));
  await shot('compare-overlay');
  await page.click('[data-action=cmp-overlay]');
  expect((await S()).compare.overlay === false, '겹쳐 보기 끄기');
  // 처음으로
  await page.click('[data-action=cmp-reset]');
  s = await S(); expect(s.compare.step === 0 && await page.locator('.cmp-bars [data-who=a] .cell').count() === 3, '처음으로 → 0단계, A 3칸');
  // 단계 중 칸 클릭 차단 토스트
  await page.click('[data-action=cmp-start]'); await sleep(450);
  await page.locator('.cmp-bars [data-who=a] .cell').first().dispatchEvent('pointerdown', { bubbles: true, pointerId: 1 });
  expect((await toasts()).some(t => t.includes('처음으로를 누른 뒤')), '단계 진행 중 칸 클릭 → 안내 토스트');
  await page.click('[data-action=cmp-start]');
  expect((await toasts()).some(t => t.includes('다시 시작하세요')) , '진행 중 맞추기 재클릭 → 안내 토스트');
  await page.click('[data-action=cmp-reset]');
  // 겹쳐 보기만 켜도 차이 라벨
  await chipA(3, 4); await act('compareSet', 'b', 1, 6);
  await page.click('[data-action=cmp-overlay]');
  expect((await txt('.cmp-formula')).includes('차이: 7/12'), '3/4 vs 1/6 겹쳐 보기 → 차이: 7/12');
  await page.click('[data-action=cmp-overlay]');
  // 칸 클릭으로 분자 변경
  await page.locator('.cmp-bars [data-who=b] .cell[data-i="3"]').dispatchEvent('pointerdown', { bubbles: true, pointerId: 1 });
  s = await S(); expect(s.compare.b.n === 4 && s.compare.b.d === 6, 'B 막대 4번째 칸 클릭 → 4/6');
  await page.locator('.cmp-bars [data-who=b] .cell[data-i="3"]').dispatchEvent('pointerdown', { bubbles: true, pointerId: 1 });
  s = await S(); expect(s.compare.b.n === 3, '마지막 칸 재클릭 → 3/6');
  // 분모 ± 범위 2~12
  await chipA(1, 2);
  await sleep(50);
  expect((await S()).compare.a.d === 2 && await page.locator('#cmp-inputs .ab-block.a [data-action=compare-d][data-delta="-1"]').isDisabled(), '분모 2에서 − 비활성');
  for (let i = 0; i < 11; i++) { const b = page.locator('#cmp-inputs .ab-block.a [data-action=compare-d][data-delta="1"]'); if (!(await b.isDisabled())) await b.click(); }
  expect((await S()).compare.a.d === 12 && await page.locator('#cmp-inputs .ab-block.a [data-action=compare-d][data-delta="1"]').isDisabled(), '분모 12에서 + 비활성');
  // 같은 분모 → 토스트 + 3단계
  await chipA(2, 5); await chipB(3, 5);
  await page.click('[data-action=cmp-start]'); await sleep(200);
  s = await S(); expect(s.compare.step === 3 && (await toasts()).some(t => t.includes('이미 분모가 같아요')), '같은 분모 → 토스트 + 바로 3단계');
  f = await txt('.cmp-formula'); expect(f.includes('2/5 < 3/5 → 2/5 < 3/5') && f.includes('차이: 1/5'), '같은 분모 비교식 ' + norm(f));
  await page.click('[data-action=cmp-reset]');
  // 같음(=) 비교와 L>48
  await chipA(1, 2); await act('compareSet', 'b', 2, 4);
  await page.click('[data-action=cmp-auto]'); await sleep(2500);
  s = await S(); f = await txt('.cmp-formula');
  expect(s.compare.step === 3 && f.includes('2/4 = 2/4 → 1/2 = 2/4') && f.includes('차이: 0/4'), '자동 재생 완료, 1/2 = 2/4, 차이 0/4: ' + norm(f));
  await page.click('[data-action=cmp-reset]');
  await act('compareSet', 'a', 4, 7); await act('compareSet', 'b', 4, 9);
  await page.click('[data-action=cmp-start]'); await sleep(450); await page.click('[data-action=cmp-next]'); await sleep(450); await page.click('[data-action=cmp-next]'); await sleep(100);
  expect(await page.locator('.cmp-bars [data-who=a] .div.thin').count() === 62 && await page.locator('.cmp-bars .cell-label').count() === 0 && (await txt('.cmp-formula')).includes('36/63 > 28/63'), 'L=63>48: 분할선 가늘게·라벨 생략·식 정확');
  expect(await page.locator('.cmp-line .tick').count() === 2, 'L>48 수직선은 정수 눈금만');
  await shot('compare-63');
  // 바꾸기·초기화
  await page.click('[data-action=cmp-swap]');
  s = await S(); expect(s.compare.a.d === 9 && s.compare.b.d === 7 && s.compare.step === 0, '바꾸기(A↔B) + 0단계');
  await page.click('[data-action=cmp-clear]');
  s = await S(); expect(s.compare.a.n === 2 && s.compare.a.d === 3 && s.compare.b.n === 3 && s.compare.b.d === 5, '초기화 → 기본값');
  // 가분수 입력 시 수직선 범위 확장
  await act('compareSet', 'a', 7, 4);
  expect(await page.locator('.cmp-line .tick-label.int').count() === 3 && await page.locator('.cmp-bars [data-who=a] .bar-frame').count() === 2, '7/4 → 수직선 0~2, 막대 2단위');
  await page.click('[data-action=cmp-clear]');

  // ---------- 분수 키패드 ----------
  await page.click('#cmp-inputs .ab-block.a [data-action=compare-keypad]'); await sleep(150);
  expect(await modalCount() === 1 && (await txt('.modal')).includes('A 분수 입력') && await page.locator('.kp-pad [data-k]').count() === 12 && await page.locator('.kp-chips .chip').count() === 12, '키패드 모달: 숫자 12키(0~9,←,모두 지우기)·칩 12');
  expect((await page.locator('.kp-field[data-f=n]').getAttribute('class')).includes('active'), '분자 필드 활성');
  await page.click('.kp-field[data-f=d]'); await page.click('.kp-pad [data-k="0"]'); await sleep(50);
  expect((await txt('.kp-msg')).includes('분모는 2~12') && await page.locator('.modal-foot .btn.primary').isDisabled(), '분모 0 → 오류·확인 비활성');
  await page.click('.kp-pad [data-k="back"]'); await page.click('.kp-pad [data-k="1"]'); await page.click('.kp-pad [data-k="5"]'); await sleep(50);
  expect((await txt('.kp-msg')).includes('분모는 2~12'), '분모 15 → 오류');
  await page.click('.kp-pad [data-k="clear"]');
  await page.click('.kp-field[data-f=w]'); await page.click('.kp-pad [data-k="3"]'); await sleep(50);
  await page.click('.kp-field[data-f=n]'); await page.click('.kp-pad [data-k="1"]'); await page.click('.kp-field[data-f=d]'); await page.click('.kp-pad [data-k="4"]'); await sleep(50);
  expect((await txt('.kp-msg')).includes('자연수는 0~2'), '자연수 3 → 오류');
  await page.click('.kp-field[data-f=w]'); await page.click('.kp-pad [data-k="2"]'); await sleep(50);
  await page.click('.kp-field[data-f=n]'); await page.click('.kp-pad [data-k="5"]'); await sleep(50);
  expect((await txt('.kp-msg')).includes('분자는 0~3×분모'), '2 5/4 = 13/4 > 12 → 오류');
  await page.click('.kp-field[data-f=n]'); await page.click('.kp-pad [data-k="3"]'); await sleep(50);
  const pv = await txt('.kp-preview'); expect(pv.includes('11/4') && pv.includes('2.75') && !(await page.locator('.modal-foot .btn.primary').isDisabled()), '2 3/4 미리보기 11/4 · 2.75: ' + norm(pv));
  await page.click('.modal-foot .btn.primary'); await sleep(150);
  s = await S(); expect(s.compare.a.n === 11 && s.compare.a.d === 4 && await modalCount() === 0, '키패드 확인 → A = 11/4');
  expect((await txt('#cmp-inputs .ab-block.a .ab-val')).includes('11/4'), 'A 값 표시 11/4');
  // 키패드 칩·키보드·취소
  await page.click('#cmp-inputs .ab-block.b [data-action=compare-keypad]'); await sleep(150);
  await page.click('.kp-chips [data-chip="5/6"]'); await sleep(50);
  expect((await txt('.kp-preview')).includes('5/6'), '키패드 칩 5/6');
  await page.click('.modal-foot .btn:not(.primary)'); await sleep(100);
  s = await S(); expect(s.compare.b.n === 3 && s.compare.b.d === 5 && await modalCount() === 0, '취소 → B 불변');
  await page.click('#cmp-inputs .ab-block.b [data-action=compare-keypad]'); await sleep(150);
  await page.keyboard.type('7/8'); await page.keyboard.press('Enter'); await sleep(150);
  s = await S(); expect(s.compare.b.n === 7 && s.compare.b.d === 8, '키보드 7/8 + Enter → B = 7/8');
  await page.click('#cmp-inputs .ab-block.b [data-action=compare-keypad]'); await sleep(150);
  await page.keyboard.type('abc<>'); await sleep(50);
  expect((await txt('.kp-preview')).includes('7/8'), '키패드 비숫자 입력 무시');
  await page.keyboard.press('Escape'); await sleep(100);
  expect(await modalCount() === 0, 'ESC로 키패드 닫힘');
  // 모달 배경 클릭 닫기 + 포커스 복귀
  await page.click('#cmp-inputs .ab-block.a [data-action=compare-keypad]'); await sleep(150);
  await page.mouse.click(5, 400); await sleep(100);
  expect(await modalCount() === 0, '배경 클릭으로 모달 닫힘');
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.dataset.action);
  expect(focused === 'compare-keypad', '모달 닫힌 뒤 원래 버튼으로 포커스 복귀 (' + focused + ')');

  // ---------- 비교 → 덧셈·뺄셈 A·B 이어짐 ----------
  await chipA(3, 4); await act('compareSet', 'b', 1, 6);
  await page.click('[data-tab=arith]'); await sleep(150);
  s = await S(); expect(s.tab === 'arith' && s.arith.a.n === 3 && s.arith.a.d === 4 && s.arith.b.n === 1 && s.arith.b.d === 6, '비교 탭의 A·B가 연산 탭으로 이어짐');
  expect(!(await page.locator('[data-view=arith]').isHidden()), '덧셈·뺄셈 탭 열림');
  expect(await page.locator('[data-action=ar-mirror]').isDisabled(), '오개념 거울: 결과 단계 전 비활성');
  // 3/4 − 1/6 단계별
  await page.click('[data-action=ar-op][data-op="-"]'); await sleep(50);
  expect((await S()).arith.op === '-' && (await page.locator('[data-action=ar-op][data-op="-"]').getAttribute('aria-pressed')) === 'true', '연산 − 토글');
  await page.click('[data-action=ar-next]'); await sleep(500);
  s = await S(); expect(s.arith.step === 1 && await page.locator('.ar-bars [data-who=a] .cell').count() === 12 && await page.locator('.ar-bars [data-who=b] .cell').count() === 12, '① 통분: 12등분');
  expect(await page.locator('.ar-steps li.active').count() === 1 && (await txt('.ar-steps li.active')).includes('통분'), '단계 표시기 ① 강조');
  let fm = norm(await txt('.ar-formula')); expect(fm.includes('3/4 − 1/6 = 9/12 − 2/12') && !fm.includes('7/12'), '① 식 9/12 − 2/12: ' + fm);
  await page.click('[data-action=ar-next]'); await sleep(100);
  expect(await page.locator('.ar-bars .moving').count() === 1, '② 뺄셈 B 칸 그룹 이동 중');
  await sleep(1400);
  expect(await page.locator('.ar-bars .moving').count() === 0 && await page.locator('.ar-bars [data-who=r] .cell.on').count() === 7 && await page.locator('.ar-bars [data-who=r] .cell.hl').count() === 7, '② 지우기 완료: 결과 7칸 강조');
  await page.click('[data-action=ar-next]'); await sleep(300);
  fm = norm(await txt('.ar-formula')); s = await S();
  expect(s.arith.step === 3 && fm.endsWith('= 7/12'), '③ 결과 7/12: ' + fm);
  expect(await page.locator('[data-action=ar-next]').isDisabled() && (await page.locator('.ar-steps li').nth(3).getAttribute('class')).includes('skip'), '약분 불가 → 다음 비활성·④ 생략 표시');
  await shot('arith-sub');

  // ---------- AC7 1/2 + 1/3 ----------
  await act('arithSet', 'a', 1, 2); await act('arithSet', 'b', 1, 3); await act('arithOp', '+');
  s = await S(); expect(s.arith.step === 0, '입력 변경 → 0단계');
  for (let i = 0; i < 3; i++) { await page.click('[data-action=ar-next]'); await sleep(800); }
  fm = norm(await txt('.ar-formula'));
  expect(fm === '1/2 + 1/3 = 3/6 + 2/6 = 5/6', 'AC7 식 전개 "1/2 + 1/3 = 3/6 + 2/6 = 5/6": ' + fm);
  expect(await page.locator('.ar-bars [data-who=r] .cell').count() === 6 && await page.locator('.ar-bars [data-who=r] .cell.on').count() === 5, 'AC7 결과 막대 6칸 중 5칸');
  // 오개념 거울 (AC8 후반)
  expect(!(await page.locator('[data-action=ar-mirror]').isDisabled()), '결과 단계 후 거울 활성');
  await page.click('[data-action=ar-mirror]'); await sleep(200);
  const ml = await txt('.ar-mirror-label');
  expect(ml === '분자끼리·분모끼리 더하면 2/5 — 실제 결과 5/6과의 차이: 13/30', 'AC8 오개념 거울 라벨: ' + ml);
  expect(await page.locator('.ar-bars .cell.on.f-w').count() === 2 && await page.locator('.ar-bars .cell.f-w').count() === 5 && await page.locator('.ar-bars .div.faint').count() === 29, 'AC8 빨간 막대 2/5 + 공통 분할선(30등분)');
  const wrongFill = await page.evaluate(() => getComputedStyle(document.querySelector('.ar-bars .cell.on.f-w')).fill);
  expect(/url\(|hatch|rgb\(239, 68, 68\)/.test(wrongFill), 'AC8 오개념 막대 빨간/빗금 채움: ' + wrongFill);
  await shot('arith-mirror');
  // 학생 모드에서 거울 숨김
  await act('setTeacher', false); await sleep(100);
  expect(await page.locator('[data-action=ar-mirror]').isHidden() && await page.locator('.ar-mirror-label').isHidden(), '학생 모드: 거울 토글·라벨 숨김');
  await act('setTeacher', true); await sleep(100);
  expect(!(await page.locator('.ar-mirror-label').isHidden()), '교사 모드 복귀 시 거울 라벨 복원');
  // 3/4 + 3/4
  await act('arithSet', 'a', 3, 4); await act('arithSet', 'b', 3, 4);
  expect((await S()).arith.mirror === false, '입력 변경 시 거울 해제');
  await page.click('[data-action=ar-next]'); await sleep(100);
  s = await S(); expect(s.arith.step === 2 && (await page.locator('.ar-steps li').first().getAttribute('class')).includes('skip'), '같은 분모 → ① 자동 통과, 2단계');
  await sleep(900);
  await page.click('[data-action=ar-next]'); await sleep(300);
  fm = norm(await txt('.ar-formula')); s = await S();
  expect(s.arith.step === 3 && fm === '3/4 + 3/4 = 6/4 = 1 2/4', 'AC7 결과 단계 "6/4 = 1 2/4": ' + fm);
  expect(await page.locator('.ar-bars [data-who=r] .bar-frame').count() === 2 && await page.locator('.ar-bars [data-who=r] .bar-frame.flash').count() === 2, 'AC7 결과 막대 2단위 + 경계 번쩍임');
  expect(!(await page.locator('[data-action=ar-next]').isDisabled()), '약분 가능 → 다음 활성');
  await page.click('[data-action=ar-next]'); await sleep(600);
  fm = norm(await txt('.ar-formula'));
  expect(fm === '3/4 + 3/4 = 6/4 = 1 2/4 = 1 1/2' && await page.locator('.ar-bars [data-who=r] .cell').count() === 4, 'AC7 약분 단계 "= 1 1/2", 결과 막대 2등분×2: ' + fm);
  expect(await page.locator('[data-action=ar-next]').isDisabled() && await page.locator('[data-action=ar-auto]').isDisabled(), '④ 이후 다음·자동 재생 비활성');
  await shot('arith-add-mixed');
  // 자동 재생
  await page.click('[data-action=ar-reset]');
  s = await S(); expect(s.arith.step === 0, '처음으로 → 0단계');
  await act('arithSet', 'a', 2, 3); await act('arithSet', 'b', 5, 6);
  await page.click('[data-action=ar-auto]'); await sleep(200);
  s = await S(); const midStep = s.arith.step;
  await sleep(5000);
  s = await S(); fm = norm(await txt('.ar-formula'));
  expect(s.arith.step === 4 && fm === '2/3 + 5/6 = 4/6 + 5/6 = 9/6 = 1 3/6 = 1 1/2', '자동 재생 4단계 완료: ' + fm);
  // 자동 재생 중 입력 → 중단
  await page.click('[data-action=ar-reset]'); await page.click('[data-action=ar-auto]'); await sleep(300);
  await act('arithSet', 'b', 1, 6); await sleep(2500);
  s = await S(); expect(s.arith.step === 0 && s.arith.b.n === 1, '자동 재생 중 입력 변경 → 재생 중단·0단계');

  // ---------- AC8 뺄셈 A<B 모달 ----------
  await act('arithSet', 'a', 1, 3); await act('arithSet', 'b', 1, 2); await act('arithOp', '-');
  await page.click('[data-action=ar-next]'); await sleep(200);
  expect(await modalCount() === 1 && (await txt('.modal')).includes('앞의 분수가 더 작아요. 자리를 바꿀까요?'), 'AC8 자리 바꾸기 모달');
  const btns = await page.locator('.modal-foot .btn').allInnerTexts();
  expect(btns.includes('바꾸기') && btns.includes('취소'), 'AC8 모달 버튼 [바꾸기/취소]: ' + btns.join(','));
  await page.click('.modal-foot .btn:not(.primary)'); await sleep(100);
  s = await S(); expect(s.arith.step === 0 && s.arith.a.n === 1 && s.arith.a.d === 3, '취소 → 진행 안 함·교환 안 함');
  await page.click('[data-action=ar-next]'); await sleep(200); await page.click('.modal-foot .btn.primary'); await sleep(600);
  s = await S(); expect(s.arith.a.n === 1 && s.arith.a.d === 2 && s.arith.b.n === 1 && s.arith.b.d === 3 && s.arith.step === 1, 'AC8 바꾸기 → A=1/2, B=1/3, 1단계 진행');
  await page.click('[data-action=ar-next]'); await sleep(1400); await page.click('[data-action=ar-next]'); await sleep(300);
  fm = norm(await txt('.ar-formula'));
  expect(fm === '1/2 − 1/3 = 3/6 − 2/6 = 1/6' && await page.locator('.ar-bars [data-who=r] .cell.on').count() === 1, 'AC8 결과 1/6: ' + fm);
  // A<B 뺄셈에서 자동 재생도 모달
  await act('arithSet', 'a', 1, 4); await act('arithSet', 'b', 1, 2);
  await page.click('[data-action=ar-auto]'); await sleep(200);
  expect(await modalCount() === 1, '자동 재생도 A<B 모달');
  await page.keyboard.press('Escape'); await sleep(100);
  expect(await modalCount() === 0 && (await S()).arith.step === 0, 'ESC → 모달 닫힘·진행 안 함');
  // A = B 뺄셈 → 0
  await act('arithSet', 'a', 1, 2); await act('arithSet', 'b', 2, 4);
  for (let i = 0; i < 3; i++) { await page.click('[data-action=ar-next]'); await sleep(900); }
  fm = norm(await txt('.ar-formula')); s = await S();
  expect(s.arith.step === 3 && fm.endsWith('= 0/4') && await page.locator('.ar-bars [data-who=r] .cell.on').count() === 0, 'A=B 뺄셈 결과 0/4, 결과 막대 비어 있음: ' + fm);
  // 뺄셈 오개념 거울 음수 문구
  await act('arithSet', 'a', 3, 4); await act('arithSet', 'b', 2, 3); await act('arithOp', '-');
  for (let i = 0; i < 3; i++) { await page.click('[data-action=ar-next]'); await sleep(900); }
  fm = norm(await txt('.ar-formula')); expect(fm.endsWith('= 1/12'), '3/4 − 2/3 = 1/12: ' + fm);
  await page.click('[data-action=ar-mirror]'); await sleep(150);
  expect(await page.locator('.ar-bars .cell.f-w').count() === 7 && (await txt('.ar-mirror-label')).includes('1/7'), '뺄셈 거울: 분자끼리·분모끼리 1/7 막대 표시');
  await act('arithSet', 'a', 1, 2); await act('arithSet', 'b', 2, 5);
  for (let i = 0; i < 3; i++) { await page.click('[data-action=ar-next]'); await sleep(900); }
  await page.click('[data-action=ar-mirror]'); await sleep(150);
  const mln = await txt('.ar-mirror-label');
  expect(mln.includes('이 방법으로는 뺄 수도 없어요') && await page.locator('.ar-bars .cell.f-w').count() === 0, '뺄셈 분자끼리 음수(1−2) → 문구만: ' + mln);
  // 가분수 입력(대분수 키패드) 결과 3단위
  await act('arithSet', 'a', 9, 4); await act('arithSet', 'b', 3, 4); await act('arithOp', '-');
  expect((await txt('#ar-inputs .ab-block.a .ab-val')).includes('9/4') && (await page.locator('#ar-inputs .ab-block.a .fr-w').innerText()) === '2', 'A 표시 2 1/4 (9/4)');
  for (let i = 0; i < 3; i++) { await page.click('[data-action=ar-next]'); await sleep(900); }
  fm = norm(await txt('.ar-formula')); expect(fm === '9/4 − 3/4 = 6/4 = 1 2/4 = 1 1/2', '2 1/4 − 3/4 → 1 1/2: ' + fm);
  await act('arithSet', 'a', 12, 5); await act('arithSet', 'b', 3, 5); await act('arithOp', '+');
  expect(await page.locator('.ar-bars [data-who=r] .bar-frame').count() === 3, '12/5 + 3/5 = 15/5 → 결과 막대 3단위');
  // 연산 탭 되돌리기(단계 진행도 확정 이벤트)
  await act('arithSet', 'a', 1, 2); await act('arithSet', 'b', 1, 3);
  await page.click('[data-action=ar-next]'); await sleep(500);
  await page.keyboard.press('Control+z');
  s = await S(); expect(s.arith.step === 0, 'Ctrl+Z → 단계 진행 되돌리기');
  await page.keyboard.press('Control+z');
  s = await S(); expect(s.arith.b.n === 3 && s.arith.b.d === 5, 'Ctrl+Z → B 입력 되돌리기(이전 값 3/5)');

  // ---------- 비교 탭 → 연산 탭 복귀 시 덮어쓰기 여부 ----------
  await act('arithSet', 'a', 5, 6); await act('arithSet', 'b', 1, 6);
  await page.click('[data-tab=compare]'); await sleep(100); await page.click('[data-tab=arith]'); await sleep(100);
  s = await S();
  log('compare→arith 재진입 후 arith A/B: ' + JSON.stringify({ a: s.arith.a, b: s.arith.b, compare: { a: s.compare.a, b: s.compare.b } }));
  expect(s.arith.a.n === 5 && s.arith.a.d === 6 && s.arith.b.n === 1, '[스펙 해석] 비교 탭을 들렀다 돌아와도 연산 탭의 직접 입력값(5/6, 1/6)이 유지되는가');

  // ---------- 새로고침 복원 ----------
  await act('arithSet', 'a', 2, 3); await act('arithSet', 'b', 1, 4); await act('arithOp', '-');
  await page.click('[data-action=ar-next]'); await sleep(500);
  await reload();
  s = await S(); expect(s.tab === 'arith' && s.arith.a.n === 2 && s.arith.b.d === 4 && s.arith.op === '-' && s.arith.step === 1, '새로고침 후 연산 탭·입력·단계 복원 ' + JSON.stringify(s.arith));
  expect(await page.locator('.ar-bars [data-who=a] .cell').count() === 12, '새로고침 후 통분 상태 렌더');
};
