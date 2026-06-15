# Modal IDM-VTON 셋업 가이드

무료 Modal 크레딧($30/월, 매월 갱신) 으로 IDM-VTON 을 셀프 호스팅합니다.
Colab/ngrok 같이 자주 끊기는 일 없음, 24/7 동작.

## 비용 감각

| GPU | $/s | 30s 추론당 | $30/월 으로 |
|------|-----|-----------|-------------|
| A10G (24GB) | 0.0011 | $0.033 | ~900 호출 |
| A100 (40GB) | 0.0040 | $0.120 | ~250 호출 |

→ A10G 면 베타 사용자 100명 × 9회/월 시 무료 한도 안에 들어옴.

---

## 셋업 (5분)

### 1. Modal 가입

https://modal.com → "Sign Up with GitHub"
- 무료 $30/월 크레딧 자동 부여, 카드 불필요

### 2. CLI 설치 + 로그인

```bash
cd path/to/vcloset
python3 -m pip install --user modal
python3 -m modal token new
# 브라우저 열림 → "Authorize" 클릭 → 터미널 자동 인증
```

### 3. 배포

```bash
python3 -m modal deploy inference/modal_idm_vton.py
```

처음엔 컨테이너 이미지 빌드 + IDM-VTON 가중치 다운로드 (~10분).
이후 deploy 는 변경 사항만 빠르게 적용 (수십 초).

성공하면 출력 끝부분에 두 URL 이 보입니다:

```
✓ Created web function IDMVTON.try_on
  https://your-username--vcloset-idm-vton-idmvton-try-on.modal.run
✓ Created web function IDMVTON.health
  https://your-username--vcloset-idm-vton-idmvton-health.modal.run
```

### 4. .env 갱신

위 두 URL 의 공통 prefix 를 `INFERENCE_URL` 에 넣습니다. 다만 Modal 의 endpoint 패턴이 Colab 과 다르므로 코드 한 줄 조정이 필요합니다 — 가이드 끝 참조.

빠른 셋팅:
```
# .env
INFERENCE_URL="https://your-username--vcloset-idm-vton-idmvton-try-on.modal.run"
INFERENCE_MODE="modal"   # ← 새 키, 기본은 colab
REPLICATE_API_TOKEN=""
```

### 5. dev 서버 재시작

```bash
pkill -f "next dev"
PORT=3001 npm run dev
```

브라우저 → 입어보기. 첫 호출은 cold-start 로 60~90초, 이후 호출 25~40초.

---

## 동작 확인

```bash
curl https://your-username--vcloset-idm-vton-idmvton-health.modal.run
# → {"ok":true,"model":"IDM-VTON","host":"modal"}
```

---

## 운영 메모

- **Scaledown**: 120초 동안 호출 없으면 컨테이너 종료 → 비용 0
- **Cold start**: 종료 후 첫 호출은 모델 로드 (~30초)
- **Volume 캐시**: 모델 가중치는 영구 볼륨에 저장 → cold start 짧아짐
- **Concurrency**: 기본 1 컨테이너 = 1 동시 추론. 트래픽 늘면 `max_containers` 조정
- **모니터링**: https://modal.com/apps → vcloset-idm-vton → Logs / Metrics

## 코드 인터페이스 차이

Modal 의 endpoint 는 단일 URL = 단일 함수 (Colab 의 `/try-on` 같은 prefix 아님).
Next.js try-on 라우트의 `${url}/try-on` 패턴을 Modal 모드에선 URL 그대로 호출하도록 조정 필요.

→ 다음 PR 에서 처리 (가이드와 함께 코드 패치).
