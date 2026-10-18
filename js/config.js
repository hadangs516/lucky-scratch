// 저장 서버(Google Apps Script 웹앱) 주소
export const API_URL = 'https://script.google.com/macros/s/AKfycbwuUbg0ToxelRad9wKpPqIAl7UvY_fD_4in8v6jxu2rTfpa6l1pm2ivniWxVYjJ0qTT/exec';

export const AUTOSAVE_SEC = 60; // 서버 자동저장 주기
export const LOCAL_SAVE_SEC = 5; // 브라우저 저장 주기
export const APP_VERSION = '3.0.0';

// 테스트용 모의 서버는 내 컴퓨터(localhost)에서 실행할 때만 쓴다.
// 공개 주소에서는 링크에 다른 서버 주소를 넣어도 무시한다(비밀번호 가로채기 방지).
export function apiUrl() {
  const h = globalThis.location?.hostname;
  if (h === 'localhost' || h === '127.0.0.1') {
    const q = new URLSearchParams(location.search).get('api');
    return q || `${location.origin}/api`;
  }
  return API_URL;
}
