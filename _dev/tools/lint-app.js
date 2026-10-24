// lint-app.js — 앱 폴더 정적 점검 (공통 규약 위반 탐지)
// 사용법: node lint-app.js <앱 폴더>
'use strict';
const fs = require('fs');
const path = require('path');
const dir = path.resolve(process.argv[2] || '.');
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!/^(node_modules|\.git|docs)$/.test(e.name)) walk(p); } else files.push(p);
  }
})(dir);
const issues = [], stats = {};
let totalLines = 0;
for (const f of files) {
  const rel = path.relative(dir, f).replace(/\\/g, '/');
  if (!/\.(html|css|js|md)$/i.test(rel)) continue;
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n').length; stats[rel] = lines; if (/\.(html|css|js)$/i.test(rel)) totalLines += lines;
  const add = (re, msg) => {
    const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = r.exec(src))) {
      const line = src.slice(0, m.index).split('\n').length;
      issues.push(rel + ':' + line + ' ' + msg + ': ' + m[0].slice(0, 80).replace(/\s+/g, ' '));
      if (issues.length > 200) return;
    }
  };
  if (/\.js$/i.test(rel) || /\.html$/i.test(rel)) {
    add(/(?<![\w.$])(alert|confirm|prompt)\s*\(/, 'alert/confirm/prompt 사용 금지');
    add(/^\s*import\s[^;]*\sfrom\s|^\s*export\s+(default|const|let|function|class)\b/m, 'ES 모듈 구문(file://에서 동작 안 함)');
    add(/\bfetch\s*\(\s*['"][^'"]*['"]/, 'fetch 호출(file://에서 로컬 파일 읽기 차단됨)');
    add(/\bXMLHttpRequest\b/, 'XHR 사용(file://에서 로컬 파일 읽기 차단됨)');
  }
  if (/\.html$/i.test(rel)) {
    if (!/^\s*<!doctype html>/i.test(src)) issues.push(rel + ': <!doctype html> 누락');
    if (!/<html[^>]*lang=["']ko["']/i.test(src)) issues.push(rel + ': <html lang="ko"> 누락');
    if (!/<meta[^>]*viewport/i.test(src)) issues.push(rel + ': viewport meta 누락');
    if (!/<title>[^<]+<\/title>/i.test(src)) issues.push(rel + ': <title> 누락');
    add(/<script[^>]*type=["']module["']/, 'type="module" 사용');
    add(/<script[^>]*src=["']https?:\/\//, '외부 스크립트');
    add(/<link[^>]*href=["']https?:\/\/(?!fonts\.googleapis\.com|fonts\.gstatic\.com)/, '외부 리소스(구글 폰트 외)');
    add(/<img[^>]*src=["']https?:\/\//, '외부 이미지');
    add(/<iframe/, 'iframe 사용');
  }
  if (/\.css$/i.test(rel)) {
    if (!/prefers-color-scheme:\s*dark/.test(src)) issues.push(rel + ': 다크 모드 미디어쿼리 없음');
    if (!/:root\[data-theme=["']dark["']\]/.test(src)) issues.push(rel + ': :root[data-theme="dark"] 블록 없음');
    if (!/:root:not\(\[data-theme=["']light["']\]\)/.test(src)) issues.push(rel + ': :root:not([data-theme="light"]) 가드 없음');
    if (!/safe-area-inset-left/.test(src)) issues.push(rel + ': safe-area 좌우 패딩 없음');
    if (!/prefers-reduced-motion/.test(src)) issues.push(rel + ': prefers-reduced-motion 미처리');
    if (!/:focus-visible/.test(src)) issues.push(rel + ': :focus-visible 스타일 없음');
    add(/@import\s+url\(\s*['"]?https?:\/\/(?!fonts\.googleapis\.com)/, '외부 @import');
  }
}
const required = ['index.html', 'README.md', 'css/style.css'];
for (const r of required) if (!fs.existsSync(path.join(dir, r))) issues.push('필수 파일 누락: ' + r);
if (!files.some(f => /[\\/]js[\\/][^\\/]+\.js$/.test(f))) issues.push('js/ 폴더에 스크립트 없음');
console.log(JSON.stringify({ dir, totalCodeLines: totalLines, files: stats, issues }, null, 2));
process.exit(issues.length ? 1 : 0);
