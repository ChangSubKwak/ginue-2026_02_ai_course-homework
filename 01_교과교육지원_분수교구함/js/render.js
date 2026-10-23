// render.js — SVG 렌더(막대·원·수직선·썸네일)와 rAF 애니메이션 헬퍼. 상태 → 전체 재생성 방식.
'use strict';
window.FK = window.FK || {};
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const W = 1000, GAP = 24, THIN_CELLS = 48;
  // SVG 요소 생성
  const svgEl = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const clear = svg => { while (svg.firstChild) svg.removeChild(svg.firstChild); };
  // 단위 막대 수: auto면 ceil(max(n,1)/d), 지정값이면 그 값(단 n이 넘치면 올림), 1~3
  const unitsFor = (n, d, range) => {
    let U = (range === 'auto' || !range) ? Math.ceil(Math.max(n, 1) / d) : +range;
    if (n > U * d) U = Math.ceil(n / d);
    return Math.min(3, Math.max(1, U));
  };
  const barGeom = (d, U) => { const unitW = (W - (U - 1) * GAP) / U; return { unitW, cell: unitW / d, U, gap: GAP }; };

  // 막대 한 줄을 그룹 g에 그린다. o: {n,d,units,fill,top,height,labels,newFrom,ghostD,overlay:{v,fill},hatch:[v0,v1],hatchId,outline,bw,flash,highlight:[i0,i1]}
  function barInto(g, o) {
    const U = o.units, d = o.d, geo = barGeom(d, U), top = o.top || 0, H = o.height || 80;
    const thin = d * U > THIN_CELLS || o.thin;
    for (let u = 0; u < U; u++) {
      const x0 = u * (geo.unitW + GAP);
      svgEl('rect', { class: 'bar-bg', x: x0, y: top, width: geo.unitW, height: H }, g);
      for (let i = 0; i < d; i++) {
        const gi = u * d + i, on = gi < o.n && !o.outline;
        const hl = o.highlight && gi >= o.highlight[0] && gi < o.highlight[1];
        const r = svgEl('rect', { class: 'cell' + (on ? ' on' : '') + (o.fill ? ' f-' + o.fill : '') + (hl ? ' hl' : ''), x: x0 + i * geo.cell, y: top, width: geo.cell, height: H, 'data-i': gi }, g);
        if (o.bw && on) r.setAttribute('fill', 'url(#hatch-bw)');
      }
      if (o.overlay) { // 반투명 겹치기(연속 폭)
        const v = Math.min(1, Math.max(0, o.overlay.v - u));
        if (v > 0) svgEl('rect', { class: 'cell ov f-' + (o.overlay.fill || 'b'), x: x0, y: top, width: v * geo.unitW, height: H }, g);
      }
      if (o.hatch) { // 차이 구간 빗금(단위값 기준)
        const a = Math.max(o.hatch[0], u), b = Math.min(o.hatch[1], u + 1);
        if (b > a) svgEl('rect', { class: 'hatch', x: x0 + (a - u) * geo.unitW, y: top, width: (b - a) * geo.unitW, height: H, fill: 'url(#' + (o.hatchId || 'hatch-diff') + ')' }, g);
      }
      if (o.ghostD) { // 사라지는 분할선(합치기)
        const gc = geo.unitW / o.ghostD, ratio = o.ghostD / d;
        for (let j = 1; j < o.ghostD; j++) if (j % ratio !== 0) svgEl('line', { class: 'div ghost' + (thin ? ' thin' : ''), x1: x0 + j * gc, x2: x0 + j * gc, y1: top, y2: top + H }, g);
      }
      if (o.faintD) for (let j = 1; j < o.faintD; j++) svgEl('line', { class: 'div faint', x1: x0 + j * geo.unitW / o.faintD, x2: x0 + j * geo.unitW / o.faintD, y1: top, y2: top + H }, g); // 공통 분모 보조선
      for (let j = 1; j < d; j++) { // 분할선(새로 생기는 선은 .new)
        const isNew = o.newFrom && (j % (d / o.newFrom)) !== 0;
        svgEl('line', { class: 'div' + (isNew ? ' new' : '') + (thin ? ' thin' : ''), x1: x0 + j * geo.cell, x2: x0 + j * geo.cell, y1: top, y2: top + H }, g);
      }
      svgEl('rect', { class: 'bar-frame' + (o.flash ? ' flash' : ''), x: x0, y: top, width: geo.unitW, height: H }, g);
      if (o.labels !== false && d <= 12 && !thin) for (let i = 0; i < d; i++) {
        svgEl('text', { class: 'cell-label', x: x0 + (i + 0.5) * geo.cell, y: top + H / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g).textContent = i + 1;
      }
    }
    return geo;
  }
  // 단독 막대 SVG
  function bar(svg, o) {
    clear(svg);
    const H = o.height || 80;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const g = svgEl('g', { class: 'bar' + (o.interactive ? ' interactive' : '') }, svg);
    return barInto(g, Object.assign({}, o, { top: 0, height: H }));
  }

  // 원 모델: o {n,d,units,fill,interactive,newFrom,ghostD,outline,bw}
  function circle(svg, o) {
    clear(svg);
    const U = o.units, S = 320, R = 140, d = o.d;
    svg.setAttribute('viewBox', `0 0 ${U * S} ${S}`);
    const g = svgEl('g', { class: 'circle' + (o.interactive && d <= 12 ? ' interactive' : '') + (d > 12 ? ' locked' : '') }, svg);
    const pt = (cx, cy, deg) => [cx + R * Math.cos(deg * Math.PI / 180), cy + R * Math.sin(deg * Math.PI / 180)];
    for (let u = 0; u < U; u++) {
      const cx = u * S + S / 2, cy = S / 2;
      svgEl('circle', { class: 'bar-bg', cx, cy, r: R }, g);
      for (let i = 0; i < d; i++) {
        const gi = u * d + i, on = gi < o.n && !o.outline;
        const cls = 'cell' + (on ? ' on' : '') + (o.fill ? ' f-' + o.fill : '');
        let e;
        if (d === 1) e = svgEl('circle', { class: cls, cx, cy, r: R, 'data-i': gi }, g);
        else {
          const a0 = -90 + i * 360 / d, a1 = a0 + 360 / d, [x0, y0] = pt(cx, cy, a0), [x1, y1] = pt(cx, cy, a1);
          e = svgEl('path', { class: cls, d: `M ${cx} ${cy} L ${x0} ${y0} A ${R} ${R} 0 ${360 / d > 180 ? 1 : 0} 1 ${x1} ${y1} Z`, 'data-i': gi }, g);
        }
        if (o.bw && on) e.setAttribute('fill', 'url(#hatch-bw)');
      }
      if (o.ghostD) { const ratio = o.ghostD / d; for (let j = 0; j < o.ghostD; j++) if (j % ratio !== 0) { const [x, y] = pt(cx, cy, -90 + j * 360 / o.ghostD); svgEl('line', { class: 'div ghost', x1: cx, y1: cy, x2: x, y2: y }, g); } }
      if (d > 1) for (let j = 0; j < d; j++) {
        const [x, y] = pt(cx, cy, -90 + j * 360 / d), isNew = o.newFrom && (j % (d / o.newFrom)) !== 0;
        svgEl('line', { class: 'div' + (isNew ? ' new' : '') + (d > 12 ? ' thin' : ''), x1: cx, y1: cy, x2: x, y2: y }, g);
      }
      svgEl('circle', { class: 'circle-frame', cx, cy, r: R }, g);
    }
  }

  // 수직선: o {d, range:U, points:[{n,d?,cls,label,drag}], hideTicks(어림 모드), newFrom, ghostD, height, labels}
  function line(svg, o) {
    clear(svg);
    const H = o.height || 96, x0 = 36, x1 = W - 36, U = o.range, y = 44, d = o.d, total = U * d;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const g = svgEl('g', { class: 'nline' + (o.interactive ? ' interactive' : '') }, svg);
    const px = v => x0 + (x1 - x0) * v / U;
    svgEl('rect', { class: 'nline-hit', x: 0, y: 0, width: W, height: H, fill: 'transparent' }, g);
    svgEl('line', { class: 'axis', x1: x0 - 12, x2: x1 + 12, y1: y, y2: y }, g);
    svgEl('path', { class: 'axis-arrow', d: `M ${x1 + 12} ${y} l -10 -6 v 12 z` }, g);
    const showFrac = o.labels !== false && d <= 12 && total <= 36 && !o.hideTicks;
    const thin = total > THIN_CELLS;
    if (o.ghostD && !o.hideTicks) { const ratio = o.ghostD / d; for (let k = 1; k < U * o.ghostD; k++) if (k % ratio !== 0) { const x = px(k / o.ghostD); svgEl('line', { class: 'tick ghost', x1: x, x2: x, y1: y - 8, y2: y + 8 }, g); } }
    for (let k = 0; k <= total; k++) {
      const isInt = k % d === 0;
      if (!isInt && o.hideTicks) continue;
      const x = px(k / d), isNew = !isInt && o.newFrom && (k % (d / o.newFrom)) !== 0;
      svgEl('line', { class: 'tick' + (isInt ? ' big' : '') + (isNew ? ' new' : '') + (thin ? ' thin' : ''), x1: x, x2: x, y1: y - (isInt ? 16 : 8), y2: y + (isInt ? 16 : 8) }, g);
      if (isInt) svgEl('text', { class: 'tick-label int', x, y: y + 40, 'text-anchor': 'middle' }, g).textContent = k / d;
      else if (showFrac) svgEl('text', { class: 'tick-label', x, y: y + 34, 'text-anchor': 'middle' }, g).textContent = `${k}/${d}`;
    }
    for (const p of o.points || []) {
      const x = px(p.n / (p.d || d));
      if (p.label) svgEl('text', { class: 'pt-label f-' + p.cls, x, y: y - 24, 'text-anchor': 'middle' }, g).textContent = p.label;
      svgEl('circle', { class: 'pt f-' + p.cls + (p.drag ? ' drag' : ''), cx: x, cy: y, r: p.r || 13, 'data-pt': p.cls }, g);
    }
    return { x0, x1, U, px };
  }

  // 장면 썸네일(막대 1개 축소) 문자열
  function thumb(fr, fill) {
    const U = unitsFor(fr.n, fr.d, 'auto'), geo = barGeom(fr.d, U);
    let s = '';
    for (let u = 0; u < U; u++) {
      const x0 = u * (geo.unitW + GAP);
      s += `<rect class="bar-bg" x="${x0}" y="0" width="${geo.unitW}" height="80"/>`;
      for (let i = 0; i < fr.d; i++) if (u * fr.d + i < fr.n) s += `<rect class="cell on f-${fill || 'a'}" x="${x0 + i * geo.cell}" y="0" width="${geo.cell}" height="80"/>`;
      for (let j = 1; j < fr.d; j++) s += `<line class="div" x1="${x0 + j * geo.cell}" x2="${x0 + j * geo.cell}" y1="0" y2="80"/>`;
      s += `<rect class="bar-frame" x="${x0}" y="0" width="${geo.unitW}" height="80"/>`;
    }
    return `<svg viewBox="0 0 ${W} 80" class="thumb" aria-hidden="true">${s}</svg>`;
  }

  // ---- rAF 애니메이션 ----
  const running = new Set();
  const ease = t => 1 - Math.pow(1 - t, 3);
  const motionOff = () => FK.reduceMotion ? FK.reduceMotion() : window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // dur ms 동안 step(t 0→1 easeOut) 호출, 끝나면 done. 모션 감소 시 즉시 완료.
  function run(dur, step, done) {
    const a = { step, done, raf: 0 };
    const finish = () => { running.delete(a); step(1); if (done) done(); };
    if (dur <= 0 || motionOff()) { finish(); return a; }
    const t0 = performance.now();
    const tick = now => { const t = Math.min(1, (now - t0) / dur); if (t < 1) { step(ease(t)); a.raf = requestAnimationFrame(tick); } else finish(); };
    running.add(a); a.raf = requestAnimationFrame(tick);
    return a;
  }
  // 진행 중인 애니메이션을 모두 즉시 완료(새 입력 시 겹침 방지)
  function finishAll() { for (const a of [...running]) { cancelAnimationFrame(a.raf); running.delete(a); a.step(1); if (a.done) a.done(); } }
  // 선택자 요소를 투명→선명
  function fadeIn(root, sel, dur = 400) { const els = [...root.querySelectorAll(sel)]; if (!els.length) return; els.forEach(e => e.style.opacity = 0); run(dur, t => els.forEach(e => e.style.opacity = t)); }
  // 선택자 요소를 선명→투명 후 제거
  function fadeOut(root, sel, dur = 400, done) { const els = [...root.querySelectorAll(sel)]; run(els.length ? dur : 0, t => els.forEach(e => e.style.opacity = 1 - t), () => { els.forEach(e => e.remove()); if (done) done(); }); }
  // 요소를 translate(from→to)로 이동
  function move(el, from, to, dur, done) { run(dur, t => el.setAttribute('transform', `translate(${from[0] + (to[0] - from[0]) * t} ${from[1] + (to[1] - from[1]) * t})`), done); }
  // 단계 자동 재생(step 함수가 false를 돌려주면 종료)
  function playSteps(stepFn, interval, onEnd) {
    let stopped = false;
    const handle = { stop() { stopped = true; } };
    const tick = () => { if (stopped) return; const more = stepFn(); if (more) handle.timer = setTimeout(tick, motionOff() ? 60 : interval); else if (onEnd) onEnd(); };
    handle.timer = setTimeout(tick, 10);
    handle.stop = () => { stopped = true; clearTimeout(handle.timer); };
    return handle;
  }

  FK.render = { svgEl, clear, unitsFor, barGeom, barInto, bar, circle, line, thumb, W, GAP };
  FK.anim = { run, finishAll, fadeIn, fadeOut, move, playSteps, motionOff };
})();
