// Google Apps Script 실행 환경을 흉내 내는 모의 객체.
// apps-script/Code.gs를 수정 없이 그대로 vm에서 실행해서 테스트한다.
// 시트의 중요한 동작(서식이 '@'가 아니면 숫자 모양 문자열을 숫자로 바꾸는 것)을 재현한다.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 정의되지 않은 서식 메서드는 자기 자신을 돌려주는 체이닝 no-op으로 처리한다.
function chainable(target) {
  const proxy = new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === 'symbol') return undefined;
      return () => proxy;
    },
  });
  return proxy;
}

class MockSheet {
  constructor(name) {
    this.name = name;
    this.cells = new Map(); // "r,c" → { v, fmt }
    this.maxRows = 1000;
    this.bandings = [];
    this.frozenRows = 0;
  }
  cell(r, c) {
    const k = r + ',' + c;
    if (!this.cells.has(k)) this.cells.set(k, { v: '', fmt: '' });
    return this.cells.get(k);
  }
  getName() { return this.name; }
  setName(n) { this.name = n; return this; }
  getMaxRows() { return this.maxRows; }
  getLastRow() {
    let m = 0;
    for (const [k, x] of this.cells) if (x.v !== '' && x.v != null) m = Math.max(m, Number(k.split(',')[0]));
    return m;
  }
  getLastColumn() {
    let m = 0;
    for (const [k, x] of this.cells) if (x.v !== '' && x.v != null) m = Math.max(m, Number(k.split(',')[1]));
    return m;
  }
  insertRowsAfter(after, n) { this.maxRows += n; }
  setFrozenRows(n) { this.frozenRows = n; }
  setFrozenColumns() {}
  setColumnWidth() {}
  setRowHeight() {}
  getBandings() { return this.bandings; }
  getRange(r, c, nr = 1, nc = 1) {
    if (r + nr - 1 > this.maxRows) throw new Error('범위의 좌표가 시트 크기를 벗어났습니다.'); // 실제 시트와 같은 동작
    return chainable(new MockRange(this, r, c, nr, nc));
  }
  // 테스트 편의: 행 전체 값
  row(r, n = 14) { return Array.from({ length: n }, (_, i) => this.cell(r, i + 1).v); }
}

class MockRange {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
  each(fn) {
    for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) fn(this.sheet.cell(this.r + i, this.c + j), i, j);
  }
  static coerce(v, fmt) {
    if (fmt === '@') return v == null ? '' : String(v);
    if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v); // 시트의 자동 숫자 변환
    return v;
  }
  setValues(vals) {
    if (vals.length !== this.nr || vals[0].length !== this.nc) throw new Error(`범위 크기 불일치 ${vals.length}x${vals[0].length} vs ${this.nr}x${this.nc}`);
    this.each((cell, i, j) => { cell.v = MockRange.coerce(vals[i][j], cell.fmt); });
    return this;
  }
  setValue(v) { this.each((cell) => { cell.v = MockRange.coerce(v, cell.fmt); }); return this; }
  getValue() { return this.sheet.cell(this.r, this.c).v; }
  getValues() { const out = []; this.each((cell, i) => { (out[i] ??= []).push(cell.v); }); return out; }
  getDisplayValue() { return String(this.getValue()); }
  setNumberFormat(f) { this.each((cell) => { cell.fmt = f; }); return this; }
  getNumberFormat() { return this.sheet.cell(this.r, this.c).fmt; }
  getRow() { return this.r; }
  createTextFinder(text) {
    const range = this;
    const opt = { entire: false, matchCase: false };
    const finder = {
      matchEntireCell(b) { opt.entire = b; return finder; },
      matchCase(b) { opt.matchCase = b; return finder; },
      findNext() {
        for (let i = 0; i < range.nr; i++) {
          for (let j = 0; j < range.nc; j++) {
            let v = String(range.sheet.cell(range.r + i, range.c + j).v);
            let t = String(text);
            if (!opt.matchCase) { v = v.toLowerCase(); t = t.toLowerCase(); }
            if (opt.entire ? v === t : v.includes(t)) return chainable(new MockRange(range.sheet, range.r + i, range.c + j, 1, 1));
          }
        }
        return null;
      },
    };
    return finder;
  }
  applyRowBanding() {
    const b = chainable({ remove: () => { this.sheet.bandings = this.sheet.bandings.filter((x) => x !== b); } });
    this.sheet.bandings.push(b);
    return b;
  }
}

class MockSpreadsheet {
  constructor() { this.sheets = [new MockSheet('시트1')]; }
  getSheetByName(n) { return this.sheets.find((s) => s.name === n) || null; }
  getSheets() { return this.sheets; }
  insertSheet(n) { const s = new MockSheet(n); this.sheets.push(s); return s; }
}

export function createGasEnv(opts = {}) {
  const ss = new MockSpreadsheet();
  if (opts.firstSheetHasData) ss.sheets[0].cell(1, 1).v = '사용자 메모';
  const props = new Map();
  const context = {
    SpreadsheetApp: {
      openById: () => ss,
      getUi: () => { throw new Error('UI 없음'); },
      BandingTheme: { GREEN: 'GREEN', LIGHT_GREY: 'LIGHT_GREY' },
      WrapStrategy: { CLIP: 'CLIP', WRAP: 'WRAP' },
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {}, tryLock: () => true }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (s) => ({ content: s, setMimeType() { return this; }, getContent() { return s; } }),
    },
    Utilities: { getUuid: () => crypto.randomUUID() },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k) => props.get(k) ?? null, setProperty: (k, v) => props.set(k, String(v)) }),
    },
    console,
  };
  vm.createContext(context);
  const code = fs.readFileSync(path.join(ROOT, 'apps-script', 'Code.gs'), 'utf8');
  vm.runInContext(code, context, { filename: 'Code.gs' });
  return {
    ss,
    context,
    sheet: () => ss.getSheetByName(context.SHEET_NAME),
    // 웹앱 호출과 같은 방식: 문자열 본문 → JSON 응답 객체
    post(bodyObj) {
      const out = context.doPost({ postData: { contents: typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj) } });
      return JSON.parse(out.getContent());
    },
    get() { return JSON.parse(context.doGet().getContent()); },
  };
}
