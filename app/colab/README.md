# Colab CatVTON 추론 서버 — 셋업 가이드

맥북 vcloset 앱의 `/try-on` 이 이 노트북의 FastAPI 서버를 호출해 실제 가상 피팅 합성을 수행합니다.

## 한 번만 준비

1. **Google 계정** — 없으면 만들기
2. **ngrok 무료 계정** — https://dashboard.ngrok.com/signup
   - 로그인 후 https://dashboard.ngrok.com/get-started/your-authtoken 에서 authtoken 복사

## 실행 순서

### 1. 노트북 열기
- `vcloset/colab/catvton_server.ipynb` 를 https://colab.research.google.com/ 에 업로드
- 또는 GitHub 에 push 한 뒤 "Open in Colab" 버튼

### 2. GPU 활성화
- 메뉴 → **Runtime → Change runtime type → Hardware accelerator: T4 GPU** → Save

### 3. 셀 순서대로 실행 (Shift+Enter)
| 셀 | 작업 | 예상 시간 |
|----|------|---------|
| 1 | nvidia-smi 확인 | 3초 |
| 2 | pip install | 3-5분 |
| 3 | CatVTON git clone | 10초 |
| 4 | HuggingFace weight 다운로드 (~7GB) | 5-8분 |
| 5 | 모델 로드 (FP16) | 30초 |
| 6 | FastAPI app 정의 | 1초 |
| 7 | ngrok 터널 + uvicorn 실행 (계속 떠 있음) | — |

### 4. ngrok URL 복사 → 맥북에 붙이기

7번 셀 출력에서 이런 줄을 찾으세요:

```
========================================
   INFERENCE_URL = https://abcd-1234.ngrok-free.app
========================================
```

맥북 터미널에서:

```bash
cd path/to/vcloset
# .env 파일 열어서 INFERENCE_URL 값 수정
# INFERENCE_URL="https://abcd-1234.ngrok-free.app"

# dev 서버 재시작 (이미 떠 있으면 끄고 다시)
pkill -f "next dev"
PORT=3001 npm run dev
```

### 5. 브라우저에서 테스트
http://localhost:3001/try-on 에서 사진 + 옷 선택 → "입어보기"
- 첫 호출은 모델 워밍업으로 30-60초
- 이후 호출은 한 장에 15-25초 (T4 무료 기준)

## 비용

- **Google Colab 무료**: T4 GPU, 세션당 최대 12시간 (실제로는 idle 90분이면 끊김)
- **ngrok 무료**: 1개 동시 터널, 매번 새 URL 발급
- **합계: ₩0**

## 한계 / 운영 시 주의

- Colab 세션은 자주 끊김 → 끊기면 노트북 다시 실행, 새 ngrok URL 받음 → `.env` 갱신
- 매번 재시작 시 모델 로드에 8분 정도 걸림
- 동시 사용자 1명 가정 (queueing 없음)
- 정식 출시 단계에서는 RunPod 또는 자체 GPU 로 이전 필요

## 실패 시 디버깅

| 증상 | 원인 / 조치 |
|------|------------|
| `CUDA out of memory` | T4 인지 확인 (P100/V100 도 OK). 다른 셀에서 GPU 점유 중인 메모리 해제 |
| `ImportError: model.pipeline` | CatVTON 저장소 구조 변경 가능성. 저장소 README 참조해 import 경로 조정 |
| `HuggingFace 403` | weight repo 가 gated 일 수 있음. `huggingface-cli login` 셀 추가 후 토큰 입력 |
| ngrok URL 접속 안됨 | 무료 ngrok 은 동시 1개. 다른 터널 사용 중인지 확인. authtoken 잘못 들어갔는지 확인 |
| 맥북에서 "Inference HTTP 504" | Colab 세션 끊김 또는 모델 응답 90s 초과. 노트북 7번 셀 재실행 |

## 더 빠르게 만들고 싶다면

- `num_steps` 를 30 → 20 으로 (셀 6 의 `TryOnReq` 기본값 수정)
- Colab Pro ($10/월) → 더 빠른 GPU, 끊김 적음
- LCM-LoRA 추가 (셀 5 에서 LCM scheduler 사용 → 4-8 steps)
