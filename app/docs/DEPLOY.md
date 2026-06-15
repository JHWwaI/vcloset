# Production Deploy Guide (무료 스택)

수천명 운영을 목표로 한 무료 티어 인프라 셋업.

## 최종 구성

```
[Cloudflare CDN]
    ↓
[Vercel] — Next.js 프론트 + API
    ↓
[Neon] — PostgreSQL DB
[Cloudflare R2] — 이미지 스토리지
[Replicate] — IDM-VTON 추론 (페이용)
[Upstash Redis] — Rate limit / 캐시 (선택)
[Sentry] — 에러 모니터링 (선택)
```

비용: 사용자 0~500명 ≈ **₩0/월 + Replicate 사용량 (호출당 ₩70-150)**

---

## Step 1. Neon Postgres (5분)

1. https://neon.tech → "Sign up" → GitHub 로그인
2. New Project → 이름 `vcloset` → Region: ap-southeast-1 (Singapore) 또는 가까운 곳
3. 생성 완료 화면에서 **Connection string** 복사 (postgresql://...)

### 로컬에서 마이그레이션

```bash
cd path/to/vcloset

# 1) schema.prisma 의 provider 를 변경
#    "sqlite" → "postgresql"
#    (이미 코드는 호환됨)

# 2) 기존 SQLite 마이그레이션 삭제
rm -rf prisma/migrations

# 3) Postgres 용으로 새 마이그레이션 생성
DATABASE_URL="postgresql://..." npx prisma migrate dev --name init

# 4) 테스트 계정 다시 만들기
DATABASE_URL="postgresql://..." npx tsx scripts/seed-admin.ts
```

`.env` 의 `DATABASE_URL` 도 Postgres 로 교체.

---

## Step 2. Cloudflare R2 (10분)

1. https://dash.cloudflare.com → R2 → "Create bucket"
2. Bucket name: `vcloset-uploads`, location: APAC
3. **Settings → Public access** → Enable (또는 custom domain)
   - Public URL 예: `https://pub-xxxxx.r2.dev`
4. **R2 → Manage R2 API Tokens** → Create API token
   - Permissions: Object Read & Write
   - Bucket: vcloset-uploads
   - 토큰의 Access Key ID / Secret 복사

### `.env` 추가

```bash
STORAGE_DRIVER=s3
S3_ENDPOINT=https://<your-account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=vcloset-uploads
S3_ACCESS_KEY_ID=<R2 access key>
S3_SECRET_ACCESS_KEY=<R2 secret>
S3_PUBLIC_BASE_URL=https://pub-xxxxx.r2.dev
```

### `next.config.ts` 에 R2 도메인 추가 (이미지 표시용)

```ts
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'pub-xxxxx.r2.dev' }],
  },
};
```

---

## Step 3. Replicate (이미 셋업)

`.env` 에:
```bash
REPLICATE_API_TOKEN=r8_xxxxx
```

---

## Step 4. Vercel 배포 (5분)

```bash
# 1) 코드를 GitHub 에 push (없으면 새 repo 생성)
gh repo create vcloset --private --source=. --push

# 2) Vercel 가입 → https://vercel.com/signup (GitHub 로그인)

# 3) "Add New Project" → vcloset repo 선택 → Import

# 4) Environment Variables 에 .env 의 모든 값 붙여넣기
#    AUTH_SECRET, AUTH_URL (https://vcloset.vercel.app), DATABASE_URL,
#    REPLICATE_API_TOKEN, STORAGE_DRIVER, S3_*

# 5) Deploy 클릭
```

배포 후 자동으로 `vcloset.vercel.app` URL 발급됨.

### Vercel 환경변수 주의

| 키 | 값 |
|----|----|
| AUTH_SECRET | `openssl rand -base64 32` 결과 |
| AUTH_URL | 배포 URL (https 포함, 끝 슬래시 X) |
| DATABASE_URL | Neon connection string (`?sslmode=require` 포함) |
| STORAGE_DRIVER | `s3` |
| S3_* | R2 값들 |
| REPLICATE_API_TOKEN | Replicate 토큰 |

---

## Step 5. (선택) Upstash Redis — Rate Limit

- https://upstash.com → Redis → Create database (무료, 10K cmd/일)
- REST URL / Token 복사 → `.env` 에:
  ```
  UPSTASH_REDIS_REST_URL=...
  UPSTASH_REDIS_REST_TOKEN=...
  ```

(코드 통합은 추후 별도 PR)

---

## Step 6. (선택) Sentry

- https://sentry.io → 무료 가입 (개발자 1명, 5K events/월)
- New Project → Next.js → DSN 복사 → `.env` 의 `SENTRY_DSN=`
- `npm install @sentry/nextjs` + sentry.client/server.config.ts 추가

---

## 환경 분리 컨벤션

| 파일 | 용도 | git? |
|------|------|------|
| `.env` | 로컬 dev 기본값 | ❌ ignore |
| `.env.local` | 개인 로컬 오버라이드 | ❌ ignore |
| `.env.example` | 다른 사람용 템플릿 | ✅ commit |
| Vercel Environment | 운영 값 | (UI에서 관리) |

---

## 배포 후 체크리스트

- [ ] `https://vcloset.vercel.app/` 접속 OK
- [ ] 가입 → 무료 크레딧 5장 부여 확인
- [ ] 사진 업로드 → R2 URL 로 저장됨
- [ ] 옷 추가 → 배경 제거 동작
- [ ] 입어보기 → Replicate 호출 → 결과 R2 저장
- [ ] Vercel Logs 에 에러 없음

---

## 사용자 1,000명 시 예상 비용

| 서비스 | 사용량 | 비용 |
|--------|--------|------|
| Vercel | <100GB 대역폭 | ₩0 (Hobby) |
| Neon | <0.5GB DB | ₩0 |
| R2 | <10GB 스토리지 | ₩0 (전송 무료) |
| Replicate | 10K 호출/월 | ~₩1,000,000 (₩100/호출 가정) |
| Upstash | <10K cmd/일 | ₩0 |
| Sentry | <5K events/월 | ₩0 |
| **합계** | | **~₩1M/월** |

매출 가정 (Basic ₩7,900 × 200명 유료) ≈ ₩1.58M → BEP 약 130 유료 사용자.
