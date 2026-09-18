# Ad-Astra — lone-trail.com

`lone-trail.com` 메인 홈페이지 프로토타입. 빌드 도구 없는 정적 사이트 + Cloudflare Worker 하나로 이루어져 있습니다.

## 구성

| 파일 | 역할 |
| --- | --- |
| `public/index.html` | 두 개의 전체 화면 패널 (히어로 / 영상), 스크롤 스냅 |
| `public/styles.css` | 전체 스타일 |
| `public/sky.js` | 드래그로 둘러보는 별 배경 (canvas), NASA APOD 레이어 로딩 |
| `public/video.js` | 두 번째 패널의 YouTube 임베드 제어 |
| `public/_headers` | 보안 헤더 / CSP / 캐시 |
| `worker/index.js` | 자산에 없는 경로만 처리하는 Worker 진입점 |
| `worker/apod.js` | NASA APOD API 프록시 |
| `wrangler.jsonc` | `public/`을 정적 자산으로, `worker/`를 코드로 묶는 설정 |

`public/` 안의 파일만 웹에 올라갑니다. `.git`, `README.md`, Worker 소스는 업로드 대상이 아니라 노출되지 않습니다.

## 화면

1. **첫 화면** — 가운데에 `There is nothing here… For now`. 배경은 별이 가득한 하늘이고, **아무 곳이나 드래그하면 하늘이 돌아갑니다** (관성 포함). 문구 위에서 드래그를 시작해도 동작합니다. 키보드는 방향키(배경에 포커스가 있을 때), 모바일은 좌우 드래그로 회전하고 상하 스와이프는 페이지 스크롤로 넘깁니다.
2. **두 번째 화면** — 스크롤하면 한 페이지가 넘어가고, 화면에 들어오는 순간 영상이 **음소거 상태로 자동 재생**됩니다. 브라우저는 소리가 있는 자동 재생을 막기 때문에, 바로 아래의 **소리 켜기 / Unmute** 버튼이나 썸네일 클릭으로 소리를 켭니다. 위로 다시 스크롤하면 자동으로 일시정지됩니다.

## 별 배경과 NASA API

별 자체는 브라우저에서 직접 그립니다. 고정 시드를 쓰기 때문에 누가 접속해도 같은 하늘이 나오고, **외부 API가 죽어도 배경은 항상 동작합니다.**

그 뒤에 NASA의 **APOD(오늘의 천체 사진)** 이미지가 은은하게 깔립니다. 이 이미지는 `/api/apod`를 통해 가져오며, 실제 NASA 호출은 Worker에서 일어납니다 — API 키가 브라우저로 내려가지 않고, 응답은 30분간 엣지에 캐시되어 방문자가 늘어도 NASA 호출은 한 번입니다. 호출이 실패하면 별 배경만 조용히 남습니다.

## 로컬 실행

```bash
npm install wrangler
npx wrangler dev            # 정적 자산 + /api/apod 까지 실제 배포와 동일하게 동작
npx wrangler deploy --dry-run   # 설정 검증만
```

배포 및 도메인 설정은 [CLOUDFLARE.md](./CLOUDFLARE.md) 참고.
