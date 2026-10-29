// UC-06: Trạng thái HIỂN THỊ của ô kho trên sơ đồ / danh sách.
// Không phải giá trị cột storage_units.status — được suy ra từ status ô + hợp đồng hiện tại.
export const DISPLAY_STATES = {
  MAINTENANCE: {
    label: 'Bảo trì',
    icon: 'build',
    tile: 'bg-[#F0F0F0] border-[#AFAFAF] text-[#777777]',
    badge: 'bg-[#F0F0F0] text-[#777777] border-2 border-[#AFAFAF]',
    dot: 'bg-[#AFAFAF]'
  },
  OVERDUE: {
    label: 'Quá hạn',
    icon: 'warning',
    tile: 'bg-[#FFDFDF] border-[#FF4B4B] text-[#EA2B2B]',
    badge: 'bg-[#FFDFDF] text-[#FF4B4B] border-2 border-[#FF4B4B]',
    dot: 'bg-[#FF4B4B]'
  },
  PENDING_CHECK_IN: {
    label: 'Chờ check-in',
    icon: 'schedule',
    tile: 'bg-[#FFF4CC] border-[#FFC800] text-[#B58900]',
    badge: 'bg-[#FFF4CC] text-[#B58900] border-2 border-[#FFC800]',
    dot: 'bg-[#FFC800]'
  },
  TERMINATION_PENDING: {
    label: 'Đang trả kho',
    icon: 'logout',
    tile: 'bg-[#DDF4FF] border-[#1CB0F6] border-dashed text-[#1899D6]',
    badge: 'bg-[#DDF4FF] text-[#1899D6] border-2 border-dashed border-[#1CB0F6]',
    dot: 'bg-[#84D8FF]'
  },
  OCCUPIED: {
    label: 'Đang thuê',
    icon: 'lock',
    tile: 'bg-[#DDF4FF] border-[#1CB0F6] text-[#1899D6]',
    badge: 'bg-[#DDF4FF] text-[#1899D6] border-2 border-[#1CB0F6]',
    dot: 'bg-[#1CB0F6]'
  },
  AVAILABLE: {
    label: 'Còn trống',
    icon: 'check',
    tile: 'bg-[#D7FFB8] border-[#58CC02] text-[#58A700]',
    badge: 'bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]',
    dot: 'bg-[#58CC02]'
  },
  UNKNOWN: {
    label: 'Không rõ',
    icon: 'help',
    tile: 'bg-white border-[#E5E5E5] text-[#AFAFAF]',
    badge: 'bg-white text-[#AFAFAF] border-2 border-[#E5E5E5]',
    dot: 'bg-[#E5E5E5]'
  }
};

// Thứ tự hiện trên chú thích (legend)
export const DISPLAY_STATE_ORDER = [
  'AVAILABLE',
  'PENDING_CHECK_IN',
  'OCCUPIED',
  'TERMINATION_PENDING',
  'OVERDUE',
  'MAINTENANCE'
];

// Ưu tiên: Bảo trì > Quá hạn > Chờ check-in > Đang trả kho > Đang thuê > Còn trống
export function getDisplayState(unit) {
  const contractStatus = unit.currentContract?.contractStatus;
  if (unit.status === 'MAINTENANCE') return 'MAINTENANCE';
  if (unit.overdue || contractStatus === 'OVERDUE') return 'OVERDUE';
  if (contractStatus === 'PENDING_CHECK_IN') return 'PENDING_CHECK_IN';
  if (contractStatus === 'TERMINATION_PENDING') return 'TERMINATION_PENDING';
  if (unit.status === 'OCCUPIED' || unit.status === 'RESERVED') return 'OCCUPIED';
  if (unit.status === 'AVAILABLE') return 'AVAILABLE';
  return 'UNKNOWN';
}

// So sánh số phòng theo số ("20" trước "110"), không theo chuỗi
export function compareRoomNumber(a, b) {
  return String(a ?? '').localeCompare(String(b ?? ''), 'vi', { numeric: true });
}
