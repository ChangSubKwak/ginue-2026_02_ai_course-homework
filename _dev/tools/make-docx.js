// make-docx.js — JSON 콘텐츠 → .docx 변환기 (docx 라이브러리)
// 사용법: node make-docx.js <content.json> <out.docx>
// content.json 형식:
// {
//   "title": "...", "subtitle": "...", "cover_label": "과제 제출물", "cover_note": "...", "accent": "1F3A5F",
//   "meta_rows": [["과제명", "..."], ["제출자", "..."]],
//   "toc": true, "header_text": "...", "compact": false (true면 표지 쪽 없이 첫 쪽 위에 제목·부제만),
//   "sections": [ { "heading": "1. 개요", "level": 1, "page_break_before": false, "blocks": [
//       {"type":"paragraph","text":"**굵게**와 `코드` 지원"},
//       {"type":"bullets","items":["..."]}, {"type":"numbered","items":["..."]},
//       {"type":"table","header":["항목","내용"],"rows":[["a","b"]],"widths":[30,70]},
//       {"type":"image","path":"screens/a.png","caption":"...","width_pct":90},
//       {"type":"code","text":"..."}, {"type":"callout","text":"..."}, {"type":"page_break"}
//   ]} ]
// }
'use strict';
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType,
  ImageRun, PageBreak, LevelFormat, BorderStyle, ShadingType, Footer, Header, PageNumber, TableOfContents, VerticalAlign,
} = require('docx');

const [, , inFile, outFile] = process.argv;
if (!inFile || !outFile) { console.error('usage: node make-docx.js <content.json> <out.docx>'); process.exit(2); }
const content = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const baseDir = path.dirname(path.resolve(inFile));

const FONT = { ascii: 'Malgun Gothic', eastAsia: 'Malgun Gothic', hAnsi: 'Malgun Gothic', cs: 'Malgun Gothic' };
const MONO = { ascii: 'Consolas', eastAsia: 'Malgun Gothic', hAnsi: 'Consolas', cs: 'Consolas' };
const PAGE_W = 11906, PAGE_H = 16838, MARGIN = 1134; // A4, 좌우 2cm
const CONTENT_W = PAGE_W - MARGIN * 2; // 9638 DXA
const ACCENT = (content.accent || '1F3A5F').replace('#', '');
let numInstance = 0;

function runs(text, extra) {
  extra = extra || {};
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0, m;
  const push = (t, opts) => { if (t) out.push(new TextRun(Object.assign({ text: t, font: FONT }, extra, opts || {}))); };
  const s = String(text == null ? '' : text);
  while ((m = re.exec(s))) {
    push(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) push(tok.slice(2, -2), { bold: true });
    else push(tok.slice(1, -1), { font: MONO, shading: { type: ShadingType.CLEAR, fill: 'EEF1F5', color: 'auto' } });
    last = m.index + tok.length;
  }
  push(s.slice(last));
  return out;
}
function para(text, opts) { return new Paragraph(Object.assign({ children: runs(text), spacing: { after: 120, line: 300 } }, opts || {})); }

function imgSize(buf) {
  if (buf.slice(1, 4).toString() === 'PNG') return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xFF) { i++; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xC0 && marker <= 0xC3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return { w: 1200, h: 800 };
}

function makeTable(header, rows, widthsPct) {
  const cols = header.length;
  const pct = widthsPct && widthsPct.length === cols ? widthsPct : Array(cols).fill(100 / cols);
  const widths = pct.map(p => Math.round(CONTENT_W * p / 100));
  widths[cols - 1] += CONTENT_W - widths.reduce((a, c) => a + c, 0);
  const cell = (t, i, isHead) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    shading: isHead ? { type: ShadingType.CLEAR, fill: 'E3EAF4', color: 'auto' } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: String(t == null ? '' : t).split('\n').map(line => new Paragraph({ children: runs(line, isHead ? { bold: true } : {}), spacing: { after: 0, line: 276 } })),
  });
  const mkRow = (cells, isHead) => new TableRow({ tableHeader: isHead, cantSplit: true, children: cells.map((t, i) => cell(t, i, isHead)) });
  return new Table({ columnWidths: widths, width: { size: CONTENT_W, type: WidthType.DXA }, rows: [mkRow(header, true)].concat(rows.map(r => mkRow(r, false))) });
}

function blockToElements(b) {
  const els = [];
  switch (b.type) {
    case 'paragraph': els.push(para(b.text)); break;
    case 'bullets':
      for (const it of b.items) els.push(new Paragraph({ children: runs(it), numbering: { reference: 'bullets', level: 0 }, spacing: { after: 60, line: 300 } }));
      break;
    case 'numbered':
      numInstance++;
      for (const it of b.items) els.push(new Paragraph({ children: runs(it), numbering: { reference: 'numbers', level: 0, instance: numInstance }, spacing: { after: 60, line: 300 } }));
      break;
    case 'table':
      els.push(makeTable(b.header, b.rows, b.widths));
      els.push(new Paragraph({ spacing: { after: 120 } }));
      break;
    case 'image': {
      const p = path.resolve(baseDir, b.path);
      if (!fs.existsSync(p)) { els.push(para('[이미지 없음: ' + b.path + ']')); break; }
      const buf = fs.readFileSync(p); const { w, h } = imgSize(buf);
      const maxWpx = Math.round((CONTENT_W / 20) * ((b.width_pct || 90) / 100));
      const maxHpx = 620;
      const scale = Math.min(1, maxWpx / w, maxHpx / h);
      const dw = Math.round(w * scale), dh = Math.round(h * scale);
      const type = /\.jpe?g$/i.test(p) ? 'jpg' : 'png';
      els.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, keepNext: !!b.caption, children: [new ImageRun({ type, data: buf, transformation: { width: dw, height: dh } })] }));
      if (b.caption) els.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: runs(b.caption, { size: 18, color: '555555' }) }));
      break;
    }
    case 'code': {
      const lines = String(b.text).split('\n');
      lines.forEach((line, i) => els.push(new Paragraph({
        children: [new TextRun({ text: line || ' ', font: MONO, size: 17 })],
        shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
        spacing: { after: 0, line: 260 }, indent: { left: 200, right: 200 },
        border: i === 0 ? { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } } : (i === lines.length - 1 ? { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } } : undefined),
      })));
      els.push(new Paragraph({ spacing: { after: 120 } }));
      break;
    }
    case 'callout':
      els.push(new Paragraph({ children: runs(b.text), shading: { type: ShadingType.CLEAR, fill: 'FFF7E0', color: 'auto' }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: 'E0A800' } }, indent: { left: 200, right: 200 }, spacing: { before: 120, after: 160, line: 300 } }));
      break;
    case 'page_break': els.push(new Paragraph({ children: [new PageBreak()] })); break;
    default: els.push(para(b.text || JSON.stringify(b)));
  }
  return els;
}

const children = [];
if (content.compact) { // 표지 없이 첫 쪽 위에 제목만 두는 짧은 문서(간단 사용법)
  children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: content.title, font: FONT, size: 44, bold: true, color: ACCENT })] }));
  if (content.subtitle) children.push(new Paragraph({ spacing: { after: 240 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1', space: 6 } }, children: [new TextRun({ text: content.subtitle, font: FONT, size: 24, color: '555555' })] }));
} else {
children.push(new Paragraph({ spacing: { before: 2400, after: 200 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: content.cover_label || '과제 제출물', font: FONT, size: 24, color: '666666' })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: content.title, font: FONT, size: 52, bold: true, color: ACCENT })] }));
if (content.subtitle) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: content.subtitle, font: FONT, size: 28, color: '444444' })] }));
if (content.meta_rows && content.meta_rows.length) {
  const w1 = Math.round(CONTENT_W * 0.28), w2 = CONTENT_W - w1;
  children.push(new Table({ columnWidths: [w1, w2], width: { size: CONTENT_W, type: WidthType.DXA }, rows: content.meta_rows.map(([k, v]) => new TableRow({ children: [
    new TableCell({ width: { size: w1, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: 'E3EAF4', color: 'auto' }, margins: { top: 100, bottom: 100, left: 160, right: 160 }, children: [new Paragraph({ children: runs(k, { bold: true }) })] }),
    new TableCell({ width: { size: w2, type: WidthType.DXA }, margins: { top: 100, bottom: 100, left: 160, right: 160 }, children: [new Paragraph({ children: runs(v) })] }),
  ] })) }));
}
if (content.cover_note) children.push(new Paragraph({ spacing: { before: 400 }, alignment: AlignmentType.CENTER, children: runs(content.cover_note, { size: 20, color: '666666' }) }));
children.push(new Paragraph({ children: [new PageBreak()] }));
}
if (content.toc) {
  children.push(new Paragraph({ spacing: { before: 200, after: 240 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1', space: 4 } }, children: [new TextRun({ text: '목차', font: FONT, size: 34, bold: true, color: ACCENT })] }));
  children.push(new TableOfContents('목차', { hyperlink: true, headingStyleRange: '1-3' }));
  children.push(new Paragraph({ children: [new PageBreak()] }));
}
for (const s of content.sections) {
  const lvl = s.level === 3 ? HeadingLevel.HEADING_3 : (s.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1);
  if (s.page_break_before) children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(new Paragraph({ heading: lvl, children: [new TextRun({ text: s.heading, font: FONT })] }));
  for (const b of (s.blocks || [])) children.push(...blockToElements(b));
}

const doc = new Document({
  creator: content.author || '',
  title: content.title,
  styles: {
    default: { document: { run: { font: FONT, size: 21 }, paragraph: { spacing: { line: 300 } } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 34, bold: true, color: ACCENT, font: FONT }, paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1', space: 4 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 27, bold: true, color: '222222', font: FONT }, paragraph: { spacing: { before: 300, after: 140 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 23, bold: true, color: '333333', font: FONT }, paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 2 } },
    ],
  },
  numbering: { config: [
    { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 640, hanging: 320 } } } }] },
    { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 640, hanging: 360 } } } }] },
  ] },
  features: { updateFields: false },
  sections: [{
    properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: 1300, bottom: 1300, left: MARGIN, right: MARGIN } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: content.header_text || content.title, font: FONT, size: 16, color: '888888' })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['- ', PageNumber.CURRENT, ' -'], font: FONT, size: 18, color: '666666' })] })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => { fs.writeFileSync(outFile, buf); console.log('wrote ' + outFile + ' (' + buf.length + ' bytes)'); }).catch(e => { console.error('make-docx FAILED:', e); process.exit(1); });
