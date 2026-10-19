// UC-03: thông tin hiển thị của 5 vai trò cố định (dùng chung cho UC-03, UC-08, UC-31)

export const ROLE_ORDER = ['CUSTOMER', 'STAFF', 'FACILITY_MANAGER', 'BOM', 'ADMIN']

export const ROLE_LABELS = {
  CUSTOMER: 'Khách hàng',
  STAFF: 'Nhân viên',
  FACILITY_MANAGER: 'Quản lý cơ sở',
  BOM: 'Ban vận hành (BOM)',
  ADMIN: 'Quản trị viên',
}

// Màu + icon của từng role (thẻ, badge)
export const ROLE_STYLES = {
  CUSTOMER:         { icon: 'person',               bg: 'bg-[#DDF4FF]', text: 'text-[#1899D6]', border: 'border-[#84D8FF]' },
  STAFF:            { icon: 'badge',                bg: 'bg-[#D7FFB8]', text: 'text-[#58A700]', border: 'border-[#58CC02]' },
  FACILITY_MANAGER: { icon: 'warehouse',            bg: 'bg-[#FFE8CC]', text: 'text-[#E58800]', border: 'border-[#FF9600]' },
  BOM:              { icon: 'monitoring',           bg: 'bg-[#FFF3B3]', text: 'text-[#B38F00]', border: 'border-[#FFC800]' },
  ADMIN:            { icon: 'admin_panel_settings', bg: 'bg-[#F3E3FF]', text: 'text-[#A559D9]', border: 'border-[#CE82FF]' },
}

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || role
}

// Ma trận vai trò → màn hình (business-rules.md mục 1.3). Chỉ để hiển thị — PR-A1 không làm bảng permission.
// true = có quyền đầy đủ · chuỗi = quyền hạn chế (ghi chú) · không có key = không có quyền
export const ADMIN_ROLE_MATRIX = [
  {
    screens: 'Tìm & đặt kho, Kho của tôi, Hỗ trợ',
    access: { CUSTOMER: true },
  },
  {
    screens: 'Bảng công việc, check-in / nghiệm thu, sự cố, xử lý hỗ trợ',
    access: { STAFF: true, FACILITY_MANAGER: 'Xem, gỡ người nhận, gia hạn task hỗ trợ' },
  },
  {
    screens: 'Đơn chờ gán ô, No-Show, ô kho, hợp đồng quá hạn, dashboard cơ sở, hoàn tiền',
    access: { FACILITY_MANAGER: true },
  },
  {
    screens: 'Tạo / khoá tài khoản Staff',
    access: { FACILITY_MANAGER: 'Cơ sở mình', ADMIN: true },
  },
  {
    screens: 'Cơ sở, loại kho & giá, chính sách, doanh thu',
    access: { FACILITY_MANAGER: 'Xem chính sách', BOM: true },
  },
  {
    screens: 'Vai trò, người dùng, nhật ký',
    access: { ADMIN: true },
  },
]
