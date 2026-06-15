"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import UploadButton from "@/components/UploadButton";

type ProfileImage = { id: string; url: string; isPrimary: boolean };

export default function OnboardingPage() {
  const [images, setImages] = useState<ProfileImage[]>([]);

  async function load() {
    const r = await fetch("/api/profile-images");
    if (r.ok) setImages((await r.json()).images);
  }
  useEffect(() => { load(); }, []);

  async function addImage(url: string) {
    const r = await fetch("/api/profile-images", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (r.ok) load();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">내 사진</h1>
      <p className="mt-1 text-sm text-neutral-600">전신 또는 반신 사진을 올려두세요. 피팅 시 모델로 사용됩니다.</p>

      <div className="mt-6">
        <UploadButton subdir="profile" onUploaded={addImage} label="프로필 사진 추가" />
      </div>

      <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((img) => (
          <div key={img.id} className="relative aspect-[3/4] rounded-lg overflow-hidden border bg-white">
            <Image src={img.url} alt="profile" fill className="object-cover" sizes="200px" />
            {img.isPrimary && (
              <span className="absolute top-2 left-2 text-xs bg-black text-white px-2 py-0.5 rounded">기본</span>
            )}
          </div>
        ))}
        {images.length === 0 && <div className="text-sm text-neutral-500">아직 등록된 사진이 없습니다.</div>}
      </div>
    </div>
  );
}
