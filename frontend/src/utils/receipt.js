// Phiếu biên nhận đặt kho: mở cửa sổ in của trình duyệt để khách in hoặc "Lưu thành PDF".
// Dùng trang HTML riêng (không in cả layout) và font hệ thống nên không lỗi tiếng Việt.

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatVND(amount) {
  return Number(amount || 0).toLocaleString('vi-VN') + 'đ'
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function formatDate(value) {
  if (!value) return '—'
  return String(value).slice(0, 10).split('-').reverse().join('/')
}

/**
 * data: { reservationCode, transactionCode, bankTransactionCode, paidAt, customerName, customerPhone,
 *         customerEmail, facilityName, facilityAddress, facilityHotline, unitTypeName, dimensions,
 *         startDate, durationMonths, rentAmount, depositAmount, voucherCode, voucherDiscount, totalPaid }
 * Trả false nếu trình duyệt chặn cửa sổ mới.
 */
export function printReservationReceipt(data) {
  const rows = [
    ['Mã đặt chỗ', `#${data.reservationCode || '—'}`],
    ['Mã giao dịch', data.transactionCode || '—'],
    ['Mã GD ngân hàng', data.bankTransactionCode || '—'],
    ['Thời điểm thanh toán', formatDateTime(data.paidAt)],
  ]
  const customerRows = [
    ['Khách hàng', data.customerName],
    ['Số điện thoại', data.customerPhone],
    ['Email', data.customerEmail],
  ]
  const storageRows = [
    ['Cơ sở', data.facilityName],
    ['Địa chỉ', data.facilityAddress],
    ['Hotline', data.facilityHotline || '—'],
    ['Loại kho', [data.unitTypeName, data.dimensions].filter(Boolean).join(' • ')],
    ['Ngày nhận kho', formatDate(data.startDate)],
    ['Thời hạn thuê', `${data.durationMonths || '—'} tháng`],
  ]
  const moneyRows = [
    ['Tiền thuê (đã trừ ưu đãi gói)', formatVND(data.rentAmount)],
    ['Tiền cọc (hoàn lại khi trả kho)', formatVND(data.depositAmount)],
  ]
  if (Number(data.insuranceAmount) > 0) {
    moneyRows.push([`Bảo hiểm hàng hoá ${data.insurancePlanLabel || ''}`.trim(), formatVND(data.insuranceAmount)])
  }
  if (Number(data.voucherDiscount) > 0) {
    moneyRows.push([`Voucher ${data.voucherCode || ''}`.trim(), `-${formatVND(data.voucherDiscount)}`])
  }

  const table = (title, items) => `
    <h2>${escapeHtml(title)}</h2>
    <table>${items.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v ?? '—')}</td></tr>`).join('')}</table>`

  const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<title>Bien nhan ${escapeHtml(data.reservationCode || '')}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, "Segoe UI", sans-serif; color: #222; margin: 0; padding: 32px; }
  .sheet { max-width: 720px; margin: 0 auto; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #58CC02; padding-bottom: 12px; }
  .brand { font-size: 24px; font-weight: 800; color: #58A700; }
  .sub { font-size: 12px; color: #777; }
  h1 { font-size: 20px; text-align: center; margin: 20px 0 4px; text-transform: uppercase; }
  .center { text-align: center; }
  h2 { font-size: 13px; text-transform: uppercase; color: #777; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #ddd; padding: 7px 10px; text-align: left; vertical-align: top; }
  th { width: 42%; background: #f7f7f7; font-weight: 600; }
  .total { margin-top: 12px; display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; border: 2px solid #58CC02; padding: 10px 12px; }
  .note { font-size: 11px; color: #777; margin-top: 18px; line-height: 1.5; }
  .sign { display: flex; justify-content: space-between; margin-top: 36px; font-size: 12px; text-align: center; }
  .sign div { width: 45%; }
  @media print { body { padding: 0; } }
</style></head>
<body><div class="sheet">
  <header>
    <div><div class="brand">QueenKho</div><div class="sub">Hệ thống cho thuê kho tự quản</div></div>
    <div class="sub" style="text-align:right">In lúc ${escapeHtml(formatDateTime(new Date()))}</div>
  </header>
  <h1>Phiếu biên nhận đặt kho</h1>
  <p class="center sub">Xác nhận đã thanh toán đợt 1 qua VNPAY</p>
  ${table('Giao dịch', rows)}
  ${table('Khách hàng', customerRows)}
  ${table('Thông tin thuê kho', storageRows)}
  ${table('Chi tiết thanh toán', moneyRows)}
  <div class="total"><span>TỔNG ĐÃ THANH TOÁN</span><span>${escapeHtml(formatVND(data.totalPaid))}</span></div>
  <p class="note">
    • Ô kho cụ thể sẽ được Quản lý cơ sở gán sau khi xác nhận cọc; hợp đồng điện tử hiển thị trong mục "Kho của tôi".<br>
    • Vui lòng mang CCCD/Passport khi đến nhận kho. Tiền cọc được hoàn khi trả kho theo điều khoản đã đồng ý.
  </p>
  <div class="sign"><div>Khách hàng<br><br><br>${escapeHtml(data.customerName || '')}</div><div>Đại diện QueenKho<br><br><br>(đã thanh toán điện tử)</div></div>
</div>
<script>window.onload = function () { window.focus(); window.print(); };</script>
</body></html>`

  const win = window.open('', '_blank', 'width=820,height=900')
  if (!win) return false
  win.document.open()
  win.document.write(html)
  win.document.close()
  return true
}
