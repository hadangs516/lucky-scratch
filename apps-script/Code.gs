/**
 * 럭키 스크래치 저장 서버 (Google Apps Script 웹앱)
 *
 * 배포 설정: 실행 계정 = 나, 액세스 권한 = 모든 사용자
 * 게임은 text/plain POST로 JSON을 보낸다. 요청 종류: signup / login / save / ping
 * 시트 서식은 첫 요청 때 자동으로 잡힌다. 다시 적용하려면 편집기에서 setupSheet를 실행하거나
 * 시트 메뉴 "럭키 스크래치 > 시트 서식 다시 적용"을 누른다.
 */

var SPREADSHEET_ID = '1t_d_dA-BwH3aY85fxp5m_1XHcMlAg138vkUbmsbscWA';
var SHEET_NAME = '플레이어';
var SCHEMA_VERSION = '3';
var MAX_DATA_CHARS = 45000; // 셀 한 칸 최대 50,000자

var HEADERS = [
  '아이디', '비밀번호', '플레이 시간', '보유 금액', '최고 보유액', '회차', '클로버',
  '긁은 복권', '최고 당첨금', '가입일', '마지막 저장', '마지막 로그인',
  '(시스템) 세션', '(시스템) 저장 데이터',
];
var COL = {
  id: 1, pw: 2, play: 3, money: 4, peak: 5, stage: 6, clover: 7,
  tickets: 8, best: 9, created: 10, saved: 11, login: 12, sid: 13, data: 14,
};
var WIDTHS = [120, 80, 110, 160, 160, 100, 70, 90, 160, 140, 140, 140, 90, 220];
var ID_RE = /^[가-힣]{2,13}$/;
var PW_RE = /^[0-9]{4}$/;

// ───────────────────────── 진입점 ─────────────────────────

function doGet() {
  return json_({ ok: true, app: 'lucky-scratch' });
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, code: 'BAD_REQUEST', msg: '요청 형식이 올바르지 않아요.' });
  }
  if (req && req.a === 'ping') return json_({ ok: true });

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, code: 'BUSY', msg: '서버가 바빠요. 잠시 후 다시 시도해 주세요.' });
  }
  try {
    var sheet = sheet_();
    if (req.a === 'signup') return json_(signup_(sheet, req));
    if (req.a === 'login') return json_(login_(sheet, req));
    if (req.a === 'save') return json_(save_(sheet, req));
    return json_({ ok: false, code: 'BAD_REQUEST', msg: '알 수 없는 요청이에요.' });
  } catch (err) {
    return json_({ ok: false, code: 'SERVER', msg: '서버 오류가 났어요: ' + (err && err.message) });
  } finally {
    lock.releaseLock();
  }
}

// ───────────────────────── 요청 처리 ─────────────────────────

function signup_(sheet, req) {
  var id = cleanId_(req.id);
  var pw = String(req.pw == null ? '' : req.pw);
  if (!ID_RE.test(id)) return { ok: false, code: 'BAD_ID', msg: '아이디는 한글 2~13자로 만들어 주세요.' };
  if (!PW_RE.test(pw)) return { ok: false, code: 'BAD_PW', msg: '비밀번호는 숫자 4자리로 만들어 주세요.' };
  if (findRow_(sheet, id)) return { ok: false, code: 'TAKEN', msg: '이미 있는 아이디예요. 다른 아이디를 써 주세요.' };

  var sid = Utilities.getUuid();
  var now = new Date();
  var row = sheet.getLastRow() + 1;
  // 비밀번호 칸을 먼저 텍스트 서식으로 바꿔야 0으로 시작하는 숫자가 보존된다(0516 → 516 방지).
  sheet.getRange(row, COL.pw).setNumberFormat('@');
  sheet.getRange(row, 1, 1, HEADERS.length).setValues([[
    id, pw, 0, wonText_(0), wonText_(0), stageText_(0), 0, 0, wonText_(0), now, '', now, sid, '',
  ]]);
  formatRow_(sheet, row);
  return { ok: true, sid: sid, data: null };
}

function login_(sheet, req) {
  var id = cleanId_(req.id);
  var pw = String(req.pw == null ? '' : req.pw);
  var row = findRow_(sheet, id);
  if (!row) return { ok: false, code: 'NO_USER', msg: '없는 아이디예요. 회원가입을 먼저 해 주세요.' };
  if (storedPw_(sheet, row) !== pw) return { ok: false, code: 'WRONG_PW', msg: '비밀번호가 맞지 않아요.' };

  var sid = Utilities.getUuid();
  sheet.getRange(row, COL.sid).setValue(sid);
  sheet.getRange(row, COL.login).setValue(new Date());
  var data = String(sheet.getRange(row, COL.data).getValue() || '');
  return { ok: true, sid: sid, data: data || null };
}

function save_(sheet, req) {
  var id = cleanId_(req.id);
  var row = findRow_(sheet, id);
  if (!row) return { ok: false, code: 'NO_USER', msg: '계정을 찾을 수 없어요. 다시 로그인해 주세요.' };
  var sid = String(sheet.getRange(row, COL.sid).getValue() || '');
  if (!req.sid || sid !== String(req.sid)) {
    return { ok: false, code: 'SESSION', msg: '다른 기기에서 이 계정으로 접속해서 이 기기의 연결이 끊겼어요.' };
  }
  var data = String(req.data || '');
  if (data.length > MAX_DATA_CHARS) return { ok: false, code: 'TOO_BIG', msg: '저장 데이터가 너무 커요.' };

  var m = req.meta || {};
  var playSec = Math.max(0, Number(m.play) || 0);
  sheet.getRange(row, COL.play, 1, 7).setValues([[
    playSec / 86400,
    wonText_(m.money),
    wonText_(m.peak),
    stageText_(m.stage),
    Math.max(0, Math.floor(Number(m.clovers) || 0)),
    Math.max(0, Math.floor(Number(m.tickets) || 0)),
    wonText_(m.best),
  ]]);
  sheet.getRange(row, COL.saved).setValue(new Date());
  sheet.getRange(row, COL.data).setValue(data);
  return { ok: true };
}

// ───────────────────────── 시트 ─────────────────────────

function sheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    var first = ss.getSheets()[0];
    // 처음 만든 빈 시트(시트1)는 이름만 바꿔 쓴다. 내용이 있으면 건드리지 않고 새로 만든다.
    if (first && first.getLastRow() === 0 && first.getLastColumn() === 0) {
      sheet = first.setName(SHEET_NAME);
    } else {
      sheet = ss.insertSheet(SHEET_NAME);
    }
  }
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('schema') !== SCHEMA_VERSION || sheet.getRange(1, 1).getValue() !== HEADERS[0]) {
    setupSheet_(sheet);
    props.setProperty('schema', SCHEMA_VERSION);
  }
  return sheet;
}

/** 편집기에서 직접 실행하면 시트 서식을 다시 적용한다. */
function setupSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  setupSheet_(sheet);
  PropertiesService.getScriptProperties().setProperty('schema', SCHEMA_VERSION);
}

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('럭키 스크래치')
      .addItem('시트 서식 다시 적용', 'setupSheet')
      .addToUi();
  } catch (err) {
    // 시트와 연결되지 않은 스크립트에서는 메뉴를 만들 수 없다.
  }
}

function setupSheet_(sheet) {
  var n = HEADERS.length;
  var maxRows = sheet.getMaxRows();
  var header = sheet.getRange(1, 1, 1, n);
  header.setValues([HEADERS])
    .setFontWeight('bold')
    .setFontColor('#ffffff')
    .setBackground('#1e5b4f')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);
  sheet.setRowHeight(1, 36);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
  for (var c = 0; c < n; c++) sheet.setColumnWidth(c + 1, WIDTHS[c]);

  // 열 전체 서식(앞으로 추가될 행에도 적용)
  if (maxRows > 1) {
    var body = function (col) { return sheet.getRange(2, col, maxRows - 1, 1); };
    body(COL.pw).setNumberFormat('@');
    body(COL.play).setNumberFormat('[h]"시간 "mm"분"');
    body(COL.clover).setNumberFormat('#,##0');
    body(COL.tickets).setNumberFormat('#,##0"장"');
    body(COL.created).setNumberFormat('yyyy. mm. dd hh:mm');
    body(COL.saved).setNumberFormat('yyyy. mm. dd hh:mm');
    body(COL.login).setNumberFormat('yyyy. mm. dd hh:mm');
    sheet.getRange(2, 1, maxRows - 1, COL.login).setHorizontalAlignment('center').setVerticalAlignment('middle');
    sheet.getRange(2, COL.money, maxRows - 1, 2).setHorizontalAlignment('right');
    sheet.getRange(2, COL.best, maxRows - 1, 1).setHorizontalAlignment('right');
    sheet.getRange(2, COL.sid, maxRows - 1, 2)
      .setFontColor('#9aa5a1')
      .setFontSize(8)
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  }
  sheet.getRange(1, COL.data).setNote('게임이 읽고 쓰는 저장 데이터예요. 직접 고치면 진행 상황이 깨질 수 있어요.');
  sheet.getRange(1, COL.sid).setNote('마지막으로 로그인한 기기의 세션이에요. 지우면 그 기기는 다시 로그인해야 해요.');

  // 줄무늬(행이 늘어나도 유지되도록 열 전체에 적용)
  var bandings = sheet.getBandings();
  for (var i = 0; i < bandings.length; i++) bandings[i].remove();
  var banding = sheet.getRange(1, 1, maxRows, n).applyRowBanding(SpreadsheetApp.BandingTheme.GREEN, true, false);
  banding.setHeaderRowColor('#1e5b4f').setFirstRowColor('#ffffff').setSecondRowColor('#eef6f3');
}

function formatRow_(sheet, row) {
  sheet.getRange(row, COL.pw).setNumberFormat('@');
  sheet.getRange(row, COL.play).setNumberFormat('[h]"시간 "mm"분"');
  sheet.getRange(row, COL.created).setNumberFormat('yyyy. mm. dd hh:mm');
  sheet.getRange(row, COL.saved).setNumberFormat('yyyy. mm. dd hh:mm');
  sheet.getRange(row, COL.login).setNumberFormat('yyyy. mm. dd hh:mm');
}

function findRow_(sheet, id) {
  var last = sheet.getLastRow();
  if (last < 2 || !id) return 0;
  var cell = sheet.getRange(2, COL.id, last - 1, 1)
    .createTextFinder(id)
    .matchEntireCell(true)
    .matchCase(true)
    .findNext();
  return cell ? cell.getRow() : 0;
}

// 서식이 바뀌어 숫자로 저장돼 버린 비밀번호(516)도 0516으로 되돌려 비교한다.
function storedPw_(sheet, row) {
  var v = sheet.getRange(row, COL.pw).getValue();
  var s = String(v == null ? '' : v).trim();
  if (/^[0-9]{1,4}$/.test(s)) s = ('0000' + s).slice(-4);
  return s;
}

function cleanId_(v) {
  var s = String(v == null ? '' : v).trim();
  return s.normalize ? s.normalize('NFC') : s;
}

// ───────────────────────── 표시용 서식 ─────────────────────────

var UNITS = ['', '만', '억', '조', '경', '해', '자', '양', '구', '간', '정', '재', '극', '항하사', '아승기', '나유타', '불가사의', '무량대수'];

/** 1234567890 → "12억 3,457만 원" (큰 단위 2개까지) */
function wonText_(value) {
  var n = Math.floor(Math.max(0, Number(value) || 0));
  if (n < 10000) return comma_(n) + '원';
  var exp = Math.floor(Math.log(n) / Math.LN10 / 4);
  // 로그 반올림 오차 보정
  if (Math.floor(n / Math.pow(10000, exp)) >= 10000) exp++;
  if (Math.floor(n / Math.pow(10000, exp)) < 1) exp--;
  if (exp >= UNITS.length) return n.toExponential(2) + '원';
  var big = Math.floor(n / Math.pow(10000, exp));
  var rest = Math.floor((n - big * Math.pow(10000, exp)) / Math.pow(10000, exp - 1));
  var s = comma_(big) + UNITS[exp];
  if (rest > 0) s += ' ' + comma_(rest) + UNITS[exp - 1];
  return s + ' 원';
}

function comma_(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function stageText_(stage) {
  var s = Math.max(0, Math.floor(Number(stage) || 0));
  return s >= 5 ? '무한 모드' : (s + 1) + '회차';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
