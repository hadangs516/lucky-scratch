# 럭키 스크래치

편의점 알바로 모은 돈으로 즉석 복권을 긁는 모바일 세로형 웹게임이에요. 설치 없이 브라우저에서 바로 실행돼요.

- 플레이: https://hadangs516.github.io/lucky-scratch/
- 게임 속 '원'은 가상 화폐예요. 실제 돈이나 상품과 연결되는 기능은 없어요.

## 문서

- [기획서](docs/GDD.md): 수치 설계, 확률, 기대값, 진행 속도
- [확률·기대값 표](docs/EV.md) / [시뮬레이션 결과](docs/SIMULATION.md)
- [결정 기록](DECISIONS.md)

## 구조

| 경로 | 내용 |
|---|---|
| `index.html`, `css/`, `js/` | 게임(빌드 도구 없는 ES 모듈) |
| `js/economy.js` | 모든 수치의 원본(게임·시뮬레이터 공용) |
| `apps-script/Code.gs` | 저장 서버(Google Apps Script 웹앱 + 구글 시트) |
| `tools/` | 시뮬레이터, 모의 서버, E2E 테스트, 이미지 생성 |
| `tests/` | 단위 테스트 |

## 개발

```bash
npm install                      # Playwright(테스트용)만 설치
npm test                         # 단위 테스트
npm run sim                      # 진행 속도 시뮬레이션
node tools/mock-server.mjs       # http://localhost:5173 (저장 서버는 Code.gs를 모의 시트로 실행)
node tools/e2e.mjs               # 모바일 화면 E2E 테스트
```

`localhost`에서 실행하면 저장 서버 대신 모의 서버(`/api`)를 써요. 공개 주소에서는 `js/config.js`의 Apps Script 웹앱 주소를 써요.

## 저장 서버 설정

1. 구글 시트에서 확장 프로그램 → Apps Script를 열고 `apps-script/Code.gs` 내용을 붙여 넣어요.
2. 배포 → 배포 관리 → 수정 → 새 버전으로 배포해요(실행 계정: 나, 액세스: 모든 사용자).
3. 시트 서식은 첫 요청 때 자동으로 적용돼요. 시트 메뉴 "럭키 스크래치 → 시트 서식 다시 적용"으로 다시 맞출 수 있어요.

## 배포

`main`에 푸시하면 GitHub Actions가 테스트 후 GitHub Pages로 배포해요(`.github/workflows/deploy.yml`).

## 알려진 한계

- 아이폰은 웹 진동을 지원하지 않아요. 무음 모드(옆 스위치)에서는 효과음이 나지 않을 수 있어요.
- 아이폰에서 홈 화면에 추가한 앱은 Safari와 저장 공간이 따로라서, 앱에서 처음 열 때 한 번 더 로그인해야 해요.
- 한 계정은 마지막으로 로그인한 기기 하나에서만 저장돼요. 앞 기기에서 마지막 저장 뒤에 한 진행(최대 1분)은 사라질 수 있어요.
- 비밀번호는 요청에 따라 시트에 원문으로 저장돼요. 다른 곳에서 쓰는 비밀번호는 쓰지 않는 게 좋아요.
