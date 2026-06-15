"""브릿지 직접 테스트 — usage: python test_bridge.py [upper|lower]"""
import base64, json, sys, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "demo-data"
mode = sys.argv[1] if len(sys.argv) > 1 else "lower"

person = base64.b64encode((ROOT / "person" / "model-full-m.png").read_bytes()).decode()
garment_file = "blue-shirt-flat.jpg" if mode == "upper" else "jeans-flat.jpg"
garment = base64.b64encode((ROOT / "garment" / garment_file).read_bytes()).decode()

body = json.dumps({
    "person_b64": person,
    "garment_b64": garment,
    "cloth_type": mode,
    "garment_desc": "test",
}).encode()

t0 = time.time()
req = urllib.request.Request("http://localhost:8899/try-on", data=body,
                             headers={"content-type": "application/json"})
with urllib.request.urlopen(req, timeout=600) as r:
    data = json.loads(r.read())

dt = time.time() - t0
if "result_b64" in data:
    out = Path(__file__).parent / f"test_result_{mode}.png"
    out.write_bytes(base64.b64decode(data["result_b64"]))
    print(f"OK in {dt:.1f}s -> {out}")
else:
    print(f"ERROR in {dt:.1f}s: {data.get('error')}")
    sys.exit(1)
