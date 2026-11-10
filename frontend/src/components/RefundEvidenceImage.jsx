import { useState } from "react";

export default function RefundEvidenceImage({ src, maxHeightClass = "max-h-80" }) {
  const [failed, setFailed] = useState(false);

  if (!src) return null;
  if (failed) {
    return (
      <div className="rounded-xl border-2 border-[#FFB2B2] bg-[#FFF2F2] p-3 text-xs font-bold text-[#CC0000] flex items-start gap-2" role="alert">
        <span className="material-symbols-outlined text-[18px]">broken_image</span>
        <span>Không tải được ảnh minh chứng. Mã giao dịch và ghi chú hoàn tiền vẫn được giữ bên trên; vui lòng liên hệ cơ sở để cấp lại ảnh.</span>
      </div>
    );
  }

  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      className="block overflow-hidden rounded-xl border-2 border-[#84D8FF] bg-white"
      title="Mở ảnh minh chứng hoàn tiền"
    >
      <img
        src={src}
        alt="Minh chứng hoàn tiền do quản lý cơ sở cung cấp"
        className={`w-full ${maxHeightClass} object-contain`}
        onError={() => setFailed(true)}
      />
    </a>
  );
}
