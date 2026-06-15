"""
Modal serverless deployment of IDM-VTON.

This is the deployment artifact for the "modal" inference mode, which is
wired into the app: set INFERENCE_URL + INFERENCE_MODE=modal and the try-on
route (src/app/api/try-on/route.ts, pickMode → "modal") will call this endpoint.

Exposes a FastAPI POST endpoint /try-on that matches the same interface
our Next.js app already uses:

    POST {ENDPOINT}/try-on
    body: { person_b64, garment_b64, cloth_type?, garment_desc?, seed?, num_steps? }
    response: { result_b64 } or { error }

Deploy:
    pip install modal
    modal token new
    modal deploy inference/modal_idm_vton.py

After deploy, Modal prints two URLs — copy the one ending in `/try-on`
and paste it into vcloset/.env as INFERENCE_URL (without the /try-on suffix).
"""

import base64
import io
import modal

# ---------- container image ----------
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "libgl1", "libglib2.0-0", "libsm6", "libxext6", "libxrender1")
    .pip_install(
        "torch==2.0.1",
        "torchvision==0.15.2",
        "diffusers==0.25.0",
        "transformers==4.36.2",
        "accelerate==0.26.1",
        "huggingface_hub==0.25.2",
        "fastapi[standard]==0.115.0",
        "pydantic==2.9.0",
        "pillow==10.4.0",
        "opencv-python-headless==4.10.0.84",
        "einops==0.8.0",
        "omegaconf==2.3.0",
        "scipy==1.13.1",
        "fvcore==0.1.5.post20221221",
        "iopath==0.1.10",
        "yacs==0.1.8",
        "timm==1.0.9",
        "scikit-image==0.24.0",
        "av==12.3.0",
        "onnxruntime==1.19.2",
        "peft==0.7.1",
        "xformers==0.0.22",
        "ninja==1.11.1",
        "config==0.5.1",
    )
    .run_commands(
        "cd /root && git clone https://github.com/yisol/IDM-VTON.git",
    )
)

app = modal.App("vcloset-idm-vton", image=image)

# Persist model weights across cold starts
volume = modal.Volume.from_name("idm-vton-weights", create_if_missing=True)

CKPT_DIR = "/cache/idm-vton"


# ---------- model loader ----------
@app.cls(
    gpu="A10G",                  # 24 GB, ~$0.0011/s while running
    image=image,
    volumes={"/cache": volume},
    scaledown_window=120,        # keep warm for 2 minutes after each call
    timeout=600,
)
class IDMVTON:
    @modal.enter()
    def load(self):
        import os, sys, torch
        from huggingface_hub import snapshot_download

        sys.path.insert(0, "/root/IDM-VTON")

        if not os.path.isdir(CKPT_DIR) or not os.listdir(CKPT_DIR):
            print("downloading weights…")
            snapshot_download(repo_id="yisol/IDM-VTON", local_dir=CKPT_DIR)
            volume.commit()

        from diffusers import DDPMScheduler, AutoencoderKL
        from transformers import (
            CLIPImageProcessor, CLIPVisionModelWithProjection,
            CLIPTextModel, CLIPTextModelWithProjection, AutoTokenizer,
        )
        from src.unet_hacked_garmnet import UNet2DConditionModel as UNetGarm
        from src.unet_hacked_tryon import UNet2DConditionModel
        from src.tryon_pipeline import StableDiffusionXLInpaintPipeline as TryonPipeline
        from preprocess.humanparsing.run_parsing import Parsing
        from preprocess.openpose.run_openpose import OpenPose
        from src.utils_mask import get_mask_location
        from torchvision import transforms

        dtype = torch.float16
        scheduler = DDPMScheduler.from_pretrained(CKPT_DIR, subfolder="scheduler")
        vae = AutoencoderKL.from_pretrained(CKPT_DIR, subfolder="vae", torch_dtype=dtype)
        image_encoder = CLIPVisionModelWithProjection.from_pretrained(CKPT_DIR, subfolder="image_encoder", torch_dtype=dtype)
        text_encoder_one = CLIPTextModel.from_pretrained(CKPT_DIR, subfolder="text_encoder", torch_dtype=dtype)
        text_encoder_two = CLIPTextModelWithProjection.from_pretrained(CKPT_DIR, subfolder="text_encoder_2", torch_dtype=dtype)
        tokenizer_one = AutoTokenizer.from_pretrained(CKPT_DIR, subfolder="tokenizer", use_fast=False)
        tokenizer_two = AutoTokenizer.from_pretrained(CKPT_DIR, subfolder="tokenizer_2", use_fast=False)
        unet = UNet2DConditionModel.from_pretrained(CKPT_DIR, subfolder="unet", torch_dtype=dtype)
        unet_encoder = UNetGarm.from_pretrained(CKPT_DIR, subfolder="unet_encoder", torch_dtype=dtype)

        for m in (unet_encoder, unet, vae, image_encoder, text_encoder_one, text_encoder_two):
            m.requires_grad_(False)

        self.pipe = TryonPipeline(
            unet=unet, vae=vae,
            feature_extractor=CLIPImageProcessor(),
            text_encoder=text_encoder_one, text_encoder_2=text_encoder_two,
            tokenizer=tokenizer_one, tokenizer_2=tokenizer_two,
            scheduler=scheduler, image_encoder=image_encoder,
        )
        self.pipe.unet_encoder = unet_encoder
        self.pipe = self.pipe.to("cuda")
        self.openpose = OpenPose(0)
        self.parsing = Parsing(0)
        self.get_mask_location = get_mask_location
        self.tensor_transform = transforms.Compose(
            [transforms.ToTensor(), transforms.Normalize([0.5], [0.5])],
        )
        self.dtype = dtype
        print("IDM-VTON loaded")

    @modal.fastapi_endpoint(method="POST", docs=True)
    def try_on(self, body: dict) -> dict:
        """body: { person_b64, garment_b64, cloth_type?, garment_desc?, seed?, num_steps? }"""
        import torch
        from PIL import Image
        import traceback

        try:
            person_b64 = body["person_b64"]
            garment_b64 = body["garment_b64"]
            cloth_type = body.get("cloth_type", "upper_body")
            desc = body.get("garment_desc", "a fashion garment")
            seed = int(body.get("seed", 42))
            steps = int(body.get("num_steps", 30))
            guidance = float(body.get("guidance", 2.0))

            def b64_to_pil(b: str) -> Image.Image:
                if "," in b:
                    b = b.split(",", 1)[1]
                return Image.open(io.BytesIO(base64.b64decode(b))).convert("RGB")

            person = b64_to_pil(person_b64).resize((768, 1024))
            garment = b64_to_pil(garment_b64).resize((768, 1024))

            keypoints = self.openpose(person.resize((384, 512)))
            model_parse, _ = self.parsing(person.resize((384, 512)))
            mask, _ = self.get_mask_location("hd", cloth_type, model_parse, keypoints)
            mask = mask.resize((768, 1024))

            with torch.no_grad():
                prompt = f"model is wearing {desc}"
                negative = "monochrome, lowres, bad anatomy, worst quality, low quality"
                (
                    pe, npe, ppe, nppe,
                ) = self.pipe.encode_prompt(
                    prompt,
                    num_images_per_prompt=1,
                    do_classifier_free_guidance=True,
                    negative_prompt=negative,
                )
                prompt_c = f"a photo of {desc}"
                (pe_c, _, _, _) = self.pipe.encode_prompt(
                    prompt_c,
                    num_images_per_prompt=1,
                    do_classifier_free_guidance=False,
                    negative_prompt=negative,
                )
                pose_img = self.tensor_transform(person).unsqueeze(0).to("cuda", self.dtype)
                garm = self.tensor_transform(garment).unsqueeze(0).to("cuda", self.dtype)
                generator = torch.Generator("cuda").manual_seed(seed)
                images = self.pipe(
                    prompt_embeds=pe,
                    negative_prompt_embeds=npe,
                    pooled_prompt_embeds=ppe,
                    negative_pooled_prompt_embeds=nppe,
                    num_inference_steps=steps,
                    generator=generator,
                    strength=1.0,
                    pose_img=pose_img,
                    text_embeds_cloth=pe_c,
                    cloth=garm,
                    mask_image=mask,
                    image=person,
                    height=1024,
                    width=768,
                    ip_adapter_image=garment,
                    guidance_scale=guidance,
                )[0]
            out = images[0]
            buf = io.BytesIO()
            out.save(buf, format="PNG")
            return {"result_b64": base64.b64encode(buf.getvalue()).decode("ascii")}
        except Exception as e:
            traceback.print_exc()
            return {"error": str(e)}

    @modal.fastapi_endpoint(method="GET")
    def health(self) -> dict:
        return {"ok": True, "model": "IDM-VTON", "host": "modal"}


@app.local_entrypoint()
def main():
    print("Deploy with:  modal deploy inference/modal_idm_vton.py")
