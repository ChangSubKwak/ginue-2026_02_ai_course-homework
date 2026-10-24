/* problems.js — 19개 스테이지 규칙 기반 문제 생성기(A1), 3지선다 오답(A2), 분수·소수 표기 유틸(A14), 한 줄 풀이(A10) */
'use strict';
(function (MG) {
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  // 소수 피연산자용: 10의 배수를 제외한 난수(×0.1 스케일에서 정수가 되지 않게)
  const rndDec = (a, b) => { let v; do { v = rnd(a, b); } while (v % 10 === 0); return v; };
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a);
  const lcm = (a, b) => a / gcd(a, b) * b;
  const reduce = (n, d) => { const g = gcd(n, d) || 1; return [n / g, d / g]; };
  // 분수 표기: 자연수 '2', 진분수 '3/4', 가분수는 대분수 '1 2/5' (keep=true면 약분하지 않은 분모 유지)
  const fmtFrac = (n, d, keep) => {
    if (!keep) [n, d] = reduce(n, d);
    if (d === 1) return String(n);
    const w = Math.floor(n / d), r = n % d;
    return w ? (r ? `${w} ${r}/${d}` : String(w)) : `${n}/${d}`;
  };
  // 소수 표기: 정수 스케일 v를 10^k로 나눠 뒤 0 제거
  const fmtDec = (v, k) => { const s = (v / Math.pow(10, k)).toFixed(k); return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s; };
  // 약수 목록: √n까지만 탐색(큰 수에서도 즉시 반환)
  const divisors = n => { const lo = [], hi = []; for (let i = 1; i * i <= n; i++) if (n % i === 0) { lo.push(i); if (i * i !== n) hi.push(n / i); } return lo.concat(hi.reverse()); };
  // 숫자 뒤 조사(은/는): 끝자리가 2·4·5·9(이·사·오·구)면 받침 없음
  const eun = n => [2, 4, 5, 9].includes(n % 10) ? '는' : '은';
  const carryCount = (a, b) => { let c = 0, n = 0; while (a || b) { const s = a % 10 + b % 10 + c; c = s >= 10 ? 1 : 0; n += c; a = Math.floor(a / 10); b = Math.floor(b / 10); } return n; };
  const borrowCount = (a, b) => { let br = 0, n = 0; while (a || b) { const x = a % 10 - br, y = b % 10; br = x < y ? 1 : 0; n += br; a = Math.floor(a / 10); b = Math.floor(b / 10); } return n; };

  // 스테이지별 매개변수 샘플러 (p = {op, ...})
  const sample = {
    's1-1': () => { const a = rnd(1, 8); return { op: 'add', a, b: rnd(1, 9 - a) }; },
    's1-2': () => { const a = rnd(2, 9); return { op: 'sub', a, b: rnd(1, a - 1) }; },
    's1-3': () => {
      if (Math.random() < 0.5) { const t1 = rnd(1, 8), o1 = rnd(0, 9); return { op: 'add', a: t1 * 10 + o1, b: rnd(1, 9 - t1) * 10 + rnd(0, 9 - o1) }; }
      const t1 = rnd(2, 9), o1 = rnd(0, 9); return { op: 'sub', a: t1 * 10 + o1, b: rnd(1, t1 - 1) * 10 + rnd(0, o1) };
    },
    's2-1': () => { let a, b; do { a = rnd(10, 99); b = rnd(10, 99); } while (a % 10 + b % 10 < 10 || a + b > 150); return { op: 'add', a, b }; },
    's2-2': () => { let a, b; do { a = rnd(10, 99); b = rnd(10, 99); } while (!(a > b && a % 10 < b % 10)); return { op: 'sub', a, b }; },
    's2-3': () => ({ op: 'mul', a: rnd(2, 9), b: rnd(1, 9) }),
    's3-1': () => {
      let a, b;
      if (Math.random() < 0.5) { do { a = rnd(100, 899); b = rnd(100, 899); } while (a + b > 999 || carryCount(a, b) < 1); return { op: 'add', a, b }; }
      do { a = rnd(100, 899); b = rnd(100, 899); } while (!(a > b && borrowCount(a, b) >= 1)); return { op: 'sub', a, b };
    },
    's3-2': () => { const b = rnd(2, 9); return { op: 'div', a: b * rnd(1, 9), b }; },
    's3-3': () => ({ op: 'mul', a: rnd(11, 99), b: rnd(2, 9) }),
    's3-4': () => { let a, b; do { a = rnd(10, 99); b = rnd(2, 9); } while (a % b === 0); return { op: Math.random() < 0.5 ? 'divq' : 'divr', a, b }; },
    's4-1': () => { if (Math.random() < 0.5) return { op: 'mul', a: rnd(11, 59), b: rnd(11, 59) }; const b = rnd(11, 29); return { op: 'div', a: b * rnd(2, 9), b }; },
    's4-2': () => { const d = rnd(3, 12); if (Math.random() < 0.5) return { op: 'fadd', n1: rnd(1, d - 1), d1: d, n2: rnd(1, d - 1), d2: d, keep: true }; const n1 = rnd(2, d - 1); return { op: 'fsub', n1, d1: d, n2: rnd(1, n1 - 1), d2: d, keep: true }; },
    's4-3': () => { let a = rndDec(1, 99), b = rndDec(1, 99); if (Math.random() < 0.5) return { op: 'dadd', a, b, k: 1 }; while (a === b) b = rndDec(1, 99); return { op: 'dsub', a: Math.max(a, b), b: Math.min(a, b), k: 1 }; },
    's5-1': () => { let a, b; if (Math.random() < 0.5) { do { a = rnd(2, 30); b = rnd(2, 30); } while (a === b || gcd(a, b) < 2); return { op: 'gcd', a, b }; } do { a = rnd(2, 30); b = rnd(2, 30); } while (a === b || lcm(a, b) > 100); return { op: 'lcm', a, b }; },
    's5-2': () => {
      const D = [2, 3, 4, 5, 6, 8, 10, 12]; let d1, d2, n1, n2;
      do { d1 = pick(D); d2 = pick(D); n1 = rnd(1, d1 - 1); n2 = rnd(1, d2 - 1); } while (d1 === d2 || n1 * d2 === n2 * d1);
      if (Math.random() < 0.5) return { op: 'fadd', n1, d1, n2, d2 };
      return n1 * d2 > n2 * d1 ? { op: 'fsub', n1, d1, n2, d2 } : { op: 'fsub', n1: n2, d1: d2, n2: n1, d2: d1 };
    },
    's5-3': () => Math.random() < 0.5 ? { op: 'dmul', a: rndDec(1, 99), b: rnd(1, 9), ka: 1, kb: 0 } : { op: 'dmul', a: rndDec(1, 99), b: rndDec(1, 99), ka: 1, kb: 1 },
    's6-1': () => {
      const t = rnd(0, 2);
      if (t === 0) { const d = rnd(2, 9); return { op: 'fdiv', n1: rnd(1, d - 1), d1: d, n2: rnd(2, 9), d2: 1 }; }
      if (t === 1) return { op: 'fdiv', n1: rnd(1, 9), d1: 1, n2: 1, d2: rnd(2, 9) };
      const d1 = rnd(2, 12), d2 = rnd(2, 12); return { op: 'fdiv', n1: rnd(1, d1 - 1), d1, n2: rnd(1, d2 - 1), d2 };
    },
    's6-2': () => { let q, k; do { q = rnd(1, 9); k = rnd(2, 9); } while ((q * k) % 10 === 0); return Math.random() < 0.5 ? { op: 'ddiv', a: q * k, b: k, kb: 0 } : { op: 'ddiv', a: q * k, b: k, kb: 1 }; },
    's6-3': () => {
      const t = rnd(0, 2);
      if (t === 0) { const p = pick([5, 10, 20, 25, 30, 40, 50, 60, 75, 80]), step = 100 / gcd(p, 100); return { op: 'pctof', n: step * rnd(1, Math.floor(200 / step)), p }; }
      if (t === 1) { const n = pick([4, 5, 10, 20, 25, 50]); return { op: 'pct', n, m: rnd(1, n - 1) }; }
      const b = pick([2, 4, 5, 10, 20, 25, 50]); return { op: 'ratio', a: rnd(1, b - 1), b };
    },
  };

  // 분수 후보 오답 → 정답·중복·음수 제외 후 2개 보충(A2)
  const fracChoices = (rn, rd, cands, keepD) => {
    const key = (n, d) => reduce(n, d).join('/'), ans = key(rn, rd), seen = new Set([ans]), out = [];
    const tryAdd = (n, d) => { if (out.length >= 2 || d <= 0 || n <= 0) return; const k = key(n, d); if (seen.has(k)) return; seen.add(k); out.push(fmtFrac(n, d, keepD && d === rd)); };
    cands.forEach(([n, d]) => tryAdd(n, d));
    [1, -1, 2, -2, 3].forEach(x => tryAdd(rn + x, rd));
    return out;
  };
  // 정답 포함 3개 셔플
  const shuffle3 = (answerText, wrongs) => { const arr = [answerText, ...wrongs.slice(0, 2)]; for (let i = arr.length - 1; i > 0; i--) { const j = rnd(0, i); [arr[i], arr[j]] = [arr[j], arr[i]]; } return { choices: arr, correctIndex: arr.indexOf(answerText) }; };

  // 연산 종류별 문제 빌더: 공통 Problem 필드 생성
  const build = (stageId, p, opts) => {
    opts = opts || {};
    const stage = MG.stageById(stageId);
    let key, text, answer, answerText, hint, solution, choices = null, correctIndex = null, inputType = stage.inputType;
    const { a, b } = p;
    switch (p.op) {
      case 'add': case 'sub': {
        const plus = p.op === 'add', r = plus ? a + b : a - b, sym = plus ? '+' : '−';
        key = `${a}${sym}${b}`; text = `${a} ${sym} ${b}`; answer = r; answerText = String(r);
        const small = a < 10 && b < 10;
        hint = small ? { model: 'dots', data: { a, b, plus } } : { model: 'column', data: { a, b, plus } };
        const note = small ? '' : plus ? (carryCount(a, b) ? ' (받아올림 있음)' : '') : (borrowCount(a, b) ? ' (받아내림 있음)' : '');
        solution = `${a} ${sym} ${b} = ${r}${note}`; break;
      }
      case 'mul': {
        const r = a * b; key = `${a}×${b}`; text = `${a} × ${b}`; answer = r; answerText = String(r);
        if (a <= 9 && b <= 9) { hint = { model: 'array', data: { rows: a, cols: b } }; solution = `${a} × ${b} = ${r} (${a}씩 ${b}묶음)`; }
        else if (b <= 9) { const t = Math.floor(a / 10) * 10, o = a % 10; solution = `${a}×${b} = ${t}×${b} + ${o}×${b} = ${t * b}+${o * b} = ${r}`; hint = { model: 'text', data: solution }; }
        else { const tb = Math.floor(b / 10) * 10, ob = b % 10; solution = `${a}×${b} = ${a}×${tb} + ${a}×${ob} = ${a * tb}+${a * ob} = ${r}`; hint = { model: 'text', data: solution }; }
        break;
      }
      case 'div': {
        const q = a / b; key = `${a}÷${b}`; text = `${a} ÷ ${b}`; answer = q; answerText = String(q);
        solution = `${a} ÷ ${b} → ${b} × ${q} = ${a} → ${q}`;
        hint = stage.hintModel === 'array' && a <= 81 ? { model: 'array', data: { total: a, group: b } } : { model: 'text', data: solution }; break;
      }
      case 'divq': case 'divr': {
        const q = Math.floor(a / b), r = a % b, isQ = p.op === 'divq';
        key = `${a}÷${b} ${isQ ? '몫' : '나머지'}`; text = `${a} ÷ ${b}의 ${isQ ? '몫' : '나머지'}`; answer = isQ ? q : r; answerText = String(answer);
        solution = `${a} = ${b}×${q} + ${r} → 몫 ${q}, 나머지 ${r}`; hint = { model: 'text', data: solution }; break;
      }
      case 'fadd': case 'fsub': {
        const plus = p.op === 'fadd', { n1, d1, n2, d2 } = p, sym = plus ? '+' : '−', L = lcm(d1, d2), m1 = L / d1, m2 = L / d2;
        const rn = plus ? n1 * m1 + n2 * m2 : n1 * m1 - n2 * m2;
        key = `${n1}/${d1}${sym}${n2}/${d2}`; text = `${n1}/${d1} ${sym} ${n2}/${d2}`; inputType = 'choice3';
        answerText = fmtFrac(rn, L, !!p.keep);
        let cands;
        if (d1 === d2) { cands = [[plus ? n1 - n2 : n1 + n2, d1], [rn + 1, d1], [rn - 1, d1], [rn + 2, d1], [rn - 2, d1]]; solution = `${n1}/${d1} ${sym} ${n2}/${d1} = ${rn}/${d1}` + (rn >= d1 ? ` = ${answerText}` : ''); }
        else { cands = [[plus ? n1 + n2 : Math.abs(n1 - n2), d1 + d2], [plus ? n1 + n2 : Math.abs(n1 - n2), Math.max(d1, d2)], [rn + 1, L], [rn - 1, L]]; solution = `${n1}/${d1} ${sym} ${n2}/${d2} = ${n1 * m1}/${L} ${sym} ${n2 * m2}/${L} = ${rn}/${L}` + (fmtFrac(rn, L) !== `${rn}/${L}` ? ` = ${fmtFrac(rn, L)}` : ''); }
        ({ choices, correctIndex } = shuffle3(answerText, fracChoices(rn, L, cands, !!p.keep)));
        answer = correctIndex; hint = { model: 'bar', data: { n1, d1, n2, d2, plus, L, rn, result: answerText } }; break;
      }
      case 'fdiv': {
        const { n1, d1, n2, d2 } = p, [rn, rd] = reduce(n1 * d2, d1 * n2), A = fmtFrac(n1, d1), B = fmtFrac(n2, d2), Binv = n2 === 1 ? String(d2) : `${d2}/${n2}`;
        key = `${A}÷${B}`; text = `${A} ÷ ${B}`; inputType = 'choice3'; answerText = fmtFrac(rn, rd);
        solution = `${A} ÷ ${B} = ${A} × ${Binv} = ${answerText}`;
        ({ choices, correctIndex } = shuffle3(answerText, fracChoices(rn, rd, [[n1 * n2, d1 * d2], [d1 * n2, n1 * d2], [rn + 1, rd]])));
        answer = correctIndex; hint = { model: 'bar', data: { n1, d1, n2, d2, div: true, result: answerText, solution } }; break;
      }
      case 'dadd': case 'dsub': {
        const plus = p.op === 'dadd', r = plus ? a + b : a - b, sym = plus ? '+' : '−', A = fmtDec(a, 1), B = fmtDec(b, 1);
        key = `${A}${sym}${B}`; text = `${A} ${sym} ${B}`; answer = r * 10; answerText = fmtDec(r, 1);
        solution = `${A} ${sym} ${B} → ${a} ${sym} ${b} = ${r} → 소수점 한 자리 → ${answerText}`; hint = { model: 'text', data: solution }; break;
      }
      case 'dmul': {
        const A = fmtDec(a, p.ka), B = fmtDec(b, p.kb), k = p.ka + p.kb, r = a * b;
        key = `${A}×${B}`; text = `${A} × ${B}`; answer = r * Math.pow(10, 2 - k); answerText = fmtDec(r, k);
        solution = `${A}×${B} → ${a}×${b}=${r} → 소수점 ${k === 1 ? '한' : '두'} 자리 → ${answerText}`; hint = { model: 'text', data: solution }; break;
      }
      case 'ddiv': {
        const A = fmtDec(a, 1), q = a / b, B = p.kb ? fmtDec(b, 1) : String(b);
        key = `${A}÷${B}`; text = `${A} ÷ ${B}`;
        if (p.kb) { answer = q * 100; answerText = String(q); solution = `${A}÷${B} → ${a}÷${b} = ${q}`; }
        else { answer = q * 10; answerText = fmtDec(q, 1); solution = `${A}÷${B} → ${a}÷${b} = ${q} → 소수점 한 자리 → ${answerText}`; }
        hint = { model: 'text', data: solution }; break;
      }
      case 'gcd': case 'lcm': {
        const isG = p.op === 'gcd', r = isG ? gcd(a, b) : lcm(a, b);
        key = `${a}${[2, 4, 5, 9].includes(a % 10) ? '와' : '과'} ${b}의 ${isG ? '최대공약수' : '최소공배수'}`; text = key; answer = r; answerText = String(r);
        solution = isG ? `${a}의 약수 ${divisors(a).join(',')} / ${b}의 약수 ${divisors(b).join(',')} → 공약수 중 최대 ${r}`
          : `${a}의 배수 ${[1, 2, 3].map(i => a * i).join(',')},… / ${b}의 배수 ${[1, 2, 3].map(i => b * i).join(',')},… → 공배수 중 최소 ${r}`;
        hint = { model: 'text', data: solution }; break;
      }
      case 'pctof': { const r = p.n * p.p / 100; key = `${p.n}의 ${p.p}%`; text = key; answer = r; answerText = String(r); solution = `${p.n}의 ${p.p}% = ${p.n}×${p.p}÷100 = ${r}`; hint = { model: 'text', data: solution }; break; }
      case 'pct': { const r = p.m * 100 / p.n; key = `전체 ${p.n} 중 ${p.m}은 몇 %`; text = `${p.n} 중 ${p.m}${eun(p.m)} 몇 %?`; answer = r; answerText = String(r); solution = `${p.m}÷${p.n}×100 = ${r}%`; hint = { model: 'text', data: solution }; break; }
      case 'ratio': { const r = a * 100 / b; key = `비 ${a}:${b}를 백분율로`; text = `${a}:${b}${eun(b)} 몇 %?`; answer = r; answerText = String(r); solution = `${a}:${b} → ${a}÷${b}×100 = ${r}%`; hint = { model: 'text', data: solution }; break; }
      default: throw new Error('unknown op ' + p.op);
    }
    // 저학년 3지선다 모드: 정답 ±1, ±2, ±10 중 음수 아닌 값 2개
    if (opts.choice && inputType === 'number') {
      const cands = [1, -1, 2, -2, 10, -10].map(x => answer + x).filter(v => v >= 0), w = [];
      while (w.length < 2 && cands.length) w.push(String(cands.splice(rnd(0, cands.length - 1), 1)[0]));
      ({ choices, correctIndex } = shuffle3(answerText, w)); answer = correctIndex; inputType = 'choice3';
    }
    return { key, text, answer, answerText, inputType, choices, correctIndex, hint, solution, p, stageId, isRevenge: false };
  };

  // 문제 생성: 최근 키와 겹치면 최대 10회 재생성
  const generate = (stageId, opts, avoid) => {
    let pr;
    for (let i = 0; i < 10; i++) { pr = build(stageId, sample[stageId](), opts); if (!avoid || !avoid.has(pr.key)) break; }
    return pr;
  };
  // 저학년 3지선다 모드 적용 여부를 포함한 스테이지 입력 방식
  const effectiveInput = (stageId, settings) => (settings.lowGradeChoice && MG.LOW_GRADE.includes(stageId)) ? 'choice3' : MG.stageById(stageId).inputType;
  MG.Problems = { gcd, lcm, reduce, fmtFrac, fmtDec, build, generate, effectiveInput, carryCount, borrowCount };
})(window.MG);
