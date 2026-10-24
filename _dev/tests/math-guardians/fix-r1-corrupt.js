// fix-r1-corrupt.js — 손상 저장 데이터 복구 경로 단독 재현(.corrupt 보관·재시딩·토스트), 대기 중 저장이 있을 때/없을 때 비교
'use strict';
module.exports = async ({ page, expect, log, sleep, reload }) => {
  const toasts = () => page.locator('#toast-root .toast').allInnerTexts();
  await page.waitForSelector('#stage-grid .stage-card');
  // A. 대기 중 저장 없음
  await page.evaluate(() => { window.__app.actions.flushSave(); localStorage.setItem('mathGuardians.v1', '{broken json'); });
  await reload(); await sleep(300);
  let t = await toasts(); let kept = await page.evaluate(() => localStorage.getItem('mathGuardians.v1.corrupt')); let n = (await page.evaluate(() => window.__app.getState())).profiles.length;
  log(`A: toasts=${JSON.stringify(t)} kept=${JSON.stringify(kept)} profiles=${n}`);
  expect(kept === '{broken json' && n === 24 && t.some(x => x.includes('손상')), 'A. 손상 데이터 → .corrupt 보관 + 재시딩 + 토스트');
  // B. 설정 변경 직후(디바운스 대기 중) 외부에서 손상 값을 쓰고 새로고침 → pagehide flush가 덮어쓰는지 관찰
  await page.evaluate(() => { localStorage.removeItem('mathGuardians.v1.corrupt'); window.__app.actions.setSetting('lowSpec', true); localStorage.setItem('mathGuardians.v1', '{broken json'); });
  await reload(); await sleep(300);
  t = await toasts(); kept = await page.evaluate(() => localStorage.getItem('mathGuardians.v1.corrupt'));
  const raw = await page.evaluate(() => (localStorage.getItem('mathGuardians.v1') || '').slice(0, 20));
  log(`B: toasts=${JSON.stringify(t)} kept=${JSON.stringify(kept)} raw=${raw}`);
};
