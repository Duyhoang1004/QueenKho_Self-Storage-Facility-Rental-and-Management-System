import { useRef, useState } from 'react'
import PolicySummary from './PolicySummary'

// Điều khoản thuê kho & xử lý tài sản — khách tick đồng ý khi đặt kho, lưu reservations.terms_version.
// Đổi nội dung → tăng version ở đây VÀ ReservationService.ASSET_TERMS_VERSION ở backend.
// v2 (27/10/2026): gia hạn báo trước 3 ngày (PR-R10), phí chiếm dụng (PR-Q14), thanh lý sau 15 ngày (PR-Q8), phí lưu giữ hàng (PR-Q15).
// v3 (04/11/2026): phí dọn & di dời hàng khi thanh lý (PR-Q16), chuyển ô cùng loại (BR-122), ảnh biên bản bàn giao (BR-121).
// v4 (05/11/2026, D-15): bỏ ân hạn 5 ngày, hết hạn là chuyển hàng vào KHO TỔNG; QueenKho không bán / tiêu huỷ hàng của khách.
// v5 (18/11/2026): chỉ tự động cưỡng chế dọn kho sau khi đã quá hạn 5 ngày; cưỡng chế sớm hơn (1–4 ngày) thực hiện sau 2 lần liên lạc không thành công, hoặc cưỡng chế ngay trong ngày nếu có khách mới đặt đơn trúng ô quá hạn.
// v6 (20/11/2026, D-22): thêm tiền cọc / huỷ đơn / trả sớm (mất ưu đãi + phí phá HĐ, bảo hiểm không hoàn) / tất toán khi trả kho (D-21) /
//     hoàn tiền trong 24h + khách xác nhận đã nhận tiền; đầu điều khoản có "Tóm tắt bằng số" theo đúng đơn của khách.
// v7 (22/11/2026, D-24): sắp lại thành 10 nhóm có tiêu đề + mục lục, gạch đầu dòng ngắn; bổ sung bảo hiểm & bồi thường,
//     biên bản nhận kho hai bên xác nhận + chốt giá trị hàng, bảo mật PIN / RFID, giá gia hạn, trả sớm sau gia hạn (PR-O2d),
//     hợp đồng kết thúc khi khách đã nhận tiền (D-23), huỷ khi bàn giao không thành (PR-X5), voucher không quy đổi tiền.
const TERMS_VERSION = 'v7'

// **chữ** = in đậm
const SECTIONS = [
  {
    key: 'payment', icon: 'payments', title: 'Thanh toán & tiền cọc',
    items: [
      'Khi đặt kho, Bên thuê trả một lần: **tiền cọc** (số tháng giá niêm yết theo chính sách của cơ sở), **tiền thuê cả kỳ** (đã trừ ưu đãi theo gói và voucher) và **phí bảo hiểm** nếu chọn gói có phí.',
      'Tiền cọc được **hoàn khi trả kho**, sau khi trừ các khoản ở mục 7 và 8.',
      'Voucher chỉ giảm giá lúc đặt, **không quy đổi thành tiền** khi huỷ đơn hay trả kho sớm.',
      'Số tiền cụ thể của từng đơn nằm ở bảng **Tóm tắt bằng số** (đầu điều khoản khi đặt kho, và trên trang hợp đồng).',
    ],
  },
  {
    key: 'cancel', icon: 'event_busy', title: 'Huỷ đơn trước khi nhận kho',
    items: [
      'Huỷ trong **30 phút** sau khi thanh toán (vẫn trước giờ hẹn): **hoàn 100%**.',
      'Còn **từ 48 giờ** trước giờ hẹn: hoàn 100% · **24 đến dưới 48 giờ**: giữ 50% tiền cọc · **dưới 24 giờ**: giữ 100% tiền cọc.',
      'Qua giờ hẹn mà **không tới nhận kho** (No-Show): giữ tiền cọc và 1 tháng tiền thuê, hoàn phần còn lại.',
      'Đã tới nhận kho nhưng chưa bàn giao xong: **không tính No-Show**, huỷ lúc này giữ 100% tiền cọc.',
      '**Cơ sở không bàn giao được ô** (ô có sự cố, hoặc Bên thuê đã từ chối biên bản bàn giao 2 lần sau khi cơ sở xử lý): **hoàn 100%**, hoặc Bên thuê chọn dời ngày nhận kho.',
      'Mốc tính phí là giờ hẹn Bên thuê đã chọn; việc QueenKho dời lịch không làm Bên thuê bị phạt nặng hơn.',
    ],
  },
  {
    key: 'checkin', icon: 'how_to_reg', title: 'Nhận kho (check-in)',
    items: [
      'Bên thuê mang **CCCD** đến đúng ngày hẹn. Nhân viên kiểm tra ô (trống, sạch, khoá nguyên vẹn) và hàng mang vào: khớp loại đã khai, không có hàng cấm, chất dễ cháy nổ; thực phẩm chỉ gửi ở kho lạnh / kho đông. Không đạt thì không bàn giao ô.',
      'Nhân viên đối chiếu hàng với **hoá đơn / chứng từ** Bên thuê tải lên khi đặt; hai bên **chốt giá trị hàng** trong biên bản — đây là căn cứ bồi thường.',
      'Biên bản có **ảnh từng mục kiểm tra**. Bên thuê xác nhận trên tài khoản ("Đồng ý nhận ô") hoặc bấm **"Không đồng ý"** kèm lý do để quản lý cơ sở xử lý và lập lại biên bản.',
      'Chỉ sau khi Bên thuê đồng ý, nhân viên mới cấp **mã PIN** và **thẻ RFID**.',
    ],
  },
  {
    key: 'during', icon: 'key', title: 'Trong thời gian thuê',
    items: [
      'Bên thuê tự **bảo mật mã PIN / thẻ RFID**. Mất thẻ hoặc lộ mã phải báo ngay qua mục Hỗ trợ để khoá và cấp lại; QueenKho không chịu trách nhiệm khi người khác dùng mã / thẻ do Bên thuê giao.',
      'Sự cố (khoá, an ninh, hư hỏng, vệ sinh, hàng hư / mất) báo qua mục **Hỗ trợ**: mỗi hợp đồng tối đa 3 yêu cầu đang mở, mỗi loại 1 yêu cầu. Bên thuê được huỷ yêu cầu; nếu nhân viên đang xử lý thì cần ghi lý do.',
      'Kho lạnh / kho đông có **cảm biến nhiệt độ**; vượt ngưỡng thì QueenKho báo Bên thuê và xử lý.',
      'QueenKho có thể chuyển hợp đồng sang ô khác **cùng loại, cùng cơ sở** (giá thuê, mã PIN giữ nguyên) khi ô có sự cố, khi Bên thuê yêu cầu hoặc khi đã thống nhất; sự cố do cơ sở thì hỗ trợ chuyển hàng miễn phí.',
    ],
  },
  {
    key: 'insurance', icon: 'verified_user', title: 'Bảo hiểm & bồi thường hàng',
    items: [
      'Hàng hư / mất **do lỗi cơ sở** được bồi thường tới **mức trần của gói** đã chọn và không vượt **giá trị hàng đã chốt khi nhận kho**. Gói có phí còn bồi thường cả rủi ro bất khả kháng theo điều kiện của gói.',
      'Báo qua **Hỗ trợ → Hàng bị hư hỏng**, kèm danh sách hàng, ảnh và số tiền đề nghị. Nhân viên kiểm tra hiện trường; quản lý cơ sở đối chiếu ảnh nhận kho, dữ liệu cảm biến rồi chốt lỗi và số tiền.',
      'Lỗi do Bên thuê (đóng gói, hàng cấm, khai sai) không được bồi thường. Sự cố nghiêm trọng do cơ sở: được chấm dứt hợp đồng **không phí phá hợp đồng**, hoàn tiền thuê theo số ngày còn lại.',
      'Đang trả kho thì tiền bồi thường được cộng thẳng vào **bảng quyết toán** (mục 7).',
    ],
  },
  {
    key: 'renew', icon: 'autorenew', title: 'Gia hạn',
    items: [
      'Gia hạn chậm nhất **3 ngày** trước ngày hết hạn; QueenKho nhắc trước 15, 10, 7, 3 và 1 ngày.',
      'Giá gia hạn theo bảng giá **tại thời điểm gia hạn**; giá mới không làm thay đổi số tiền Bên thuê đã trả.',
      'Sau mốc 3 ngày mà chưa gia hạn, ô được mở cho khách khác đặt trước (khách mới nhận sớm nhất 7 ngày sau ngày hết hạn); Bên thuê chỉ gia hạn được nếu chưa có ai đặt ô.',
      'Gia hạn khi đang hẹn trả kho sẽ huỷ lịch trả kho đó.',
    ],
  },
  {
    key: 'checkout', icon: 'event_available', title: 'Trả kho & tất toán',
    items: [
      'Hẹn ngày trả **trong thời hạn hợp đồng** (từ ngày mai tới ngày hết hạn) và chọn cách nhận tiền hoàn; được dời sang ngày sớm hơn. Không có ân hạn sau ngày hết hạn.',
      '**Trả trước hạn**: tiền thuê được hoàn = tiền thuê kỳ đang dùng − số tháng đã dùng (làm tròn lên) × **giá niêm yết** − **phí phá hợp đồng** bằng 1 tháng giá niêm yết; tối thiểu 0, phần thiếu không trừ vào tiền cọc. Trả trong tháng cuối của kỳ: không hoàn tiền thuê, không phí phá hợp đồng. Phí bảo hiểm của kỳ đang dùng không hoàn.',
      '**Kỳ gia hạn chưa bắt đầu** tại ngày trả kho: hoàn đủ tiền thuê và bảo hiểm của kỳ đó, không tính phí phá hợp đồng.',
      'Các yêu cầu hỗ trợ phải xử lý xong trước buổi nghiệm thu. Sau nghiệm thu, Bên thuê nhận **bảng quyết toán** (Đã đóng − Cơ sở giữ lại + Bồi thường = Hoàn), kèm đối chiếu với số dự kiến lúc hẹn.',
      'Bên thuê bấm **"Xác nhận"** hoặc **"Không đồng ý"** — trước khi cơ sở lập lệnh hoàn tiền. Bảng dương không phản hồi sau 3 ngày coi như đã xác nhận; bảng âm thì Bên thuê thanh toán phần thiếu.',
      'Hợp đồng **chỉ kết thúc khi Bên thuê đã nhận đủ tiền hoàn** (hoặc đã thanh toán đủ phần thiếu).',
      'Không tới nghiệm thu đúng hẹn mà hợp đồng hết hạn: chuyển quá hạn theo mục 8.',
    ],
  },
  {
    key: 'overdue', icon: 'warning', title: 'Quá hạn & kho tổng',
    items: [
      'Hết hạn mà không gia hạn, không trả kho → **quá hạn**: khoá mã truy cập, tính **phí trễ** (% tiền cọc mỗi ngày, có mức tối đa) và **phí chiếm dụng ô** (% giá thuê ngày; giá thuê ngày = giá tháng ÷ 30) cho mỗi ngày quá hạn, không giới hạn.',
      '**Tự động cưỡng chế dọn kho** sau khi quá hạn đủ **5 ngày**; sớm hơn (1–4 ngày) chỉ khi đã liên lạc không thành công ít nhất 2 lần, hoặc ngay trong ngày (giờ làm việc) nếu có khách khác đặt ô.',
      'Khi cưỡng chế: ít nhất 2 nhân sự mở ô, kiểm kê, chụp ảnh, lập biên bản và **chuyển hàng vào kho tổng**; Bên thuê chịu **phí dọn & di dời** một lần.',
      'Tại kho tổng hàng được giữ nguyên vẹn, tính **phí lưu giữ** theo ngày; QueenKho **không bán, không tiêu huỷ** hàng. Bên thuê nhận lại hàng sau khi thanh toán đủ nợ và phí.',
      'Hàng cấm, chất nguy hiểm, giấy tờ tuỳ thân được giao ngay cho công an / UBND phường.',
      'Các khoản phí trừ vào tiền cọc; phần vượt cọc là **khoản nợ**, phải thanh toán trước khi đặt kho mới.',
    ],
  },
  {
    key: 'refund', icon: 'currency_exchange', title: 'Hoàn tiền',
    items: [
      'Hoàn trong **24 giờ làm việc** (không tính Chủ Nhật) sau khi đủ điều kiện, theo cách nhận Bên thuê đã chọn.',
      'Chuyển khoản: Bên thuê bấm **"Đã nhận được"** hoặc **"Chưa nhận được"** (ở Kho của tôi, trang hợp đồng hoặc mục Thanh toán); không phản hồi sau 3 ngày coi như đã nhận. "Chưa nhận được" → cơ sở kiểm tra lại giao dịch hoặc chuyển bổ sung.',
      'Tiền mặt tại quầy: Bên thuê **ký phiếu chi** khi nhận tiền — chữ ký là xác nhận đã nhận.',
    ],
  },
  {
    key: 'commit', icon: 'handshake', title: 'Cam kết',
    items: [
      'Thông tin cá nhân (CCCD, ảnh) chỉ dùng cho hợp đồng và đối chiếu khi bàn giao, trả kho.',
      'Bên thuê xác nhận **đã đọc, hiểu và đồng ý** toàn bộ điều khoản này khi đặt kho.',
    ],
  },
]

function Rich({ text }) {
  return text.split('**').map((part, i) => (i % 2 === 1
    ? <strong key={i} className="font-black text-[#4B4B4B]">{part}</strong>
    : <span key={i}>{part}</span>))
}

// summary (tuỳ chọn): bảng phí & hoàn tiền bằng số của đơn đang đặt (PolicySummaryService)
export default function AssetTermsModal({ open, onClose, onAccept, summary }) {
  if (!open) return null
  return <TermsBody onClose={onClose} onAccept={onAccept} summary={summary} />
}

// Tách thân modal để trạng thái "đã đọc hết" / mục đang thu gọn bắt đầu lại mỗi lần mở
function TermsBody({ onClose, onAccept, summary }) {
  const scrollRef = useRef(null)
  const [collapsed, setCollapsed] = useState({})
  const [readToEnd, setReadToEnd] = useState(false)

  const onScroll = (e) => {
    const el = e.currentTarget
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setReadToEnd(true)
  }

  const jumpTo = (key) => {
    setCollapsed((c) => ({ ...c, [key]: false }))
    const target = scrollRef.current?.querySelector(`#terms-${key}`)
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const allOpen = SECTIONS.every((s) => !collapsed[s.key])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" onClick={onClose}>
      <div className="duo-card bg-white w-full max-w-[680px] max-h-[90vh] shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b-2 border-[#E5E5E5] flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FFC800] border-b-2 border-[#E5A800] text-white flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">gavel</span>
          </div>
          <div className="flex-1">
            <h2 className="text-base font-black text-[#4B4B4B]">Điều khoản thuê kho & xử lý tài sản</h2>
            <p className="text-[11px] font-bold text-[#AFAFAF]">Phiên bản {TERMS_VERSION} · căn cứ BLDS 2015 (thoả thuận xử lý tài sản)</p>
          </div>
        </div>

        <div ref={scrollRef} onScroll={onScroll} className="px-6 py-4 overflow-y-auto flex flex-col gap-4">
          {/* Mục lục */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">Mục lục</p>
              <button type="button" className="text-[11px] font-black text-[#1CB0F6] cursor-pointer"
                onClick={() => setCollapsed(allOpen ? Object.fromEntries(SECTIONS.map((s) => [s.key, true])) : {})}>
                {allOpen ? 'Thu gọn tất cả' : 'Mở tất cả'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SECTIONS.map((s, i) => (
                <button key={s.key} type="button" onClick={() => jumpTo(s.key)}
                  className="px-2.5 py-1 rounded-lg border-2 border-[#E5E5E5] text-[11px] font-black text-[#4B4B4B] hover:border-[#1CB0F6] cursor-pointer">
                  {i + 1}. {s.title}
                </button>
              ))}
            </div>
          </div>

          {summary && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-black uppercase tracking-wider text-[#1899D6]">Tóm tắt bằng số — đơn của bạn</p>
              <PolicySummary summary={summary} />
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            {SECTIONS.map((s, i) => {
              const isCollapsed = Boolean(collapsed[s.key])
              return (
                <section key={s.key} id={`terms-${s.key}`} className="border-2 border-[#E5E5E5] rounded-2xl overflow-hidden scroll-mt-2">
                  <button type="button" onClick={() => setCollapsed((c) => ({ ...c, [s.key]: !isCollapsed }))}
                    className="w-full flex items-center gap-2.5 px-4 py-3 bg-[#F7F7F7] text-left cursor-pointer">
                    <span className="material-symbols-outlined text-[20px] text-[#1CB0F6]">{s.icon}</span>
                    <span className="flex-1 text-sm font-black text-[#4B4B4B]">{i + 1}. {s.title}</span>
                    <span className="material-symbols-outlined text-[20px] text-[#AFAFAF]">{isCollapsed ? 'expand_more' : 'expand_less'}</span>
                  </button>
                  {!isCollapsed && (
                    <ul className="px-4 py-3 flex flex-col gap-2">
                      {s.items.map((text, j) => (
                        <li key={j} className="flex gap-2 text-[13px] font-semibold text-[#555555] leading-relaxed">
                          <span className="text-[#1CB0F6] font-black shrink-0">•</span>
                          <span><Rich text={text} /></span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )
            })}
          </div>
        </div>

        <div className="px-6 py-4 border-t-2 border-[#E5E5E5] flex flex-wrap items-center justify-end gap-3">
          {onAccept && !readToEnd && (
            <span className="text-[11px] font-bold text-[#AFAFAF] mr-auto">Cuộn tới cuối điều khoản để bấm đồng ý</span>
          )}
          <button type="button" onClick={onClose} className="duo-btn-white px-5 py-2.5 text-sm">
            Đóng
          </button>
          {onAccept && (
            <button type="button" onClick={onAccept} disabled={!readToEnd}
              className="duo-btn-green px-5 py-2.5 text-sm gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
              <span className="material-symbols-outlined text-[18px]">check</span>
              Tôi đồng ý
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
