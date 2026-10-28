// Điều khoản xử lý tài sản khi không trả kho (v2) — khách tick đồng ý khi đặt kho, lưu reservations.terms_version.
// Đổi nội dung → tăng version ở đây VÀ ReservationService.ASSET_TERMS_VERSION ở backend.
// v2 (27/10/2026): gia hạn báo trước 3 ngày (PR-R10), phí chiếm dụng (PR-Q14), thanh lý sau 15 ngày (PR-Q8), phí lưu giữ hàng (PR-Q15).
const TERMS_VERSION = 'v2'

const CLAUSES = [
  'Muốn thuê tiếp, Bên thuê gia hạn chậm nhất 3 ngày trước ngày hết hạn. Sau mốc này ô kho được mở cho khách khác đặt trước; Bên thuê chỉ còn gia hạn được nếu chưa có ai đặt ô.',
  'Hết hạn hợp đồng mà Bên thuê không gia hạn hoặc không trả kho, hợp đồng chuyển sang QUÁ HẠN: mã truy cập bị khoá, phí trễ tính theo chính sách thuê (10% tiền cọc mỗi ngày, tối đa 50%) và PHÍ CHIẾM DỤNG ô cho mỗi ngày quá hạn (mặc định 150% giá thuê theo ngày, không giới hạn). Phí trừ vào tiền cọc, phần vượt cọc là khoản nợ Bên thuê phải thanh toán.',
  'QueenKho liên hệ Bên thuê ít nhất 3 lần qua số điện thoại / email đã đăng ký.',
  'Quá hạn 15 ngày (theo chính sách thuê), QueenKho có quyền THANH LÝ hợp đồng: thu hồi toàn bộ khoá, mã PIN, thẻ RFID và mở ô kho với sự có mặt của ít nhất 2 nhân sự. Tài sản được kiểm kê, chụp ảnh, lập biên bản và chuyển sang khu lưu giữ.',
  'Tài sản được lưu giữ 60 ngày kể từ ngày thanh lý, tính PHÍ LƯU GIỮ mỗi ngày (mặc định 20% giá thuê theo ngày của ô cũ). Trong thời gian này Bên thuê nhận lại được sau khi thanh toán đủ các khoản còn nợ và phí lưu giữ.',
  'Hết thời hạn lưu giữ, Bên thuê đồng ý để QueenKho BÁN THANH LÝ tài sản; tài sản không còn giá trị được tiêu huỷ có biên bản. Tiền bán được dùng để trừ nợ và chi phí lưu giữ, phần còn dư được hoàn lại cho Bên thuê.',
  'Hàng cấm, chất nguy hiểm, giấy tờ tuỳ thân được giao ngay cho cơ quan công an / UBND phường, không áp dụng mục 5.',
  'Bên thuê xác nhận đã đọc, hiểu và đồng ý điều khoản này khi đặt kho.',
]

export default function AssetTermsModal({ open, onClose, onAccept }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" onClick={onClose}>
      <div
        className="duo-card bg-white w-full max-w-[600px] max-h-[85vh] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b-2 border-[#E5E5E5] flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FFC800] border-b-2 border-[#E5A800] text-white flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">gavel</span>
          </div>
          <div>
            <h2 className="text-base font-black text-[#4B4B4B]">Điều khoản xử lý tài sản khi không trả kho</h2>
            <p className="text-[11px] font-bold text-[#AFAFAF]">Phiên bản {TERMS_VERSION} · căn cứ BLDS 2015 (thoả thuận xử lý tài sản)</p>
          </div>
        </div>
        <ol className="px-6 py-4 overflow-y-auto flex flex-col gap-3">
          {CLAUSES.map((text, idx) => (
            <li key={idx} className="flex gap-3 text-sm font-bold text-[#4B4B4B] leading-relaxed">
              <span className="w-6 h-6 rounded-full bg-[#F7F7F7] border-2 border-[#E5E5E5] text-[11px] font-black text-[#777777] flex items-center justify-center shrink-0">
                {idx + 1}
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
        <div className="px-6 py-4 border-t-2 border-[#E5E5E5] flex justify-end gap-3">
          <button type="button" onClick={onClose} className="duo-btn-white px-5 py-2.5 text-sm">
            Đóng
          </button>
          {onAccept && (
            <button type="button" onClick={onAccept} className="duo-btn-green px-5 py-2.5 text-sm gap-1.5">
              <span className="material-symbols-outlined text-[18px]">check</span>
              Tôi đồng ý
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
