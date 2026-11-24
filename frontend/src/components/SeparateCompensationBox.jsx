// PR-O19c (24/11/2026): tiền đền bù (hồ sơ bồi thường hàng) là KHOẢN RIÊNG — quản lý cơ sở chi ở màn Bồi thường hàng hoá,
// không nằm trong tiền hoàn trả kho (cọc + tiền thuê chưa dùng − phí). Khối này đặt ngay dưới bảng hoàn trả kho
// để khách / nhân viên thấy rõ 2 nguồn tiền khác nhau.
// items: [{ claimId, claimCode, status: APPROVED | PAID, amount, goodsCompensation, penaltyAmount, rentRefundAmount, paidAt, paymentMethod, hasPayoutAccount }]

function formatVND(v) {
  return Number(v || 0).toLocaleString('vi-VN') + '₫'
}

export default function SeparateCompensationBox({ items, viewer = 'CUSTOMER' }) {
  if (!items || items.length === 0) return null
  const you = viewer === 'CUSTOMER'
  const total = items.reduce((s, c) => s + Number(c.amount || 0), 0)
  return (
    <div className="border-2 border-[#CE82FF] rounded-xl overflow-hidden bg-white">
      <div className="px-4 py-2.5 bg-[#FAF5FF] border-b border-[#E9D5FF] flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[11px] font-black uppercase tracking-wider text-[#A560E8]">Tiền đền bù — khoản riêng</span>
          <span className="text-[11px] font-bold text-[#777777] leading-snug">
            Không nằm trong tiền hoàn trả kho ở trên. Quản lý cơ sở chi riêng theo hồ sơ bồi thường
            {you ? ' (chuyển vào tài khoản bạn nhập ở mục Hỗ trợ, hoặc tiền mặt tại quầy).' : ' ở màn Bồi thường hàng hoá.'}
          </span>
        </div>
        <span className="text-sm font-black text-[#A560E8] whitespace-nowrap">{formatVND(total)}</span>
      </div>
      {items.map((c) => {
        const paid = c.status === 'PAID'
        const parts = [
          Number(c.goodsCompensation) > 0 && `hàng ${formatVND(c.goodsCompensation)}`,
          Number(c.penaltyAmount) > 0 && `đền bù thêm theo hợp đồng ${formatVND(c.penaltyAmount)}`,
          Number(c.rentRefundAmount) > 0 && `hoàn tiền thuê ngày ô gián đoạn ${formatVND(c.rentRefundAmount)}`,
        ].filter(Boolean)
        return (
          <div key={c.claimId || c.claimCode} className="px-4 py-2.5 border-b last:border-b-0 border-[#F3E8FF] flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-black text-[#4B4B4B]">Hồ sơ {c.claimCode}</span>
              <span className="text-xs font-black text-[#4B4B4B] whitespace-nowrap">{formatVND(c.amount)}</span>
            </div>
            {parts.length > 0 && <span className="text-[11px] font-bold text-[#AFAFAF]">= {parts.join(' + ')}</span>}
            <span className={`self-start px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${paid
              ? 'bg-[#D7FFB8] text-[#58A700]' : 'bg-[#FFE8CC] text-[#E58800]'}`}>
              {paid
                ? `Đã chi${c.paymentMethod ? (c.paymentMethod === 'CASH' ? ' tiền mặt' : ' chuyển khoản') : ''}${c.paidAt ? ' · ' + new Date(c.paidAt).toLocaleString('vi-VN') : ''}`
                : 'Chờ quản lý cơ sở chi'}
            </span>
            {!paid && !c.hasPayoutAccount && (
              <span className="text-[11px] font-bold text-[#D96B00]">
                {you ? 'Bạn chưa nhập tài khoản nhận tiền — nhập ở mục Hỗ trợ (hồ sơ ' + c.claimCode + ').' : 'Khách chưa nhập tài khoản nhận tiền.'}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
