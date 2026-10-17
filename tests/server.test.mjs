// apps-script/Code.gs 동작 테스트(모의 시트 환경)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGasEnv } from '../tools/gas-mock.mjs';

test('회원가입: 시트를 만들고 한글 헤더와 행을 쓴다', () => {
  const env = createGasEnv();
  const r = env.post({ a: 'signup', id: '홍길동', pw: '1234' });
  assert.equal(r.ok, true);
  assert.ok(r.sid);
  const sh = env.sheet();
  assert.equal(sh.getName(), '플레이어');
  assert.equal(sh.cell(1, 1).v, '아이디');
  assert.equal(sh.cell(1, 2).v, '비밀번호');
  assert.equal(sh.cell(2, 1).v, '홍길동');
  assert.equal(sh.cell(2, 6).v, '1회차');
  assert.equal(sh.frozenRows, 1);
  assert.equal(env.ss.getSheets().length, 1, '빈 시트1은 이름만 바꿔 쓴다');
});

test('앞자리 0 비밀번호가 문자열로 보존된다', () => {
  const env = createGasEnv();
  env.post({ a: 'signup', id: '김영희', pw: '0516' });
  const sh = env.sheet();
  assert.strictEqual(sh.cell(2, 2).v, '0516');
  assert.equal(env.post({ a: 'login', id: '김영희', pw: '0516' }).ok, true);
  assert.equal(env.post({ a: 'login', id: '김영희', pw: '516' }).code, 'WRONG_PW');
});

test('서식이 풀려 숫자가 된 비밀번호도 0을 채워 비교한다', () => {
  const env = createGasEnv();
  env.post({ a: 'signup', id: '박철수', pw: '0007' });
  const sh = env.sheet();
  sh.cell(2, 2).v = 7; // 누군가 서식을 바꿔 숫자로 저장된 상황
  assert.equal(env.post({ a: 'login', id: '박철수', pw: '0007' }).ok, true);
});

test('아이디·비밀번호 규칙을 검사한다', () => {
  const env = createGasEnv();
  assert.equal(env.post({ a: 'signup', id: '가', pw: '1234' }).code, 'BAD_ID');
  assert.equal(env.post({ a: 'signup', id: 'abc', pw: '1234' }).code, 'BAD_ID');
  assert.equal(env.post({ a: 'signup', id: '가나다라마바사아자차카타파하', pw: '1234' }).code, 'BAD_ID'); // 14자
  assert.equal(env.post({ a: 'signup', id: '가나다라마바사아자차카타파', pw: '1234' }).ok, true); // 13자
  assert.equal(env.post({ a: 'signup', id: '홍길 동', pw: '1234' }).code, 'BAD_ID');
  assert.equal(env.post({ a: 'signup', id: 'ㅎㅎ', pw: '1234' }).code, 'BAD_ID');
  assert.equal(env.post({ a: 'signup', id: '홍길동', pw: '123' }).code, 'BAD_PW');
  assert.equal(env.post({ a: 'signup', id: '홍길동', pw: '12a4' }).code, 'BAD_PW');
});

test('중복 아이디는 거절한다', () => {
  const env = createGasEnv();
  assert.equal(env.post({ a: 'signup', id: '홍길동', pw: '1234' }).ok, true);
  assert.equal(env.post({ a: 'signup', id: '홍길동', pw: '9999' }).code, 'TAKEN');
  assert.equal(env.post({ a: 'signup', id: '홍길', pw: '9999' }).ok, true, '부분 일치는 중복이 아니다');
});

test('없는 아이디 로그인', () => {
  const env = createGasEnv();
  assert.equal(env.post({ a: 'login', id: '없는사람', pw: '1234' }).code, 'NO_USER');
});

test('저장 후 로그인하면 데이터를 돌려주고, 표시용 열을 채운다', () => {
  const env = createGasEnv();
  const s = env.post({ a: 'signup', id: '홍길동', pw: '1234' });
  const data = JSON.stringify({ v: 1, money: 123 });
  const r = env.post({ a: 'save', id: '홍길동', sid: s.sid, data, meta: { play: 3725, money: 1234567890, peak: 9e12, stage: 2, clovers: 15, tickets: 321, best: 50000 } });
  assert.equal(r.ok, true);
  const sh = env.sheet();
  assert.equal(sh.cell(2, 3).v, 3725 / 86400);
  assert.equal(sh.cell(2, 3).fmt, '[h]"시간 "mm"분"');
  assert.equal(sh.cell(2, 4).v, '12억 3,456만 원');
  assert.equal(sh.cell(2, 5).v, '9조 원');
  assert.equal(sh.cell(2, 6).v, '3회차');
  assert.equal(sh.cell(2, 9).v, '5만 원');
  const l = env.post({ a: 'login', id: '홍길동', pw: '1234' });
  assert.equal(l.data, data);
});

test('나중에 로그인한 기기만 저장할 수 있다', () => {
  const env = createGasEnv();
  const a = env.post({ a: 'signup', id: '홍길동', pw: '1234' });
  const b = env.post({ a: 'login', id: '홍길동', pw: '1234' });
  assert.notEqual(a.sid, b.sid);
  assert.equal(env.post({ a: 'save', id: '홍길동', sid: a.sid, data: '{}', meta: {} }).code, 'SESSION');
  assert.equal(env.post({ a: 'save', id: '홍길동', sid: b.sid, data: '{}', meta: {} }).ok, true);
  assert.equal(env.post({ a: 'save', id: '홍길동', sid: '', data: '{}', meta: {} }).code, 'SESSION');
});

test('너무 큰 저장 데이터와 잘못된 요청을 거절한다', () => {
  const env = createGasEnv();
  const s = env.post({ a: 'signup', id: '홍길동', pw: '1234' });
  assert.equal(env.post({ a: 'save', id: '홍길동', sid: s.sid, data: 'x'.repeat(46000), meta: {} }).code, 'TOO_BIG');
  assert.equal(env.post('not json').code, 'BAD_REQUEST');
  assert.equal(env.post({ a: 'hack' }).code, 'BAD_REQUEST');
  assert.equal(env.post({ a: 'ping' }).ok, true);
  assert.equal(env.get().ok, true);
});

test('첫 시트에 내용이 있으면 덮어쓰지 않고 새 시트를 만든다', () => {
  const env = createGasEnv({ firstSheetHasData: true });
  env.post({ a: 'signup', id: '홍길동', pw: '1234' });
  assert.equal(env.ss.getSheets().length, 2);
  assert.equal(env.ss.getSheets()[0].cell(1, 1).v, '사용자 메모');
});

test('금액 표기: 한국식 단위 2개까지', () => {
  const env = createGasEnv();
  const w = env.context.wonText_;
  assert.equal(w(0), '0원');
  assert.equal(w(9999), '9,999원');
  assert.equal(w(10000), '1만 원');
  assert.equal(w(99999999), '9,999만 9,999 원');
  assert.equal(w(100000000), '1억 원');
  assert.equal(w(1e12), '1조 원');
  assert.equal(w(1e16 + 2e12), '1경 2조 원');
  assert.equal(w(1e100), '1.00e+100원');
  assert.equal(w(-5), '0원');
  assert.equal(w('abc'), '0원');
});

test('시트 최대 행 수를 넘으면 행을 늘려서 가입을 받는다', () => {
  const env = createGasEnv();
  env.post({ a: 'signup', id: '첫번째', pw: '1234' });
  env.sheet().maxRows = 2;
  const r = env.post({ a: 'signup', id: '두번째', pw: '0001' });
  assert.equal(r.ok, true);
  assert.ok(env.sheet().maxRows > 2);
  assert.strictEqual(env.sheet().cell(3, 2).v, '0001');
});
