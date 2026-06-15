"""
vcloset VTON 엔진 테스트 스위트
- 브릿지(/try-on) 레벨에서 입력 검증·코어 합성·열화 입력·성능을 케이스 단위로 검증
- 결과는 콘솔 표 + JSON 리포트(engine_test_report.json)로 저장

실행: uv run python engine_test_suite.py
"""
import base64
import io
import json
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
DEMO = HERE.parent / "demo-data"
OUT = HERE / "engine_test_out"
OUT.mkdir(exist_ok=True)
BRIDGE = "http://localhost:8899/try-on"

# ───────────────────────── helpers ─────────────────────────

def b64_of(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode()


def b64_of_img(img: Image.Image, fmt: str = "PNG") -> str:
    buf = io.BytesIO()
    img.save(buf, fmt)
    return base64.b64encode(buf.getvalue()).decode()


def call_bridge(person_b64: str, garment_b64: str, cloth_type: str, timeout: int = 600):
    body = json.dumps({
        "person_b64": person_b64,
        "garment_b64": garment_b64,
        "cloth_type": cloth_type,
        "garment_desc": "engine test",
    }).encode()
    req = urllib.request.Request(BRIDGE, data=body, headers={"content-type": "application/json"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read())
        dt = time.time() - t0
        return data, dt, None
    except Exception as e:
        return None, time.time() - t0, f"{type(e).__name__}: {e}"


def is_image_b64(b64: str) -> tuple[bool, str]:
    try:
        img = Image.open(io.BytesIO(base64.b64decode(b64)))
        return True, f"{img.size[0]}x{img.size[1]} {img.mode}"
    except Exception as e:
        return False, str(e)


# ───────────────────────── fixtures ─────────────────────────

person_full = b64_of(DEMO / "person" / "model-full-m.png")       # 전신 (기준)
garment_top = b64_of(DEMO / "garment" / "blue-shirt-flat.jpg")   # 상의 (기준)
garment_jeans = b64_of(DEMO / "garment" / "jeans-flat.jpg")      # 하의 (기준)

_full = Image.open(DEMO / "person" / "model-full-m.png").convert("RGB")

# 투명 RGBA 옷 (rembg 산출물 시뮬레이션)
_rgba = Image.open(DEMO / "garment" / "blue-shirt-flat.jpg").convert("RGBA")
garment_rgba = b64_of_img(_rgba, "PNG")

# 저해상도 인물 (200px)
_low = _full.copy()
_low.thumbnail((200, 200))
person_lowres = b64_of_img(_low, "JPEG".replace("JPEG", "PNG"))

# 반신 인물 (상반신 50% 크롭) — 하의 합성 시 보이지 않는 영역
_half = _full.crop((0, 0, _full.width, _full.height // 2))
person_halfbody = b64_of_img(_half)

# 인물 없는 사진 (합성 풍경)
_scene = Image.new("RGB", (768, 1024), (135, 180, 220))
_d = ImageDraw.Draw(_scene)
_d.rectangle([0, 700, 768, 1024], fill=(90, 140, 70))     # 들판
_d.ellipse([550, 80, 680, 210], fill=(250, 240, 180))     # 해
_d.polygon([(120, 700), (300, 420), (480, 700)], fill=(110, 100, 95))  # 산
person_landscape = b64_of_img(_scene)

# ───────────────────────── cases ─────────────────────────
# kind: "validation"(GPU 안 씀, 에러 기대) | "core"(정상 기대) | "robust"(무크래시+이미지 반환 기대, 품질은 관찰)

CASES = [
    dict(id="V-01", name="손상된 base64 (잘린 문자열)", kind="validation",
         person=person_full[:300] + "!!!corrupted!!!", garment=garment_top, ct="upper",
         expect="error 응답 (크래시 없음)"),
    dict(id="V-02", name="비이미지 데이터 (텍스트 bytes)", kind="validation",
         person=base64.b64encode(b"this is not an image at all").decode(), garment=garment_top, ct="upper",
         expect="error 응답 (크래시 없음)"),
    dict(id="V-03", name="빈 garment 페이로드", kind="validation",
         person=person_full, garment="", ct="upper",
         expect="error 응답 (크래시 없음)"),
    dict(id="E-01", name="기준선: 전신 × 상의(upper)", kind="core",
         person=person_full, garment=garment_top, ct="upper",
         expect="result_b64 이미지 반환"),
    dict(id="E-02", name="기준선: 전신 × 하의(lower)", kind="core",
         person=person_full, garment=garment_jeans, ct="lower",
         expect="result_b64 이미지 반환"),
    dict(id="E-03", name="투명 RGBA 옷 입력 (rembg 산출물)", kind="core",
         person=person_full, garment=garment_rgba, ct="upper",
         expect="RGB 정규화 후 정상 합성"),
    dict(id="E-04", name="저해상도 인물 (≤200px)", kind="robust",
         person=person_lowres, garment=garment_top, ct="upper",
         expect="무크래시 + 이미지 반환 (품질 열화 허용)"),
    dict(id="E-05", name="인물 없는 사진 (풍경)", kind="robust",
         person=person_landscape, garment=garment_top, ct="upper",
         expect="무크래시 (결과 무의미 허용) — 입력 검증 필요성 근거"),
    dict(id="E-06", name="반신 사진 × 하의(lower) — 영역 부재", kind="robust",
         person=person_halfbody, garment=garment_jeans, ct="lower",
         expect="무크래시 (마스크 미검출/왜곡 허용) — UX 가드 근거"),
]

# ───────────────────────── run ─────────────────────────
# usage: engine_test_suite.py [케이스ID ...]  — 예: engine_test_suite.py E-04 E-05 E-06

only = set(a.upper() for a in sys.argv[1:])
if only:
    CASES = [c for c in CASES if c["id"] in only]

results = []
gpu_times = []

for c in CASES:
    sys.stdout.write(f"[{c['id']}] {c['name']} ... ")
    sys.stdout.flush()
    data, dt, neterr = call_bridge(c["person"], c["garment"], c["ct"])

    if neterr:
        verdict = "FAIL"
        actual = f"전송 실패: {neterr}"
    elif data.get("error"):
        actual = f"error 응답 ({dt:.1f}s): {data['error'][:80]}"
        verdict = "PASS" if c["kind"] == "validation" else "FAIL"
    elif data.get("result_b64"):
        ok, info = is_image_b64(data["result_b64"])
        actual = f"이미지 반환 {info} ({dt:.1f}s)"
        if ok:
            (OUT / f"{c['id']}.png").write_bytes(base64.b64decode(data["result_b64"]))
            gpu_times.append((c["id"], dt))
            verdict = "FAIL" if c["kind"] == "validation" else "PASS"
        else:
            verdict = "FAIL"
            actual = f"반환됐으나 이미지 아님: {info}"
    else:
        verdict = "FAIL"
        actual = f"빈 응답 ({dt:.1f}s)"

    print(f"{verdict} — {actual}")
    results.append({**{k: c[k] for k in ("id", "name", "kind", "ct", "expect")},
                    "actual": actual, "verdict": verdict, "seconds": round(dt, 1)})

# 성능 요약
if gpu_times:
    ts = sorted(t for _, t in gpu_times)
    perf = {
        "gpu_calls": len(ts),
        "min_s": round(ts[0], 1),
        "max_s": round(ts[-1], 1),
        "median_s": round(ts[len(ts) // 2], 1),
    }
else:
    perf = {}

report = {"date": "2026-06-12", "bridge": BRIDGE, "results": results, "perf": perf}
(HERE / "engine_test_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

passed = sum(1 for r in results if r["verdict"] == "PASS")
print(f"\n===== {passed}/{len(results)} PASS =====")
print("perf:", perf)
print("report -> engine_test_report.json / 결과 이미지 -> engine_test_out/")
