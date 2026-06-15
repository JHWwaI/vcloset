# vcloset — AI 가상 피팅 서비스

사용자가 본인 사진과 옷 사진을 올리면 AI가 **그 옷을 입은 모습**을 합성해 보여주는 개인 가상 옷장 웹서비스.
2020년 가상착장 파이프라인(YOLO + OpenPose + VITON)을 2026년 디퓨전 VTON(CatVTON / IDM-VTON)으로 재구축한 프로젝트.

## 📂 폴더 구조

```
vcloset/
├── app/        ← 실행 가능한 전체 코드 (Next.js 16 + FastAPI 추론 브릿지)
└── docs/       ← 산출 문서
    ├── vcloset_개발백서.docx              개발 전 과정 (기획→설계→구현→배포→테스트→출시)
    ├── vcloset_사업보고서_경영기획영업.docx   비개발 직군용 사업 보고서
    ├── *_preview.pdf                     위 문서 PDF 미리보기
    ├── diagrams/                         플로우차트 PNG
    └── screenshots/                      실합성 결과 (원본·옷·결과 3패널 × 3세트) + 라이브 캡처
```

> `app/node_modules`, `app/.next`, `app/.git` 는 용량 문제로 제외(재생성 가능).
> 처음 받으면 `npm install` 로 의존성을 복원하면 된다.

## 🚀 실행 (app/)

```powershell
cd app
npm install
copy .env.example .env          # AUTH_SECRET 채우기
npx prisma migrate deploy
npx tsx scripts/seed-demo.ts    # 데모 계정 + 인물 4 · 옷 5 시드
npx next dev                    # http://localhost:3000
```

데모 계정: `demo@vcloset.local` / `demo1234`

### AI 합성 켜기 (선택)

기본은 placeholder(옷 이미지 그대로). 실제 합성은 추론 백엔드를 연결한다.

```powershell
# 무료 — Hugging Face 공개 CatVTON Space 중계 브릿지
cd app/inference
$env:HF_TOKEN = "<HF 토큰>"      # 사용량 한도 확보 (선택)
uv run uvicorn hf_space_bridge:app --port 8899
# → .env 의 INFERENCE_URL="http://localhost:8899"
```

운영용은 `.env` 에 `REPLICATE_API_TOKEN` 만 넣으면 IDM-VTON(Replicate)으로 자동 전환된다.

## 🧱 기술 스택

| 영역 | 스택 |
|---|---|
| 프론트/백 | Next.js 16 (App Router) · TypeScript · Tailwind v4 |
| 인증 | NextAuth v5 (Credentials) |
| 데이터 | Prisma · SQLite(개발) → PostgreSQL(운영) |
| AI 추론 | CatVTON / IDM-VTON (사전학습) · rembg 배경 제거 |
| 추론 백엔드 | HF Space 브릿지(기본·무료) · Colab · Modal · Replicate(선택) — 환경변수로 전환 |

## ✅ 기능 / 품질 요약 (2026-06-12 실측)

- **상의·하의** 가상 피팅 — 무늬·로고 보존 검증. 합성 20~50초, 동일 조합 캐시 0.1초.
- 크레딧 차감/환불 **트랜잭션 + 장부(원장)** — 실패 시 자동 환불.
- 테스트: 기능 7/7 · 엔진 검증 통과 · 장애 5+1/6 · 입력검증 3/3 — **결함 0건**.
- 상세: `docs/vcloset_개발백서.docx`(기술) / `docs/vcloset_사업보고서_경영기획영업.docx`(비기술).

## 📌 직군 매칭

풀스택 백엔드(인증·트랜잭션·캐시·멀티 백엔드 추상화) + 컴퓨터 비전(VTON 파이프라인 서빙). 자소서 ‘성장과정’의 2020→2026 비전 파이프라인 진화 서사와 연결.

## ⚠️ 정직 고지

합성 **모델 자체는 사전학습 오픈소스를 활용**했다. 직접 설계·구현한 것은 그 모델을 제품으로 만드는 **서비스 전체**(옷장·크레딧·캐시·실패 환불·멀티 백엔드 폴백·전처리)다. 신발·액세서리는 VTON 기술 범위 밖이라 미지원, 원피스는 검증 후 오픈 예정.
