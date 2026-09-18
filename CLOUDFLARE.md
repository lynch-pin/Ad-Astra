# Cloudflare 설정 가이드 (lone-trail.com)

이 저장소는 **Cloudflare Workers + 정적 자산(Workers Assets)** 으로 배포됩니다. 번들러나 빌드 단계가 없습니다.

- `public/` 안의 파일들이 정적 자산으로 업로드되어 그대로 서빙됩니다.
- `worker/index.js`는 자산에 해당하는 파일이 **없을 때만** 실행됩니다. `/api/apod`가 여기로 들어옵니다.
- `wrangler.jsonc`가 이 둘을 묶습니다. 업로드 대상이 `public/`으로 못 박혀 있어서 `.git`이나 Worker 소스는 웹에 노출되지 않습니다.

> ⚠️ Pages가 아닙니다. Pages의 `functions/` 디렉터리 규칙이나 `_redirects`의 절대 URL 문법은 여기서 동작하지 않습니다.

---

## 1. Workers 프로젝트

대시보드 → **Workers & Pages** → **Create** → **Import a repository** → `lynch-pin/Ad-Astra`

빌드 설정은 이렇게 둡니다:

| 항목 | 값 |
| --- | --- |
| Build command | **(비워둠)** |
| Deploy command | **`npx wrangler deploy`** |
| Production branch | `main` |

배포되면 `<이름>.<계정>.workers.dev` 주소가 생깁니다. 이후 `main`에 푸시할 때마다 자동 재배포됩니다.

Worker 이름은 `wrangler.jsonc`의 `name` 필드(`ad-astra`)를 따릅니다. 대시보드에서 다른 이름으로 만들었다면 이 값을 맞춰야 같은 Worker로 배포됩니다.

## 2. NASA API 키

1. https://api.nasa.gov 에서 이메일만 넣으면 키가 바로 발급됩니다(무료).
2. Worker → **Settings** → **Variables and Secrets** → **Add**
   - Type: **Secret**
   - Name: `NASA_API_KEY`
   - Value: 발급받은 키
3. 시크릿은 새 배포부터 적용되므로 한 번 재배포합니다.

키를 등록하지 않아도 사이트는 동작합니다. NASA의 `DEMO_KEY`로 떨어지는데 IP당 시간당 30회 제한이 있어서, 한도를 넘으면 `/api/apod`가 502를 주고 배경은 별만 남습니다.

확인: `https://<worker 주소>/api/apod` 에서 `{"image": "...", "title": "..."}` 형태의 JSON이 나오면 정상입니다.

## 3. lone-trail.com 연결

도메인이 이미 Cloudflare DNS에서 관리되고 있어야 합니다(대시보드에 **Active**로 표시).

Worker → **Settings** → **Domains & Routes** → **Add** → **Custom domain** → `lone-trail.com`

**DNS 레코드는 Cloudflare가 자동으로 생성합니다.** 직접 A나 CNAME을 만들지 마세요. apex 도메인이 가능한 이유는 Cloudflare가 CNAME flattening을 처리하기 때문입니다.

기존에 `lone-trail.com` 이름으로 A/AAAA/CNAME 레코드가 남아 있으면 충돌하니, DNS 탭에서 먼저 확인하고 안 쓰는 것은 지웁니다. 다른 서브도메인 레코드는 영향받지 않습니다.

### www도 쓰고 싶다면

`_redirects`로는 처리할 수 없습니다(Workers 정적 자산은 상대 경로 리다이렉트만 허용). 대신 도메인 → **Rules** → **Redirect Rules**에서 규칙을 하나 만듭니다.

- If: Hostname equals `www.lone-trail.com`
- Then: Dynamic redirect, `concat("https://lone-trail.com", http.request.uri.path)`, 301

### SSL/TLS

도메인 → **SSL/TLS**:

- **Encryption mode: Full (strict)**
- **Edge Certificates → Always Use HTTPS: 켜기**

## 4. 로컬 실행

```bash
npm install wrangler
npx wrangler dev          # 정적 자산 + /api/apod 까지 실제 배포와 동일하게 동작
```

배포 전 설정 검증만 하려면:

```bash
npx wrangler deploy --dry-run
```

## 5. 배포 후 확인 목록

- [ ] `https://lone-trail.com` 접속 시 문구와 별 배경이 보인다
- [ ] 화면을 드래그하면 하늘이 돌아간다
- [ ] 스크롤하면 두 번째 화면으로 넘어가고 영상이 자동 재생된다
- [ ] `https://lone-trail.com/api/apod` 가 JSON을 준다
- [ ] `https://lone-trail.com/worker/apod.js` 가 **404**다 (소스가 노출되면 안 됨)

## 문제 해결

| 증상 | 원인 / 조치 |
| --- | --- |
| 배포 시 `Invalid _redirects configuration: Only relative URLs are allowed` | Workers는 절대 URL 리다이렉트를 허용하지 않습니다. 위의 Redirect Rules를 쓰세요 |
| 업로드 목록에 `.git/...`이 보임 | `wrangler.jsonc`의 `assets.directory`가 `./public`이 아니라 `.`로 되어 있음 |
| `/api/apod` 가 404 | `wrangler.jsonc`에 `main`이 빠졌거나 Worker가 배포되지 않음 (정적 자산만 올라간 상태) |
| `/api/apod` 가 502 | NASA 키 미등록(DEMO_KEY 한도 소진) 또는 NASA API 일시 장애. 별 배경은 정상 동작하므로 급하지 않음 |
| 배경 사진이 안 뜸 | 정상 동작입니다 — APOD는 선택 레이어이고, 그날 APOD가 영상이면 썸네일을 씁니다 |
| 영상이 안 뜸 | `public/_headers`의 CSP `frame-src`에서 youtube 도메인이 지워졌는지 확인 |
| 영상 소리가 안 남 | 브라우저 정책상 자동 재생은 음소거만 허용됩니다. **소리 켜기** 버튼을 쓰세요 |
