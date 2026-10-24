// func-card-layout.js — 교정 카드 모달 레이아웃: 점 배열 행 수(2~9)별로 '발사' 버튼이 모달 가시 영역 안에 있는지 1280×800·1024×768·400×800에서 측정 (pw-run.js 모듈)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep }) => {
  // showCard와 같은 구조(.card-modal > .card-q + .hint-box + .card-pad)를 앱 API로 재현
  const open = (rows, cols) => page.evaluate(([rows, cols]) => {
    const MG = window.__app.MG; document.querySelectorAll('.modal-backdrop').forEach(e => e.remove());
    const body = document.createElement('div'); body.className = 'card-body';
    body.innerHTML = `<div class="card-q">${rows} × ${cols} = ?</div><div class="hint-box"></div><div class="card-pad"></div>`;
    MG.UI.renderHint(body.querySelector('.hint-box'), { model: 'array', data: { rows, cols } });
    MG.UI.openModal({ title: '🛡 다시 생각해 봐요', body, persistent: true, wide: true, cls: 'card-modal', actions: [], onOpen: () => { MG.Pad.create(body.querySelector('.card-pad'), 'number', { onFire: () => {}, onChoose: () => {} }); } });
  }, [rows, cols]);
  const measure = () => page.evaluate(() => { const m = document.querySelector('.card-modal').getBoundingClientRect(), f = document.querySelector('.card-modal .key-fire').getBoundingClientRect(); return { modalBottom: Math.round(m.bottom), fireBottom: Math.round(f.bottom), fireTop: Math.round(f.top), vh: innerHeight, scrollable: document.querySelector('.card-modal').scrollHeight > document.querySelector('.card-modal').clientHeight }; });
  for (const [w, h] of [[1280, 800], [1024, 768], [400, 800]]) {
    await page.setViewportSize({ width: w, height: h });
    const res = {};
    for (const rows of [2, 5, 7, 9]) { await open(rows, 8); await sleep(350); res[rows] = await measure(); if (rows === 9) await shot(`card-layout-${w}x${h}-rows9`); }
    log(`${w}×${h}: ${JSON.stringify(res)}`);
    for (const rows of [2, 5, 7, 9]) expect(res[rows].fireBottom <= res[rows].modalBottom + 1, `${w}×${h} 점 배열 ${rows}행: 발사 버튼이 스크롤 없이 보임 (버튼 하단 ${res[rows].fireBottom} ≤ 모달 하단 ${res[rows].modalBottom})`);
  }
  await page.evaluate(() => document.querySelectorAll('.modal-backdrop').forEach(e => e.remove()));
};
