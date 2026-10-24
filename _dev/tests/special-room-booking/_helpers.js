// 특별실지기 QA 공통 도우미 (func-*.js 모듈에서 require)
'use strict';
module.exports = ({ page, sleep }) => {
  const $ = (sel, opts) => page.locator(sel, opts);
  const modal = () => $('.modal-backdrop:not(.closing) .modal').last();
  const modalCount = () => $('.modal-backdrop:not(.closing)').count();
  const state = () => page.evaluate(() => window.__app.getState());
  const startSample = async () => { if (await $('[data-result="sample"]').count()) { await $('[data-result="sample"]').click(); await sleep(450); } };
  const closeModal = async () => { await page.keyboard.press('Escape'); await sleep(260); };
  const closeAll = async () => { for (let i = 0; i < 6 && (await modalCount()); i++) { await page.keyboard.press('Escape'); await sleep(220); } };
  const tab = async name => { await $(`.tabs [data-tab="${name}"]`).click(); await sleep(260); };
  const lastToast = async () => ((await $('.toast').count()) ? await $('.toast').last().textContent() : '');
  const noHScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 && document.body.scrollWidth <= document.documentElement.clientWidth + 1);
  return { $, modal, modalCount, state, startSample, closeModal, closeAll, tab, lastToast, noHScroll };
};
