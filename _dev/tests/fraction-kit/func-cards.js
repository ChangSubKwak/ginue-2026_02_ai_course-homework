// func-cards.js — 탐구 카드(예측-확인·커튼·자동 재생·학급 집계·세트·필터·편집·삭제·XSS) 검증 (AC9, AC10)
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const S = () => page.evaluate(() => window.__app.getState());
  const txt = sel => page.locator(sel).first().innerText();
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const toasts = () => page.evaluate(() => [...document.querySelectorAll('#toast-root .toast')].map(t => t.textContent));
  const modalCount = () => page.locator('.modal[role=dialog]').count();
  const norm = s => s.replace(/\s+/g, ' ').trim();
  let s;

  await page.click('.tabs [data-tab=cards]'); await sleep(200);
  expect(!(await page.locator('[data-view=cards]').isHidden()), '탐구 카드 탭 열림');
  expect(await page.locator('#card-list .card-item').count() === 24, '카드 목록 24장');
  const opts = await page.locator('#card-set option').allInnerTexts();
  expect(opts.length === 3 && opts[0].includes('24') && opts[1].includes('5-1 약분과 통분 도입 (6)') && opts[2].includes('4-2 분수의 덧셈과 뺄셈 1차시 (5)'), '세트 드롭다운: 전체 + 세트 2개: ' + opts.join(' | '));
  s = await S(); expect(s.currentCardId === 'c3-01', '첫 카드 c3-01 자동 선택');
  expect((await txt('#card-view')).includes('피자 한 판') && await page.locator('#card-view .choice').count() === 3, '카드 뷰 질문·선택지 3개');
  expect(await page.locator('#card-view .choice .fr').count() >= 3, '선택지 분수 가로 분수 렌더');
  expect(await page.locator('#card-stage .kit-circle .cell').count() === 4 && await page.locator('#card-stage .curtained').count() === 2, 'c3-01(원 모델) 작업판 4등분 + 기호·식 커튼');
  expect(await page.locator('[data-card=confirm]').isDisabled(), '예측 전 확인 비활성');

  // ---------- 학년 필터·검색 ----------
  await page.click('#card-grade [data-grade="4"]'); await sleep(100);
  expect(await page.locator('#card-list .card-item').count() === 8 && (await page.locator('#card-grade [data-grade="4"]').getAttribute('aria-pressed')) === 'true', '4학년 필터 8장');
  await page.fill('#card-search', '대분수'); await sleep(100);
  expect(await page.locator('#card-list .card-item').count() === 1, '검색 "대분수" → 1장');
  await page.fill('#card-search', ''); await page.click('#card-grade [data-grade=""]'); await sleep(100);
  expect(await page.locator('#card-list .card-item').count() === 24, '필터 해제 24장');

  // ---------- AC9 c3-03 예측-확인 ----------
  await page.click('[data-pick="c3-03"]'); await sleep(200);
  s = await S(); expect(s.currentCardId === 'c3-03', 'c3-03 선택');
  expect((await txt('#card-view .card-q-big')) === '1/3과 1/4 중 어느 쪽이 클까?', 'AC9 질문 표시');
  expect(await page.locator('#card-stage .cmp-bars [data-who=a] .cell').count() === 3 && await page.locator('#card-stage .cmp-bars [data-who=b] .cell').count() === 4, 'AC9 작업판 두 막대 3·4등분');
  const curtain = await page.evaluate(() => { const e = document.querySelector('#card-stage .cmp-formula'); return { cls: e.className, after: getComputedStyle(e, '::after').content }; });
  expect(curtain.cls.includes('curtained') && curtain.after.includes('커튼'), 'AC9 식 영역 커튼 가림: ' + JSON.stringify(curtain));
  await page.click('#card-view .choice[data-choice="1"]'); await sleep(100);
  expect((await txt('.predict-badge')).includes('예측') && (await page.locator('#card-view .choice[data-choice="1"]').getAttribute('class')).includes('picked'), 'AC9 예측 배지 + 선택 표시');
  expect(!(await page.locator('[data-card=confirm]').isDisabled()), 'AC9 확인 활성');
  await page.click('#card-view .choice[data-choice="0"]'); await page.click('#card-view .choice[data-choice="1"]'); await sleep(50);
  expect((await page.locator('#card-view .choice.picked').count()) === 1, '예측 변경 가능(단일 선택)');
  await page.click('[data-card=confirm]'); await sleep(150);
  expect(await page.locator('#card-stage .curtained').count() === 0, 'AC9 확인 즉시 커튼 해제');
  await sleep(2600);
  const f9 = norm(await txt('#card-stage .cmp-formula'));
  expect(f9.includes('1/3 = 4/12') && f9.includes('1/4 = 3/12') && f9.includes('4/12 > 3/12 → 1/3 > 1/4') && f9.includes('차이: 1/12'), 'AC9 통분 3단계 자동 재생 결과: ' + f9);
  expect(await page.locator('#card-stage .cmp-bars [data-who=a] .cell').count() === 12, 'AC9 막대 12등분');
  const msg = await page.locator('.result-msg').first();
  expect((await msg.innerText()).includes('예측과 달라요 — 왜 그럴까요?') && (await msg.getAttribute('class')).includes('warn'), 'AC9 주황 메시지');
  expect(await page.locator('.explain').count() === 1 && (await txt('.explain')).includes('겹쳐 보기'), 'AC9 교사용 해설 표시');
  expect(await page.locator('#card-view .choice.answer').count() === 1 && await page.locator('#card-view .choice.wrong').count() === 1 && await page.locator('#card-view .choice:disabled').count() === 3, '확인 후 정답/오답 표시·선택지 잠금');
  expect(await page.locator('[data-card=confirm]').isDisabled(), '확인 후 확인 버튼 비활성');
  await shot('cards-wrong');
  // 같은 카드 재선택 → 초기화, 정답 예측 → 초록
  await page.click('[data-pick="c3-04"]'); await page.click('[data-pick="c3-03"]'); await sleep(150);
  expect(await page.locator('#card-stage .curtained').count() > 0 && await page.locator('.result-msg').count() === 0, '카드 재선택 시 커튼·예측 초기화');
  await page.click('#card-view .choice[data-choice="0"]'); await page.click('[data-card=confirm]'); await sleep(300);
  expect((await txt('.result-msg')).includes('예측대로예요!') && (await page.locator('.result-msg').getAttribute('class')).includes('ok'), 'AC9 초록 메시지');
  // 학생 모드: 해설·집계 숨김
  await act('setTeacher', false); await sleep(100);
  expect(await page.locator('.explain').isHidden() && await page.locator('#tally-panel').isHidden() && await page.locator('[data-action=card-new]').isHidden(), '학생 모드: 해설·집계·편집 숨김');
  await act('setTeacher', true); await sleep(100);

  // ---------- AC10 학급 집계 ----------
  await page.click('[data-pick="c3-04"]'); await page.click('[data-pick="c3-03"]'); await sleep(150);
  const seeded = await page.evaluate(() => [...document.querySelectorAll('.tally-row input')].map(i => i.value));
  expect(seeded.join(',') === '9,12,3' && (await txt('.tally-head')).includes('가온초 5-2 예시'), '내장 집계 예시 9,12,3 + 라벨');
  const inp = i => page.locator(`.tally-row input[data-tally="${i}"]`);
  await inp(0).fill('0'); await inp(1).fill('0'); await inp(2).fill('0'); await sleep(50);
  let labels = await page.locator('.tally-label').allInnerTexts();
  expect(labels.every(l => l.includes('0명') && l.includes('-')), '모두 0 → 0명·백분율 -: ' + labels.join('|'));
  await page.locator('.tally-row input[data-tally="0"]').fill('9'); await page.locator('.tally-row input[data-tally="1"]').fill('12'); await page.locator('.tally-row input[data-tally="2"]').fill('3'); await sleep(100);
  const widths = await page.evaluate(() => [...document.querySelectorAll('.tally-fill')].map(e => e.style.width));
  expect(widths.join(',') === '37.5%,50%,12.5%', 'AC10 막대 폭 37.5/50/12.5%: ' + widths.join(','));
  labels = await page.locator('.tally-label').allInnerTexts();
  expect(labels[0].includes('9명') && labels[1].includes('12명') && labels[2].includes('3명') && labels[0].includes('37.5%'), 'AC10 라벨 9명·12명·3명: ' + labels.join('|'));
  expect((await txt('.tally-head')).includes('합계 24명'), '합계 24명');
  // 타이핑(키 입력) 방식
  await page.locator('.tally-row input[data-tally="2"]').click({ clickCount: 3 }); await page.keyboard.type('15'); await sleep(150);
  const typed = await page.locator('.tally-row input[data-tally="2"]').inputValue();
  expect(typed === '15', '숫자 2자리 타이핑 "15" → 값 15 (실제: ' + typed + ')');
  // 클램프: 99 초과·음수·빈 값
  await page.locator('.tally-row input[data-tally="2"]').fill('150'); await sleep(100);
  expect((await page.locator('.tally-row input[data-tally="2"]').inputValue()) === '99', '99 초과 → 99 클램프');
  await page.locator('.tally-row input[data-tally="2"]').fill('-5'); await sleep(100);
  expect((await page.locator('.tally-row input[data-tally="2"]').inputValue()) === '0', '음수 → 0');
  await page.locator('.tally-row input[data-tally="2"]').fill(''); await sleep(100);
  expect((await page.locator('.tally-row input[data-tally="2"]').inputValue()) === '0', '빈 값 → 0');
  await page.locator('.tally-row input[data-tally="2"]').fill('3'); await sleep(100);
  // 확인 후 정답 강조
  expect(await page.locator('.tally-row.correct').count() === 0, '확인 전 정답 막대 강조 없음');
  await page.click('#card-view .choice[data-choice="0"]'); await page.click('[data-card=confirm]'); await sleep(300);
  expect(await page.locator('.tally-row.correct').count() === 1 && (await page.locator('.tally-row.correct input').inputValue()) === '9', 'AC10 확인 후 정답(1/3) 막대 강조');
  await shot('cards-tally');
  await reload(); await sleep(300);
  s = await S(); expect(s.tab === 'cards' && s.currentCardId === 'c3-03', '새로고침 후 카드 탭·현재 카드 복원');
  const t10 = await page.evaluate(() => [...document.querySelectorAll('.tally-row input')].map(i => i.value));
  expect(t10.join(',') === '9,12,3', 'AC10 새로고침 후 9,12,3 유지');
  // 지우기
  await page.click('[data-tally=clear]'); await sleep(100);
  expect((await page.evaluate(() => [...document.querySelectorAll('.tally-row input')].map(i => i.value))).join(',') === '0,0,0', '집계 지우기 → 0,0,0');
  // 카드별 저장
  await page.click('[data-pick="c3-04"]'); await sleep(100); await page.locator('.tally-row input[data-tally="1"]').fill('7'); await sleep(100);
  await page.click('[data-pick="c3-03"]'); await sleep(100); await page.click('[data-pick="c3-04"]'); await sleep(100);
  expect((await page.locator('.tally-row input[data-tally="1"]').inputValue()) === '7', '집계는 카드별로 저장');

  // ---------- 세트 진행·이전/다음·처음 카드로 ----------
  await page.selectOption('#card-set', 'cs-b01'); await sleep(150);
  s = await S(); expect(s.currentSetId === 'cs-b01' && s.currentCardId === 'c5-01' && await page.locator('#card-list .card-item').count() === 6, '세트 선택 → 첫 카드 c5-01, 6장');
  expect((await txt('#card-view .card-meta')).includes('1 / 6') && await page.locator('[data-card=prev]').isDisabled(), '1/6 표시·이전 비활성');
  await page.click('[data-card=next]'); await sleep(100);
  s = await S(); expect(s.currentCardId === 'c5-02', '다음 → c5-02');
  for (let i = 0; i < 4; i++) { await page.click('[data-card=next]'); await sleep(80); }
  s = await S(); expect(s.currentCardId === 'c5-05' && (await txt('[data-card=next]')) === '처음 카드로', '마지막 카드에서 "처음 카드로"');
  await page.click('[data-card=next]'); await sleep(100);
  expect((await S()).currentCardId === 'c5-01', '처음 카드로 → c5-01');
  expect(await page.locator('[data-card=prev]').isDisabled() && (await S()).currentCardId === 'c5-01', '첫 카드에서 이전 비활성');
  // 쪼개기 카드 확인 → 사슬 재생
  await page.click('[data-pick="c5-02"]'); await sleep(100);
  expect(await page.locator('#card-stage .kit-bar .cell').count() === 12, 'c5-02 8/12 작업판');
  await page.click('#card-view .choice[data-choice="0"]'); await page.click('[data-card=confirm]'); await sleep(2500);
  const chain = norm(await txt('#card-stage .kit-chain'));
  expect(chain.includes('8/12') && chain.includes('2/3') && (chain.match(/÷2/g) || []).length === 2, '쪼개기 카드 확인 → 사슬 8/12 ÷2 4/6 ÷2 2/3: ' + chain);
  // 덧셈 카드 → 4단계 자동 재생
  await page.click('[data-pick="c5-05"]'); await sleep(100);
  await page.click('#card-view .choice[data-choice="1"]'); await page.click('[data-card=confirm]'); await sleep(4500);
  const fa = norm(await txt('#card-stage .ar-formula'));
  expect(fa === '1/2 + 1/3 = 3/6 + 2/6 = 5/6', '덧셈 카드 자동 재생 식: ' + fa);
  // 수직선 두 분수 카드(c5-08)
  await page.selectOption('#card-set', ''); await sleep(100); await page.click('[data-pick="c5-08"]'); await sleep(150);
  expect(await page.locator('#card-stage .kit-line .pt').count() === 2 && (await page.evaluate(() => [...document.querySelectorAll('#card-stage .kit-line .pt-label')].map(e => e.textContent).join(','))) === '1/4,0.3', 'c5-08 수직선에 1/4·0.3 두 점');
  expect(await page.locator('#card-stage .model[data-model=circle]').isHidden(), 'line 모델 카드: 원 숨김');
  // 변환 카드 c4-03 7/4 → 2단위
  await page.click('[data-pick="c4-03"]'); await sleep(150);
  expect(await page.locator('#card-stage .kit-bar .bar-frame').count() === 2 && await page.locator('#card-stage .kit-line .tick-label.int').count() === 3, 'c4-03 7/4: 막대 2단위·수직선 0~2');
  await page.click('#card-view .choice[data-choice="0"]'); await page.click('[data-card=confirm]'); await sleep(300);
  expect((await txt('#card-stage .kit-symbol')).includes('1과 4분의 3') && await page.locator('#card-stage .curtained').count() === 0, '변환 카드 확인 → 기호 패널 공개 1과 4분의 3');
  // 뺄셈 카드 c4-06 (9/4 − 3/4)
  await page.click('[data-pick="c4-06"]'); await sleep(100); await page.click('#card-view .choice[data-choice="0"]'); await page.click('[data-card=confirm]'); await sleep(5000);
  const fs6 = norm(await txt('#card-stage .ar-formula'));
  expect(fs6 === '9/4 − 3/4 = 6/4 = 1 2/4 = 1 1/2', 'c4-06 뺄셈 자동 재생: ' + fs6);
  // 전역 커튼은 확인 시 자동 해제
  await page.click('[data-pick="c3-05"]'); await sleep(100);
  await page.click('#btn-curtain'); expect((await S()).curtain === true, '전역 커튼 켬');
  await page.click('#card-view .choice[data-choice="0"]'); await page.click('[data-card=confirm]'); await sleep(200);
  expect((await S()).curtain === false, '카드 확인 시 전역 커튼 자동 해제');

  // ---------- 카드 순서 ↑↓ ----------
  const firstQ = await page.locator('#card-list .card-item').first().getAttribute('data-id');
  await page.click('#card-list .card-item:nth-child(2) [data-move="-1"]'); await sleep(100);
  expect((await page.locator('#card-list .card-item').first().getAttribute('data-id')) !== firstQ, '순서 ↑ 동작');
  await page.click('#card-list .card-item:nth-child(1) [data-move="1"]'); await sleep(100);
  expect((await page.locator('#card-list .card-item').first().getAttribute('data-id')) === firstQ, '순서 ↓ 복원');
  expect(await page.locator('#card-list .card-item:first-child [data-move="-1"]').isDisabled(), '첫 항목 ↑ 비활성');

  // ---------- 카드 편집 모달 유효성 ----------
  await page.click('[data-action=card-new]'); await sleep(200);
  expect(await modalCount() === 1 && (await txt('.modal-head')).includes('새 카드'), '새 카드 모달');
  expect(await page.locator('.modal-foot .btn.primary').isDisabled() && (await txt('#ef-err')).includes('질문'), '빈 질문 → 저장 비활성 + 인라인 오류');
  await page.fill('#ef-q', 'QA 테스트 <script>alert(1)</script> 질문'); await page.fill('[data-ch="0"]', '1/2'); await page.fill('[data-ch="1"]', '<b>bold</b>'); await sleep(100);
  expect(!(await page.locator('.modal-foot .btn.primary').isDisabled()) && await page.locator('input[name=ef-ans][value="0"]').isChecked(), '질문·선택지 2개 입력(정답 라디오 기본 1번) → 저장 활성');
  await page.check('input[name=ef-ans][value="0"]'); await sleep(100);
  expect(!(await page.locator('.modal-foot .btn.primary').isDisabled()), '유효 → 저장 활성');
  await page.click('#ef-add'); await page.click('#ef-add'); await sleep(50);
  expect(await page.locator('[data-ch]').count() === 4 && await page.locator('#ef-add').isDisabled(), '선택지 4개까지 추가, 추가 버튼 비활성');
  expect(await page.locator('.modal-foot .btn.primary').isDisabled() && (await txt('#ef-err')).includes('빈칸'), '빈 선택지 → 저장 비활성');
  await page.click('[data-rm="3"]'); await page.click('[data-rm="2"]'); await sleep(50);
  expect(await page.locator('[data-ch]').count() === 2 && await page.locator('[data-rm]').first().isDisabled(), '선택지 2개에서 삭제 비활성');
  await page.selectOption('#ef-type', 'sub'); await sleep(100);
  expect(!(await txt('#ef-err')).includes('뺄셈은'), '뺄셈 유형 A(1/2) ≥ B(1/3) → 오류 없음');
  await page.click('#ef-b'); await sleep(150); await page.keyboard.type('3/4'); await page.keyboard.press('Enter'); await sleep(150);
  expect((await txt('#ef-err')).includes('뺄셈은 A ≥ B') && await page.locator('.modal-foot .btn.primary').isDisabled(), '뺄셈 A(1/2) < B(3/4) → 인라인 오류·저장 비활성');
  await page.selectOption('#ef-type', 'compare'); await sleep(100);
  // 키패드로 분수 A 변경
  await page.click('#ef-a'); await sleep(150);
  expect(await modalCount() === 2, '편집 모달 위에 키패드 중첩');
  await page.keyboard.type('3/4'); await page.keyboard.press('Enter'); await sleep(150);
  expect(await modalCount() === 1 && (await txt('#ef-a')).includes('3/4'), '키패드 → 분수 A 3/4');
  await page.click('.modal-foot .btn.primary'); await sleep(200);
  s = await S(); expect(s.counts.cards === 25 && await modalCount() === 0, '새 카드 저장 → 25장');
  const newId = s.currentCardId; expect(newId && newId.startsWith('cd-'), '새 카드 선택·id cd-');
  const qHtml = await page.evaluate(() => document.querySelector('#card-view .card-q-big').innerHTML);
  expect(qHtml.includes('&lt;script&gt;') && (await txt('#card-view .card-q-big')).includes('<script>alert(1)</script>'), 'XSS: 질문의 <script>가 텍스트로 이스케이프');
  const chHtml = await page.evaluate(() => document.querySelector('#card-view .choice[data-choice="1"]').innerHTML);
  expect(!chHtml.includes('<b>') && chHtml.includes('&lt;b&gt;'), 'XSS: 선택지 HTML 이스케이프');
  expect(await page.locator('#card-list .card-item').count() === 25 && (await page.locator('#card-list .card-item').last().getAttribute('data-id')) === newId, '새 카드가 목록 끝에 추가');
  // 내장 카드 편집 → builtin 유지, 샘플 복원으로 원본
  await page.click('[data-edit="c3-01"]'); await sleep(200);
  expect((await page.locator('#ef-q').inputValue()).includes('피자'), '편집 모달 기존 값 채움');
  await page.fill('#ef-q', '편집된 질문'); await sleep(50); await page.click('.modal-foot .btn.primary'); await sleep(200);
  const db1 = await act('getDb'); const c301 = db1.cards.find(c => c.id === 'c3-01');
  expect(c301.question === '편집된 질문' && c301.builtin === true, '내장 카드 편집 후 builtin 유지');
  await act('resetSamples'); await sleep(200);
  const db2 = await act('getDb');
  expect(db2.cards.find(c => c.id === 'c3-01').question.includes('피자') && db2.cards.length === 25, '샘플 복원 → 원본 복구, 사용자 카드 유지');
  // 세트 저장
  await page.check('#card-list [data-check="c3-01"]'); await page.check('#card-list [data-check="c3-02"]');
  await page.click('[data-action=set-save]'); await sleep(150);
  await page.click('.modal-foot .btn.primary'); await sleep(100);
  expect(await modalCount() === 1 && (await txt('#set-err')).includes('이름'), '세트 빈 이름 → 오류, 모달 유지');
  await page.fill('#set-name', '<img src=x onerror=alert(1)>세트'); await page.click('.modal-foot .btn.primary'); await sleep(200);
  s = await S(); expect(s.counts.cardSets === 3 && s.currentSetId.startsWith('cs-') && await page.locator('#card-list .card-item').count() === 2, '세트 저장(3개) → 현재 세트 2장');
  const optHtml = await page.evaluate(() => document.querySelector('#card-set').innerHTML);
  expect(!optHtml.includes('<img') && optHtml.includes('&lt;img'), 'XSS: 세트 이름 이스케이프');
  await page.click('[data-action=set-save]'); await sleep(100);
  expect((await toasts()).some(t => t.includes('체크')), '체크 없이 세트 저장 → 안내 토스트');
  // 삭제
  await page.click('[data-del="c3-01"]'); await sleep(150);
  expect(await modalCount() === 1 && (await txt('.modal')).includes('삭제할까요'), '삭제 확인 모달');
  await page.click('.modal-foot .btn:not(.primary)'); await sleep(100);
  expect((await S()).counts.cards === 25, '삭제 취소 → 유지');
  await page.click('[data-del="c3-01"]'); await sleep(150); await page.click('.modal-foot .btn.primary'); await sleep(200);
  s = await S(); expect(s.counts.cards === 24 && await page.locator('#card-list .card-item').count() === 1, '삭제 → 24장, 세트에서도 제거');
  await reload(); await sleep(300);
  s = await S(); expect(s.counts.cards === 24 && s.counts.cardSets === 3 && s.currentSetId && s.currentSetId.startsWith('cs-'), '새로고침 후 카드·세트·현재 세트 유지');
  // 모든 카드 삭제 → 빈 상태
  await page.evaluate(() => { const a = window.FK.app; a.db.cards = []; a.db.cardSets.forEach(s => s.cardIds = []); a.saveDb(); a.state.currentCardId = null; window.FK.cards.render(); });
  await sleep(100);
  expect((await txt('#card-list')).includes('카드가 없어요') && await page.locator('#card-list [data-action=reset-samples]').count() === 1, '카드 전부 삭제 → 빈 상태 + 샘플 복원 버튼');
  await page.click('#card-list [data-action=reset-samples]'); await sleep(150); await page.click('.modal-foot .btn.primary'); await sleep(200);
  await page.selectOption('#card-set', ''); await sleep(100);
  expect((await S()).counts.cards === 24 && await page.locator('#card-list .card-item').count() === 24, '샘플 복원 → 24장 복구');
  await shot('cards-restored');
};
