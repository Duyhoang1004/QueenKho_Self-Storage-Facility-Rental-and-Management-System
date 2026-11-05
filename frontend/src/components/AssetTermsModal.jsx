// Điều khoản xử lý tài sản khi không trả kho (v4) — khách tick đồng ý khi đặt kho, lưu reservations.terms_version.
// Đổi nội dung → tăng version ở đây VÀ ReservationService.ASSET_TERMS_VERSION ở backend.
// v2 (27/10/2026): gia hạn báo trước 3 ngày (PR-R10), phí chiếm dụng (PR-Q14), thanh lý sau 15 ngày (PR-Q8), phí lưu giữ hàng (PR-Q15).
// v3 (04/11/2026): phí dọn & di dời hàng khi thanh lý (PR-Q16), chuyển ô cùng loại (BR-122), ảnh biên bản bàn giao (BR-121).
// v4 (05/11/2026, D-15): bỏ ân hạn 5 ngày, hết hạn là chuyển hàng vào KHO TỔNG; QueenKho không bán / tiêu huỷ hàng của khách.
const TERMS_VERSION = 'v4'

const CLAUSES = [
  'Muốn thuê tiếp, Bên thuê gia hạn chậm nhất 3 ngày trước ngày hết hạn. QueenKho nhắc trước 15, 10, 7, 3 và 1 ngày. Sau mốc 3 ngày ô kho được mở cho khách khác đặt trước; Bên thuê chỉ còn gia hạn được nếu chưa có ai đặt ô.',
  'Muốn trả kho, Bên thuê hẹn ngày trả trong thời hạn hợp đồng (chậm nhất là ngày hết hạn). Không có thời gian ân hạn sau ngày hết hạn.',
  'Hết ngày hết hạn mà Bên thuê không gia hạn và không trả kho, hợp đồng chuyển QUÁ HẠN: mã truy cập bị khoá, tính phí trễ theo chính sách thuê và PHÍ CHIẾM DỤNG ô cho số ngày quá hạn (mặc định 150% giá thuê theo ngày). Ngay hôm sau, QueenKho THANH LÝ hợp đồng: thu hồi khoá, mã PIN, thẻ RFID và mở ô với sự có mặt của ít nhất 2 nhân sự; tài sản được kiểm kê, chụp ảnh, lập biên bản và CHUYỂN VÀO KHO TỔNG của QueenKho. Bên thuê chịu PHÍ DỌN & DI DỜI HÀNG một lần (mặc định 30% giá thuê tháng của ô). Các khoản phí trừ vào tiền cọc, phần vượt cọc là khoản nợ.',
  'Tại kho tổng, tài sản được giữ nguyên vẹn cho tới khi Bên thuê nhận lại, tính PHÍ LƯU GIỮ mỗi ngày (mặc định 20% giá thuê theo ngày của ô cũ). QueenKho KHÔNG bán và không tiêu huỷ tài sản của Bên thuê. Bên thuê xem địa chỉ kho tổng và số tiền cần thanh toán trong trang hợp đồng, nhận lại hàng sau khi thanh toán đủ nợ và phí lưu giữ.',
  'Hàng cấm, chất nguy hiểm, giấy tờ tuỳ thân được giao ngay cho cơ quan công an / UBND phường.',
  'Khi đặt kho Bên thuê khai báo loại hàng gửi; thực phẩm chỉ gửi ở kho lạnh / kho đông. Lúc nhận kho nhân viên kiểm tra hàng mang vào phải khớp khai báo, không có chất dễ cháy nổ, hàng cấm; không đạt thì không bàn giao ô.',
  'Biên bản nhận kho và trả kho có ảnh hiện trạng ô; hư hỏng của ô được xác định bằng cách đối chiếu hai bộ ảnh này. QueenKho có thể chuyển hợp đồng sang ô khác CÙNG LOẠI tại cùng cơ sở (giá thuê, mã PIN giữ nguyên) khi ô có sự cố, khi Bên thuê yêu cầu hoặc khi đã thống nhất với Bên thuê; nếu do sự cố của cơ sở, QueenKho hỗ trợ chuyển hàng miễn phí.',
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
