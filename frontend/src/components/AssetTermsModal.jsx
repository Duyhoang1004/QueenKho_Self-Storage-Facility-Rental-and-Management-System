import PolicySummary from './PolicySummary'

// Điều khoản thuê kho & xử lý tài sản — khách tick đồng ý khi đặt kho, lưu reservations.terms_version.
// Đổi nội dung → tăng version ở đây VÀ ReservationService.ASSET_TERMS_VERSION ở backend.
// v2 (27/10/2026): gia hạn báo trước 3 ngày (PR-R10), phí chiếm dụng (PR-Q14), thanh lý sau 15 ngày (PR-Q8), phí lưu giữ hàng (PR-Q15).
// v3 (04/11/2026): phí dọn & di dời hàng khi thanh lý (PR-Q16), chuyển ô cùng loại (BR-122), ảnh biên bản bàn giao (BR-121).
// v4 (05/11/2026, D-15): bỏ ân hạn 5 ngày, hết hạn là chuyển hàng vào KHO TỔNG; QueenKho không bán / tiêu huỷ hàng của khách.
// v5 (18/11/2026): chỉ tự động cưỡng chế dọn kho sau khi đã quá hạn 5 ngày; cưỡng chế sớm hơn (1–4 ngày) thực hiện sau 2 lần liên lạc không thành công, hoặc cưỡng chế ngay trong ngày nếu có khách mới đặt đơn trúng ô quá hạn.
// v6 (20/11/2026, D-22): thêm tiền cọc / huỷ đơn / trả sớm (mất ưu đãi + phí phá HĐ, bảo hiểm không hoàn) / tất toán khi trả kho (D-21) /
//     hoàn tiền trong 24h + khách xác nhận đã nhận tiền; đầu điều khoản có "Tóm tắt bằng số" theo đúng đơn của khách.
const TERMS_VERSION = 'v6'

const CLAUSES = [
  'Tiền thanh toán khi đặt gồm TIỀN CỌC (số tháng giá niêm yết theo chính sách của cơ sở), TIỀN THUÊ CẢ KỲ (đã trừ ưu đãi theo gói và voucher) và PHÍ BẢO HIỂM hàng hoá nếu Bên thuê chọn gói có phí. Tiền cọc được hoàn khi trả kho sau khi trừ các khoản phí ở điều 5 và 6. Số tiền cụ thể của đơn nằm ở mục "Tóm tắt bằng số".',
  'Huỷ trước khi nhận kho: còn từ 48 giờ trước giờ hẹn được hoàn toàn bộ; còn 24 đến dưới 48 giờ giữ 50% tiền cọc; còn dưới 24 giờ giữ 100% tiền cọc; đã qua giờ hẹn mà chưa nhận kho giữ tiền cọc và 1 tháng tiền thuê. Huỷ trong 30 phút sau khi thanh toán (vẫn trước giờ hẹn), hoặc cơ sở không bàn giao được ô đúng hẹn, được hoàn toàn bộ.',
  'Muốn thuê tiếp, Bên thuê gia hạn chậm nhất 3 ngày trước ngày hết hạn. QueenKho nhắc trước 15, 10, 7, 3 và 1 ngày. Sau mốc 3 ngày mà chưa gia hạn, ô kho được mở cho khách khác đặt trước (ngày nhận kho sớm nhất đối với khách mới là 7 ngày sau khi hợp đồng hiện tại hết hạn); Bên thuê chỉ còn gia hạn được nếu chưa có ai đặt ô.',
  'Trả kho TRƯỚC HẠN: tiền thuê được hoàn = tiền thuê kỳ hiện tại đã đóng − số tháng đã dùng (làm tròn lên) × GIÁ NIÊM YẾT (không còn ưu đãi) − PHÍ PHÁ HỢP ĐỒNG bằng 1 tháng giá niêm yết; tối thiểu 0, phần thiếu không trừ vào tiền cọc. Trả trong tháng cuối của kỳ: không hoàn tiền thuê, không thu phí phá hợp đồng. Phí bảo hiểm không hoàn khi Bên thuê tự trả trước hạn.',
  'Trả kho là TẤT TOÁN hợp đồng: Bên thuê hẹn ngày trả trong thời hạn hợp đồng (không có ân hạn sau ngày hết hạn); các yêu cầu hỗ trợ phải xử lý xong trước buổi nghiệm thu. Sau khi nhân viên nghiệm thu, Bên thuê nhận BẢNG QUYẾT TOÁN (Đã đóng − Cơ sở giữ lại = Hoàn) và XÁC NHẬN trên tài khoản thì hợp đồng mới kết thúc: số dương được hoàn, số âm Bên thuê thanh toán trước khi kết thúc. Bên thuê được bấm "Không đồng ý" để cơ sở xem lại; bảng dương không phản hồi sau 3 ngày coi như đã xác nhận.',
  'Hết ngày hết hạn mà Bên thuê không gia hạn và không trả kho, hợp đồng chuyển QUÁ HẠN: mã truy cập bị khoá, tính PHÍ TRỄ (theo % tiền cọc mỗi ngày, có mức tối đa) và PHÍ CHIẾM DỤNG ô cho mỗi ngày quá hạn (không giới hạn) — mức áp cho đơn ghi ở "Tóm tắt bằng số". Hệ thống chỉ TỰ ĐỘNG CƯỠNG CHẾ DỌN KHO sau khi hợp đồng đã quá hạn đủ 5 ngày; cưỡng chế sớm hơn (trong 1–4 ngày đầu quá hạn) chỉ thực hiện sau tối thiểu 2 lần liên lạc không thành công, HOẶC ngay trong ngày (trong giờ làm việc) nếu có khách hàng khác đặt đơn vào ô kho quá hạn. Khi cưỡng chế dọn kho, ít nhất 2 nhân sự mở ô, kiểm kê, chụp ảnh, lập biên bản và CHUYỂN HÀNG VÀO KHO TỔNG; Bên thuê chịu PHÍ DỌN & DI DỜI HÀNG một lần. Các khoản phí trừ vào tiền cọc, phần vượt cọc là khoản nợ.',
  'Tại kho tổng, tài sản được giữ nguyên vẹn cho tới khi Bên thuê nhận lại, tính PHÍ LƯU GIỮ mỗi ngày theo giá thuê ngày của ô cũ. QueenKho KHÔNG bán và không tiêu huỷ tài sản của Bên thuê. Bên thuê xem địa chỉ kho tổng và số tiền cần thanh toán trong trang hợp đồng, nhận lại hàng sau khi thanh toán đủ nợ và phí lưu giữ.',
  'Hàng cấm, chất nguy hiểm, giấy tờ tuỳ thân được giao ngay cho cơ quan công an / UBND phường.',
  'Khi đặt kho Bên thuê khai báo loại hàng gửi; thực phẩm chỉ gửi ở kho lạnh / kho đông. Lúc nhận kho nhân viên kiểm tra hàng mang vào phải khớp khai báo, không có chất dễ cháy nổ, hàng cấm; không đạt thì không bàn giao ô.',
  'Biên bản nhận kho và trả kho có ảnh hiện trạng ô; hư hỏng của ô được xác định bằng cách đối chiếu hai bộ ảnh này. QueenKho có thể chuyển hợp đồng sang ô khác CÙNG LOẠI tại cùng cơ sở (giá thuê, mã PIN giữ nguyên) khi ô có sự cố, khi Bên thuê yêu cầu hoặc khi đã thống nhất với Bên thuê; nếu do sự cố của cơ sở, QueenKho hỗ trợ chuyển hàng miễn phí.',
  'HOÀN TIỀN được thực hiện trong 24 giờ làm việc (không tính Chủ Nhật) sau khi đủ điều kiện. Chuyển khoản: Bên thuê bấm "Đã nhận được" hoặc "Chưa nhận được" trong mục Thanh toán; không phản hồi sau 3 ngày coi như đã nhận. Tiền mặt tại quầy: Bên thuê ký phiếu chi khi nhận tiền.',
  'Bên thuê xác nhận đã đọc, hiểu và đồng ý điều khoản này khi đặt kho.',
]

// summary (tuỳ chọn): bảng phí & hoàn tiền bằng số của đơn đang đặt (PolicySummaryService)
export default function AssetTermsModal({ open, onClose, onAccept, summary }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" onClick={onClose}>
      <div
        className="duo-card bg-white w-full max-w-[640px] max-h-[88vh] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b-2 border-[#E5E5E5] flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FFC800] border-b-2 border-[#E5A800] text-white flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">gavel</span>
          </div>
          <div>
            <h2 className="text-base font-black text-[#4B4B4B]">Điều khoản thuê kho & xử lý tài sản</h2>
            <p className="text-[11px] font-bold text-[#AFAFAF]">Phiên bản {TERMS_VERSION} · căn cứ BLDS 2015 (thoả thuận xử lý tài sản)</p>
          </div>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex flex-col gap-4">
          {summary && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-black uppercase tracking-wider text-[#1899D6]">Tóm tắt bằng số — đơn của bạn</p>
              <PolicySummary summary={summary} />
            </div>
          )}
          <div className="flex flex-col gap-2">
            {summary && <p className="text-xs font-black uppercase tracking-wider text-[#777777]">Điều khoản đầy đủ</p>}
            <ol className="flex flex-col gap-3">
              {CLAUSES.map((text, idx) => (
                <li key={idx} className="flex gap-3 text-sm font-bold text-[#4B4B4B] leading-relaxed">
                  <span className="w-6 h-6 rounded-full bg-[#F7F7F7] border-2 border-[#E5E5E5] text-[11px] font-black text-[#777777] flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
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
