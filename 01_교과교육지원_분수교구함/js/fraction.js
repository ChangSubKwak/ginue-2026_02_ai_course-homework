// fraction.js — 분수 수 유틸(정수 연산만 사용, 부동소수 비교 금지)
'use strict';
window.FK = window.FK || {};
FK.frac = (() => {
  // 최대공약수(반복 유클리드)
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; };
  // 최소공배수
  const lcm = (a, b) => a / gcd(a, b) * b;
  // 기약분수(n=0이면 분모 유지)
  const reduce = (n, d) => { if (n === 0) return { n: 0, d }; const g = gcd(n, d); return { n: n / g, d: d / g }; };
  // 대분수 분해
  const toMixed = (n, d) => ({ whole: Math.floor(n / d), rem: n % d });
  // 대분수 → 가분수
  const fromMixed = (w, n, d) => ({ n: w * d + n, d });
  // 교차곱 비교: 1, 0, -1
  const compare = (a, b) => { const l = a.n * b.d, r = b.n * a.d; return l > r ? 1 : l < r ? -1 : 0; };
  // 가장 작은 소인수
  const spf = g => { for (let p = 2; p * p <= g; p++) if (g % p === 0) return p; return g; };
  // 소수 표기: 유한소수면 정확히, 아니면 ≈ 소수 셋째 자리
  const toDecimal = (n, d) => {
    if (n === 0) return '0';
    let t = d, k2 = 0, k5 = 0;
    while (t % 2 === 0) { t /= 2; k2++; }
    while (t % 5 === 0) { t /= 5; k5++; }
    if (t !== 1) return '≈' + (n / d).toFixed(3);
    const k = Math.max(k2, k5);
    if (k === 0) return String(n / d);
    let s = String(n * Math.pow(10, k) / d).padStart(k + 1, '0');
    s = s.slice(0, -k) + '.' + s.slice(-k);
    return s.replace(/\.?0+$/, '');
  };
  // 한국어 읽기
  const toText = (n, d) => {
    if (d === 1) return String(n);
    if (n === 0) return '0';
    if (n < d) return `${d}분의 ${n}`;
    const { whole, rem } = toMixed(n, d);
    return rem ? `${whole}과 ${d}분의 ${rem}` : String(whole);
  };
  // 'n/d' 문자열(분모 1이면 자연수)
  const str = (n, d) => (d === 1 ? String(n) : `${n}/${d}`);
  // 대분수 문자열 '1 3/4'
  const mixedStr = (n, d) => { const { whole, rem } = toMixed(n, d); if (d === 1 || rem === 0) return String(whole); return whole ? `${whole} ${rem}/${d}` : `${rem}/${d}`; };
  // 문자열 파싱: '1 3/4' | '3/4' | '2' | '0.3' → {n,d} 또는 null
  const parse = s => {
    s = String(s).trim(); let m;
    if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/))) return fromMixed(+m[1], +m[2], +m[3]);
    if ((m = s.match(/^(\d+)\/(\d+)$/))) return { n: +m[1], d: +m[2] };
    if (/^\d+$/.test(s)) return { n: +s, d: 1 };
    if ((m = s.match(/^(\d+)\.(\d+)$/))) { const d = Math.pow(10, m[2].length); return { n: +m[1] * d + +m[2], d }; }
    return null;
  };
  // 세로 분수 HTML(가분수는 opts.mixed로 대분수 표기)
  const html = (n, d, opts = {}) => {
    const cls = 'fr' + (opts.cls ? ' ' + opts.cls : '');
    if (d === 1) return `<span class="${cls}"><span class="fr-w">${n}</span></span>`;
    if (opts.mixed && n >= d) {
      const { whole, rem } = toMixed(n, d);
      if (rem === 0) return `<span class="${cls}"><span class="fr-w">${whole}</span></span>`;
      return `<span class="${cls}"><span class="fr-w">${whole}</span><span class="fr-nd"><span class="fr-n">${rem}</span><span class="fr-d">${d}</span></span></span>`;
    }
    return `<span class="${cls}"><span class="fr-nd"><span class="fr-n">${n}</span><span class="fr-d">${d}</span></span></span>`;
  };
  // 문자열 안의 'n/d', 'w n/d'를 세로 분수 HTML로 치환(선택지 표시용)
  const inline = s => String(s).replace(/(\d+)\s+(\d+)\/(\d+)/g, (m, w, n, d) => html(+w * +d + +n, +d, { mixed: true, cls: 'sm' }))
    .replace(/(?<![\d/])(\d+)\/(\d+)(?![\d/])/g, (m, n, d) => html(+n, +d, { cls: 'sm' }));
  // 정수 범위 검사
  const isInt = v => Number.isInteger(v);
  const valid = (fr, dMin, dMax) => !!fr && isInt(fr.n) && isInt(fr.d) && fr.d >= dMin && fr.d <= dMax && fr.n >= 0 && fr.n <= 3 * fr.d;
  return { gcd, lcm, reduce, toMixed, fromMixed, compare, spf, toDecimal, toText, str, mixedStr, parse, html, inline, valid };
})();
