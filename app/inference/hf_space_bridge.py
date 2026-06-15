"""
HF Space bridge — vcloset의 INFERENCE_URL 규약(/try-on, JSON in/out)을
Hugging Face 공개 CatVTON Space(gradio)로 중계한다.

CatVTON 공식 Space(zhengchong/CatVTON)는 cloth_type(upper/lower/overall)을
지원하므로 상의·하의·원피스 합성이 가능하다. (신발·액세서리는 VTON 기술 범위 밖)

vcloset 쪽 계약 (src/app/api/try-on/route.ts, mode=colab):
  POST {INFERENCE_URL}/try-on
  body: { person_b64, garment_b64, cloth_type, garment_desc }
  resp: { result_b64 } | { error }

실행:
  uv run uvicorn hf_space_bridge:app --port 8899
"""
import base64
import io
import logging
import os
import tempfile
import traceback
from pathlib import Path

from fastapi import FastAPI
from PIL import Image
from pydantic import BaseModel
from gradio_client import Client, handle_file

SPACE = "zhengchong/CatVTON"
SUPPORTED_CLOTH_TYPES = {"upper", "lower", "overall"}

logger = logging.getLogger("hf_space_bridge")

app = FastAPI()
_client: Client | None = None


def client() -> Client:
    global _client
    if _client is None:
        # HF_TOKEN(무료 계정 토큰)이 있으면 ZeroGPU 사용량 한도가 크게 늘어난다.
        token = os.environ.get("HF_TOKEN", "").strip() or None
        _client = Client(SPACE, token=token)
    return _client


class TryOnReq(BaseModel):
    person_b64: str
    garment_b64: str
    cloth_type: str = "upper"
    garment_desc: str = "a garment"  # CatVTON은 텍스트 조건을 쓰지 않음 (이미지가 전부)


def _load_rgb(b64: str) -> Image.Image:
    # 투명 PNG(rembg 결과물 등)는 흰 배경에 합성해 RGB로 정규화.
    raw = base64.b64decode(b64.split(",")[-1])
    img = Image.open(io.BytesIO(raw))
    if img.mode in ("RGBA", "LA", "P"):
        rgba = img.convert("RGBA")
        bg = Image.new("RGB", rgba.size, (255, 255, 255))
        bg.paste(rgba, mask=rgba.split()[-1])
        return bg
    return img.convert("RGB")


def _save_png(img: Image.Image) -> str:
    # Space의 ImageEditor가 배경+레이어를 원본 확장자로 재저장하므로
    # JPEG(RGBA 불가) 대신 항상 PNG로 업로드한다.
    f = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    img.save(f.name, "PNG")
    return f.name


def _blank_layer(size: tuple[int, int]) -> str:
    # 전부 투명한 마스크 레이어 → Space가 단일값 마스크로 인식해 automasker(cloth_type) 사용.
    f = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    Image.new("RGBA", size, (0, 0, 0, 0)).save(f.name, "PNG")
    return f.name


@app.post("/try-on")
def try_on(req: TryOnReq):
    cloth_type = req.cloth_type if req.cloth_type in SUPPORTED_CLOTH_TYPES else "upper"
    try:
        person_img = _load_rgb(req.person_b64)
        person_path = _save_png(person_img)
        layer_path = _blank_layer(person_img.size)
        garment_path = _save_png(_load_rgb(req.garment_b64))

        result = client().predict(
            person_image={
                "background": handle_file(person_path),
                "layers": [handle_file(layer_path)],
                "composite": None,
            },
            cloth_image=handle_file(garment_path),
            cloth_type=cloth_type,
            num_inference_steps=50,
            guidance_scale=2.5,
            seed=42,
            show_type="result only",
            api_name="/submit_function",
        )
        out_path = result["path"] if isinstance(result, dict) else result
        result_b64 = base64.b64encode(Path(out_path).read_bytes()).decode()
        return {"result_b64": result_b64}
    except Exception as e:  # Space 큐 초과·타임아웃 등 → vcloset이 환불 처리
        # 전체 스택을 로깅해 디버깅을 돕되, 클라이언트에는 요약 메시지만 반환한다.
        logger.error("try-on failed:\n%s", traceback.format_exc())
        return {"error": f"{type(e).__name__}: {e}"}


@app.get("/health")
def health():
    return {"ok": True, "space": SPACE, "cloth_types": sorted(SUPPORTED_CLOTH_TYPES)}
