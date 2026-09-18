# Cloudflare 설정 가이드 (lone-trail.com)

이 저장소를 그대로 Cloudflare Pages에 올리면 됩니다. 빌드 과정이 없어서 설정이 짧습니다.

---

## 1. Pages 프로젝트 만들기

Cloudflare 대시보드 → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → 이 저장소(`lynch-pin/ad-astra`) 선택.

빌드 설정은 이렇게 둡니다:

| 항목 | 값 |
| --- | --- |
| Framework preset | **None** |
| Build command | **(비워둠)** |
| Build output directory | **`/`** (저장소 루트) |
| Root directory | **(비워둠)** |
| Production branch | `main` (원하는 브랜치) |

> 번들러가 없으므로 빌드 명령이 없어야 합니다. 출력 디렉터리를 루트로 둬야 `_headers`, `_redirects`, `functions/`가 함께 인식됩니다.

저장하면 첫 배포가 돌고 `<프로젝트이름>.pages.dev` 주소가 생깁니다.

## 2. NASA API 키 등록

1. https://api.nasa.gov 에서 이메일만 넣으면 키가 바로 발급됩니다(무료).
2. Pages 프로젝트 → **Settings** → **Variables and Secrets** → **Add**
   - Type: **Secret**
   - Name: `NASA_API_KEY`
   - Value: 발급받은 키
   - **Production과 Preview 양쪽에 각각 등록**합니다.
3. 환경 변수는 새 배포부터 적용되므로 **Deployments → 마지막 배포 → Retry deployment**로 한 번 재배포합니다.

키를 등록하지 않아도 사이트는 동작합니다. 이 경우 NASA의 `DEMO_KEY`로 떨어지는데 IP당 시간당 30회 제한이 있어서, 한도를 넘으면 `/api/apod`가 502를 주고 배경은 별만 남습니다.

확인: `https://<프로젝트>.pages.dev/api/apod` 를 열어 `{"image": "...", "title": "..."}` 형태의 JSON이 나오면 정상입니다.

> `functions/` 디렉터리는 Pages가 자동으로 인식합니다. `functions/api/apod.js` → `/api/apod` 라우트가 되며, 별도 설정이나 `wrangler.toml`이 필요 없습니다.

## 3. lone-trail.com 연결

**먼저 도메인이 Cloudflare에 있어야 합니다.** 대시보드 → **Add a domain** 으로 `lone-trail.com`을 추가하고, 도메인을 산 등록업체(레지스트라)에서 네임서버를 Cloudflare가 알려주는 두 개로 바꿉니다. 전파에 보통 몇 분~수 시간 걸립니다.

> apex 도메인(`lone-trail.com`, www 없는 주소)을 Pages에 붙이려면 Cloudflare DNS를 써야 합니다. CNAME flattening이 필요하기 때문입니다. `www`만 쓸 거라면 외부 DNS에서도 CNAME으로 가능합니다.

네임서버가 활성화되면 Pages 프로젝트 → **Custom domains** → **Set up a domain**:

1. `lone-trail.com` 추가 → DNS 레코드(프록시된 CNAME)가 자동 생성됩니다.
2. `www.lone-trail.com` 도 같은 방식으로 추가합니다. 저장소의 `_redirects`가 www로 들어온 요청을 apex로 301 보냅니다.

인증서는 Cloudflare가 자동 발급하며 보통 몇 분 안에 활성화됩니다.

### SSL/TLS 권장 설정

도메인 → **SSL/TLS**:

- **Encryption mode: Full (strict)**
- **Edge Certificates → Always Use HTTPS: 켜기**
- **Automatic HTTPS Rewrites: 켜기**

## 4. 헤더와 캐시

`_headers` 파일이 배포 시 자동 적용됩니다. 보안 헤더와 CSP가 들어 있는데, **CSP는 외부 리소스를 화이트리스트로 관리**하므로 나중에 폰트나 분석 스크립트를 추가하면 해당 도메인을 같이 넣어야 합니다. 현재 허용된 것:

- 이미지: `apod.nasa.gov`, `*.nasa.gov`, `i.ytimg.com`, `img.youtube.com`
- iframe: `youtube-nocookie.com`, `youtube.com`
- 스크립트/통신: 같은 출처만

HTML은 `max-age=0, must-revalidate`라 배포하면 바로 반영되고, JS/CSS는 1시간 캐시됩니다. 즉시 반영이 필요하면 도메인 → **Caching** → **Purge Everything**.

## 5. CLI로 배포하기 (선택)

Git 연동 대신 직접 올리는 방법:

```bash
npx wrangler login
npx wrangler pages deploy . --project-name=lone-trail
```

CLI로 시크릿을 넣으려면:

```bash
npx wrangler pages secret put NASA_API_KEY --project-name=lone-trail
```

## 6. 배포 후 확인 목록

- [ ] `https://lone-trail.com` 접속 시 문구와 별 배경이 보인다
- [ ] 화면을 드래그하면 하늘이 돌아간다
- [ ] `https://lone-trail.com/api/apod` 가 JSON을 준다 (502면 2번 항목 확인)
- [ ] 스크롤하면 두 번째 화면으로 넘어가고 영상이 자동 재생된다
- [ ] `https://www.lone-trail.com` 이 apex로 넘어간다

## 문제 해결

| 증상 | 원인 / 조치 |
| --- | --- |
| `/api/apod` 가 404 | Build output directory가 `/`가 아니거나 `functions/`가 배포에 빠짐 |
| `/api/apod` 가 502 | NASA 키 미등록(DEMO_KEY 한도 소진) 또는 NASA API 일시 장애. 배경은 정상 동작하므로 급하지 않음 |
| 배경 사진이 안 뜸 | 정상 동작입니다 — APOD는 선택 레이어이고, 그날 APOD가 영상이면 썸네일을 씁니다 |
| 영상이 안 뜸 | `_headers`의 CSP `frame-src`에서 youtube 도메인이 지워졌는지 확인 |
| 영상 소리가 안 남 | 브라우저 정책상 자동 재생은 음소거만 허용됩니다. **소리 켜기** 버튼을 쓰세요 |
| 커스텀 도메인이 "Pending" | 네임서버 전파 대기 중. 레지스트라에서 NS가 Cloudflare 것으로 바뀌었는지 확인 |
