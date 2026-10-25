// should/nice 기능 동작 확인: 어림 모드, 키패드, 카드 편집 유효성, 세트 저장, 학년 프리셋, 장면 이름 바꾸기/복제/삭제, 샘플 복원, PNG 다이얼로그
module.exports = async ({ page, expect, shot, log, sleep }) => {
  const S = () => page.evaluate(() => window.__app.getState());
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  // 어림해서 찍기
  await act('kitSetD', 8); await act('kitSetN', 1);
  await page.click('[data-action=estimate]'); await sleep(150);
  await page.fill('#est-n', '5'); await page.click('.modal-foot .btn.primary'); await sleep(150);
  let s = await S(); expect(s.estimate && s.estimate.target.n === 5, '어림 모드 시작(목표 5/8)');
  expect(await page.locator('.kit-line .tick-label:not(.int)').count() === 0, '어림 모드: 분수 눈금 숨김');
  const box = await page.locator('.kit-line').boundingBox();
  await page.mouse.click(box.x + box.width * (36 + 928 * 0.63) / 1000, box.y + box.height / 2); await sleep(450);
  const msg = await page.locator('.est-msg').innerText(); expect(/정확해요|가까워요/.test(msg), '어림 피드백: ' + msg);
  expect(await page.locator('.kit-line .pt.f-r').count() === 1, '정답 초록 점 표시');
  await page.click('[data-action=est-again]'); await sleep(100);
  await page.click('.kit-estimate [data-action=estimate]'); s = await S(); expect(!s.estimate, '어림 끝내기');
  // 키패드
  await page.click('[data-tab=compare]'); await page.click('#cmp-inputs .ab-block.a [data-action=compare-keypad]'); await sleep(150);
  await page.keyboard.type('1/6'); await sleep(50);
  expect(!(await page.locator('.modal-foot .btn.primary').isDisabled()), '키패드 1/6 유효');
  await page.keyboard.press('Enter'); await sleep(150);
  s = await S(); expect(s.compare.a.n === 1 && s.compare.a.d === 6, '키패드 입력 반영 1/6');
  await page.click('#cmp-inputs .ab-block.b [data-action=compare-keypad]'); await sleep(150);
  await page.click('.kp-field[data-f=d]'); await page.click('.kp-pad [data-k="1"]'); await page.click('.kp-pad [data-k="5"]'); await sleep(50);
  expect((await page.locator('.kp-msg').innerText()).includes('분모는 2~12') && await page.locator('.modal-foot .btn.primary').isDisabled(), '키패드 분모 15 오류');
  await page.keyboard.press('Escape'); await sleep(100);
  // 카드 편집 유효성
  await page.click('[data-tab=cards]'); await page.click('[data-action=card-new]'); await sleep(200);
  expect(await page.locator('.modal-foot .btn.primary').isDisabled() && (await page.locator('#ef-err').innerText()).includes('질문'), '새 카드: 빈 질문 → 저장 비활성');
  await page.fill('#ef-q', '테스트 질문'); await page.fill('[data-ch="0"]', '1/2'); await page.fill('[data-ch="1"]', '1/3'); await page.check('input[name=ef-ans][value="0"]'); await sleep(100);
  expect(!(await page.locator('.modal-foot .btn.primary').isDisabled()), '새 카드: 유효 → 저장 활성');
  await page.click('.modal-foot .btn.primary'); await sleep(200);
  s = await S(); expect(s.counts.cards === 25, '새 카드 저장(25장)');
  await page.check('#card-list [data-check="c5-01"]'); await page.check('#card-list [data-check="c5-02"]');
  await page.click('[data-action=set-save]'); await sleep(150); await page.fill('#set-name', '테스트 세트'); await page.click('.modal-foot .btn.primary'); await sleep(200);
  s = await S(); expect(s.counts.cardSets === 3 && s.currentSetId && s.currentSetId.startsWith('cs-'), '세트 저장(3개)');
  await page.click('[data-del="c5-01"]'); await sleep(150); await page.click('.modal-foot .btn.primary'); await sleep(200);
  s = await S(); expect(s.counts.cards === 24, '카드 삭제');
  // 학년 프리셋
  await page.click('#more-menu summary'); await page.selectOption('#grade-preset', '3'); await sleep(200);
  const g = await page.evaluate(() => ({ max: document.querySelector('#kit-d').max, arithHidden: document.querySelector('[data-tab=arith]').hidden, grade: document.documentElement.dataset.grade }));
  expect(g.max === '10' && g.arithHidden && g.grade === '3', '3학년 프리셋 ' + JSON.stringify(g));
  await page.selectOption('#grade-preset', ''); await sleep(100); await page.evaluate(() => { document.querySelector('#more-menu').open = false; });
  // 장면 이름 바꾸기·복제·삭제·샘플 복원
  await page.click('[data-tab=scenes]'); await sleep(100);
  await page.click('.scene-card[data-id="sc-b01"] [data-sc=dup]'); await sleep(150);
  s = await S(); expect(s.counts.scenes === 13, '복제 → 13');
  await page.click('.scene-card[data-id="sc-b01"] [data-sc=rename]'); await sleep(150); await page.fill('#rn-name', '바뀐 이름'); await page.click('.modal-foot .btn.primary'); await sleep(150);
  expect(await page.locator('.scene-card:has-text("바뀐 이름")').count() === 1, '이름 바꾸기');
  await page.click('.scene-card[data-id="sc-b01"] [data-sc=del]'); await sleep(150); await page.click('.modal-foot .btn.primary'); await sleep(150);
  s = await S(); expect(s.counts.scenes === 12, '삭제 → 12');
  await page.click('.scene-tools [data-action=reset-samples]'); await sleep(150); await page.click('.modal-foot .btn.primary'); await sleep(200);
  s = await S(); expect(s.counts.scenes === 13 && s.counts.cards === 25 && s.counts.cardSets === 3, '샘플 복원: 내장 복구 + 사용자 항목 유지 ' + JSON.stringify(s.counts));
  await shot('scenes');
  // 전체화면 대체·테마·도움말·PNG 다이얼로그
  await page.click('[data-tab=kit]');
  await page.click('#btn-theme'); expect(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', '테마 토글 dark');
  await page.click('#btn-theme');
  await page.click('.logo'); await sleep(150); expect((await page.locator('.modal').innerText()).includes('사용법'), '도움말 모달'); await page.keyboard.press('Escape');
  await page.click('#more-menu summary'); await page.click('[data-action=png]'); await sleep(150);
  expect((await page.locator('.modal').innerText()).includes('펜 주석'), 'PNG 다이얼로그'); await page.keyboard.press('Escape');
  // 자동 재생(비교)
  await page.click('[data-tab=compare]'); await act('compareSet', 'a', 2, 3); await act('compareSet', 'b', 3, 4);
  await page.click('[data-action=cmp-auto]'); await sleep(2500);
  s = await S(); expect(s.compare.step === 3, '비교 자동 재생 완료');
  await page.click('[data-tab=arith]'); await act('arithSet', 'a', 2, 3); await act('arithSet', 'b', 5, 6); await act('arithOp', '+');
  await page.click('[data-action=ar-auto]'); await sleep(5000);
  s = await S(); expect(s.arith.step === 4, '덧셈 자동 재생 4단계 완료(step=' + s.arith.step + ')');
  await shot('arith-auto');
};
