import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import { TaskConfirmDialog, TaskToast } from '../../components/TaskActionFeedback';
import {
  prepareCheckInHandover,
  withdrawCheckInHandover,
  reportCheckInBlocker,
  checkInStaffTask,
  reopenCheckInHandover,
  confirmCheckInUnitIssue,
  checkOutStaffTask,
  completeMaintenanceTask,
  completeRefundTask,
  extendOverdueTask,
  extendSupportTask,
  getStaffTaskDetail,
  requestMaintenanceUnitTransfer,
  resetSupportContractPin,
  reissueSupportContractRfid,
  resolveSupportTask,
  reopenSupportTask,
  updateSupportResolution,
  suggestAccessPin,
  uploadImageFile,
} from '../../services/staffTaskService';
import { getCheckInHandover } from '../../services/contractService';
import { rescheduleReservation } from '../../services/reservationService';
import TransferUnitModal from '../../components/TransferUnitModal';
import SimulationButton from '../../components/SimulationButton';
import SettlementPanel from '../../components/SettlementPanel';
import UnitLocationMap from '../../components/UnitLocationMap';
import { simulateArriveToday, simulateAppointmentIn, simulateCheckoutToday, simulateNoShow, simulateOverdue, simulateTaskOverdue } from '../../services/simulationService';
import { assignLockedUntil } from '../../utils/taskWindow';
import { HandoverPhotoPicker, PhotoGrid } from '../../components/HandoverPhotos';
import { compressImageToDataUrl, createMockEvidenceDataUrl } from '../../utils/imageEvidence';
import { getCentralWarehouses } from '../../services/catalogService';
import { getOverdueFeeBreakdown } from '../../utils/overdueFee';
import IncidentReportModal from '../../components/IncidentReportModal';
import { INCIDENT_REPORT_TEMPLATES, buildIncidentReportNote, buildBlankIncidentReport, findMatchingTemplate, getPresetsForTask } from '../../utils/incidentTemplates';

// UC-18: Chi tiết task + Check-in & lập biên bản bàn giao (Handover Record)
// UC-23: Nghiệm thu trả kho (Checkout Inspection)
// UC-24: Ghi nhận sự cố hư hỏng & khấu trừ cọc kèm ảnh bằng chứng (Record Damage Case)
// UC-27: Xử lý yêu cầu hỗ trợ của khách hàng (Process Support Requests)

const TYPE_META = {
  CHECK_IN:    { label: 'Check-in',    icon: 'login',         cls: 'bg-[#D7FFB8] text-[#58A700] border-[#58CC02]' },
  CHECK_OUT:   { label: 'Check-out',   icon: 'logout',        cls: 'bg-[#FFE8CC] text-[#E58800] border-[#FF9600]' },
  REFUND:      { label: 'Hoàn tiền',   icon: 'payments',      cls: 'bg-[#DDF4FF] text-[#1CB0F6] border-[#84D8FF]' },
  SUPPORT:     { label: 'Hỗ trợ KH',   icon: 'support_agent', cls: 'bg-[#FFF0D6] text-[#D97706] border-[#F59E0B]' },
  MAINTENANCE: { label: 'Bảo trì kho', icon: 'build',         cls: 'bg-[#FFDFDF] text-[#FF4B4B] border-[#FF4B4B]' },
};

const SUPPORT_ISSUE_LABEL = {
  LOCK_ISSUE: 'Sự cố khóa / Mã PIN (Khẩn)',
  SECURITY: 'An ninh / Đột nhập (Khẩn)',
  FACILITY_DAMAGE: 'Hư hỏng hạ tầng ô kho',
  CLEANING: 'Vệ sinh ô kho / Hành lang',
  OTHER: 'Yêu cầu hỗ trợ khác',
};

const SUPPORT_TICKET_STATUS_META = {
  OPEN:        { label: 'Chờ xử lý',          cls: 'bg-[#FFF5E6] text-[#E58800] border border-[#FF9600]' },
  IN_PROGRESS: { label: 'Đang xử lý',         cls: 'bg-[#DDF4FF] text-[#1899D6] border border-[#84D8FF]' },
  RESOLVED:    { label: 'Chờ khách xác nhận', cls: 'bg-[#D7FFB8] text-[#58A700] border border-[#58CC02]' },
  CLOSED:      { label: 'Đã đóng',            cls: 'bg-[#F7F7F7] text-[#777777] border border-[#E5E5E5]' },
};

const SUPPORT_PRESETS_BY_TYPE = {
  LOCK_ISSUE: [
    'Đã cấp lại mã PIN 6 số mới cho khách hàng và kiểm tra đóng/mở khóa ổn định.',
    'Đã kiểm tra SmartLock tại hiện trường, thay pin khóa và hướng dẫn khách mở cửa thành công.',
    'Đã tra mỡ bôi trơn và cân chỉnh chốt khóa kẹt, khách mở khóa trơn tru.',
  ],
  SECURITY: [
    'Đã tuần tra trực tiếp khu vực ô kho và đối chiếu camera an ninh; khu vực an toàn, không có dấu hiệu cạy phá.',
    'Đã kiểm tra ổ khóa ô kho, phát hiện vết xước nhẹ bên ngoài nhưng chốt khóa còn nguyên vẹn; đã dặn bảo vệ tăng cường tuần tra.',
    'Đã lập biên bản kiểm tra an ninh, niêm phong tạm thời và báo cáo Quản lý cơ sở để trích xuất dữ liệu camera chi tiết.',
  ],
  FACILITY_DAMAGE: [
    'Đã thay mới bóng đèn chiếu sáng trước ô kho, thử bật/tắt hoạt động tốt.',
    'Đã tra dầu mỡ bôi trơn ray cửa cuốn và chỉnh lại chốt khóa, đóng mở trơn tru.',
    'Đã kiểm tra và xử lý tạm thời chống thấm; đã lên lịch bảo trì mái trần vào ngày mai.',
    'Đã khảo sát hỏng hóc nặng tại cửa cuốn/motor, đã chuyển thông tin cho đội bảo trì kỹ thuật (MAINTENANCE) xử lý.',
  ],
  CLEANING: [
    'Đã thu gom toàn bộ rác thải, thùng carton trước cửa ô và lau sạch hành lang.',
    'Đã lau khô và khử khuẩn vệt nước tràn tại lối đi, trả lại mặt bằng sạch sẽ, khô ráo.',
    'Đã quét dọn và hút bụi khu vực bốc xếp đồ quanh ô kho.',
  ],
  OTHER: [
    'Đã giải thích chi tiết quy định và cước phí thuê kho cho khách hàng qua điện thoại / trực tiếp.',
    'Đã hướng dẫn khách hàng thủ tục chuyển đổi ô kho và đặt lịch hỗ trợ.',
    'Đã tiếp nhận yêu cầu và xử lý thỏa đáng cho khách hàng.',
  ],
};

const SUPPORT_RESOLUTION_PRESETS = [
  'Đã kiểm tra SmartLock tại hiện trường, thay pin khóa và hướng dẫn khách mở cửa thành công.',
  'Đã cấp lại mã PIN 6 số mới cho khách hàng và kiểm tra đóng/mở khóa ổn định.',
  'Đã kiểm tra hệ thống an ninh và camera khu vực ô kho, xác nhận tài sản an toàn.',
  'Đã xử lý vệ sinh sạch sẽ khu vực hành lang và trước cửa ô kho theo phản ánh.',
  'Đã khắc phục sự cố kỹ thuật tại ô kho và thông báo kết quả cho khách hàng.',
];

const STATUS_META = {
  OPEN:        { label: 'Chờ nhận',   cls: 'bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF]' },
  IN_PROGRESS: { label: 'Đang xử lý', cls: 'bg-[#F3E8FF] text-[#A560E8] border-2 border-[#CE82FF]' },
  AWAITING_CUSTOMER: { label: 'Chờ khách xác nhận', cls: 'bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF]' },
  BLOCKED_UNIT_ISSUE: { label: 'Ô không đạt', cls: 'bg-[#FFDFDF] text-[#FF4B4B] border-2 border-[#FF4B4B]' },
  OVERDUE:     { label: 'Quá hạn',    cls: 'bg-[#FFDFDF] text-[#FF4B4B] border-2 border-[#FF4B4B]' },
  COMPLETED:   { label: 'Hoàn thành', cls: 'bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]' },
  CANCELLED:   { label: 'Đã huỷ',     cls: 'bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]' },
};

const CONTRACT_STATUS_LABEL = {
  PENDING_CHECK_IN: 'Chờ check-in',
  ACTIVE: 'Đang hoạt động',
  OVERDUE: 'Quá hạn thanh toán',
  TERMINATION_PENDING: 'Chờ trả kho',
  SETTLEMENT_PENDING: 'Đang tất toán trả kho', // D-21, D-23: gồm cả chờ hoàn tiền
  TERMINATED: 'Đã chấm dứt',
  LIQUIDATED: 'Đã cưỡng chế dọn kho',
};

const UNIT_STATUS_LABEL = {
  AVAILABLE: 'Trống (Sẵn sàng)',
  OCCUPIED: 'Đang thuê',
  MAINTENANCE: 'Đang bảo trì',
  RESERVED: 'Đã giữ chỗ',
};

// Staff kiểm 5 mục; khách xác nhận độc lập trên tài khoản sau khi xem ô thực tế.
// Mục 6 (họp nhóm 05/11/2026, PR-C7 / BR-132): kiểm tra hàng khách mang vào; biên bản lưu ở prohibitedGoodsCommitted
const CHECKIN_CHECKLIST = [
  { key: 'identityVerified',           label: 'Đã xác minh CCCD của khách',     hint: 'Đối chiếu CCCD với thông tin đặt chỗ' },
  { key: 'unitChecked',                label: 'Đã kiểm tra ô kho',              hint: 'Ô trống, sạch sẽ và sẵn sàng bàn giao' },
  { key: 'lockIntact',                 label: 'Khoá SmartLock nguyên vẹn',      hint: 'Khoá hoạt động, không trầy xước' },
  { key: 'goodsChecked', recordKey: 'prohibitedGoodsCommitted', label: 'Đã kiểm tra hàng mang vào',
    hint: 'Hàng khớp loại khách khai báo, không có chất dễ cháy nổ / hàng cấm' },
  { key: 'goodsValueVerified', label: 'Đã đối chiếu giá trị và chứng từ hàng',
    hint: 'So hàng thực tế với hoá đơn/biên lai và giá trị khách khai lúc đặt kho' },
];

// 5 mục kiểm tra của biên bản Nghiệm thu trả kho (UC-23) — chia nhóm bắt buộc vs hiện trạng
const CHECKOUT_BLOCKING_LIST = [
  { key: 'identityVerified',           label: 'Đã xác minh CCCD của khách hàng',                  hint: 'Đối chiếu đúng chủ hợp đồng đến làm thủ tục trả kho' },
  { key: 'unitEmpty',                  label: 'Ô kho đã dọn trống hoàn toàn',                     hint: 'Khách đã di dời toàn bộ tài sản cá nhân ra khỏi ô kho' },
  { key: 'customerSignatureConfirmed', label: 'Khách đã ký biên bản nghiệm thu & trả thẻ RFID',   hint: 'Khách xác nhận hiện trạng kho và quyết toán tiền cọc' },
];

const CHECKOUT_CONDITION_LIST = [
  { key: 'unitClean',  label: 'Ô kho sạch sẽ, không còn rác tồn đọng',     hint: 'Bỏ chọn nếu kho bẩn / còn rác bỏ lại → Lập sự cố phí vệ sinh' },
  { key: 'lockIntact', label: 'Khoá SmartLock & vách ô kho nguyên vẹn',    hint: 'Bỏ chọn nếu khoá hỏng, móp vách, hư hại → Lập sự cố bồi thường' },
];

const DAMAGE_PRESETS = [
  { title: 'Phí vệ sinh rác thải tồn đọng trong kho', cost: 150000, desc: 'Khách để lại rác thải, bao bì cần nhân viên dọn vệ sinh công nghiệp.' },
  { title: 'Hư hỏng / mất thẻ từ RFID',              cost: 100000, desc: 'Khách làm mất hoặc làm gãy hỏng thẻ từ RFID được cấp.' },
  { title: 'Hỏng chốt khoá điện tử SmartLock',       cost: 350000, desc: 'Khoá SmartLock bị cạy hoặc va đập gây kẹt chốt.' },
  { title: 'Móp méo / trầy xước vách ngăn ô kho',    cost: 500000, desc: 'Vách tôn / cửa cuốn bị móp biến dạng do va chạm khi chuyển đồ.' },
  { title: 'Thấm dột mái / rỉ nước từ trần',           cost: 800000, desc: 'Nước mưa thấm từ mái tôn của cơ sở, không do khách gây ra.', liableParty: 'FACILITY' },
];

// UC-24: ai chịu lỗi sự cố — lỗi khách bị trừ cọc (vượt cọc thành nợ), lỗi cơ sở hoàn cọc bình thường
const LIABLE_OPTIONS = [
  { value: 'CUSTOMER', label: 'Lỗi khách', hint: 'Trừ vào cọc', cls: 'border-[#FF4B4B] bg-[#FFF5F5] text-[#EA2B2B]' },
  { value: 'FACILITY', label: 'Lỗi cơ sở', hint: 'Không tính khách', cls: 'border-[#1CB0F6] bg-[#DDF4FF] text-[#1899D6]' },
];

const MAINTENANCE_NOTE_MIN = 10;

const EMPTY_CHECKIN_CHECKS = CHECKIN_CHECKLIST.reduce((acc, item) => ({ ...acc, [item.key]: false }), {});
const INITIAL_CHECKOUT_CHECKS = {
  identityVerified: false,
  unitEmpty: false,
  unitClean: true,
  lockIntact: true,
  customerSignatureConfirmed: false,
};

const NOTES_MAX = 1000;

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} · ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

import { parseRefundNote } from '../../utils/refundParser';

// D-23 / PR-O30: task hoàn tiền trả kho — tách hoàn cọc + tiền thuê và bồi thường từng hồ sơ (lấy từ quyết toán)
function SettlementRefundRows({ split, isManager }) {
  const fmt = (v) => Number(v || 0).toLocaleString('vi-VN') + '₫';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs text-[#475569]">
        <span className="font-bold">• Hoàn cọc + tiền thuê (quyết toán vòng {split.roundNo}):</span>
        <span className="font-black">{fmt(split.depositRentRefund)}</span>
      </div>
      {(Number(split.compensationPayout) > 0 || Number(split.compensationOffset) > 0) && (
        <div className="flex flex-col gap-1 text-xs text-[#9A3412] bg-[#FFF7ED] px-2.5 py-1.5 rounded-xl border border-[#FDBA74]">
          <div className="flex justify-between">
            <span className="font-bold">• Bồi thường hàng hư / mất:</span>
            <span className="font-black">+ {fmt(split.compensationPayout)}</span>
          </div>
          {(split.claims || []).map((c) => (
            <div key={c.id} className="flex justify-between pl-3 text-[11px]">
              {isManager
                ? <a href={`/manager/claims/${c.id}`} className="font-mono font-bold underline">{c.claimCode}</a>
                : <span className="font-mono font-bold">{c.claimCode}</span>}
              <span className="font-bold">{c.claimType === 'GOODS_LOSS' ? 'Mất hàng' : 'Hư hàng'} · {fmt(c.amount)}</span>
            </div>
          ))}
          {Number(split.compensationOffset) > 0 && (
            <span className="pl-3 text-[11px] font-bold">Đã cấn trừ {fmt(split.compensationOffset)} vào phí vượt cọc — chỉ chi phần còn lại.</span>
          )}
        </div>
      )}
      {isManager && split.contractId && (
        <a href="/manager/settlements?tab=REFUND" className="text-[11px] font-black text-[#1CB0F6] self-start">Xem bảng quyết toán</a>
      )}
    </div>
  );
}
import DateInput from '../../components/DateInput';

function formatDate(value) {
  if (!value) return '—';
  const [y, m, d] = String(value).split('-');
  return `${d}/${m}/${y}`;
}

function formatCurrency(amount) {
  const num = Number(amount || 0);
  return num.toLocaleString('vi-VN') + ' đ';
}

// BR-121: ảnh mẫu hiện trạng ô cho các nút "Giả lập" (chỉ thêm khi chưa có ảnh thật)
function withMockHandoverPhoto(photos, task, action) {
  return photos.length > 0
    ? photos
    : [createMockEvidenceDataUrl(`Hiện trạng ô ${task?.storageUnitId || ''} lúc ${action}`, 'ẢNH HIỆN TRẠNG Ô KHO')];
}

// Vì sao người đang xem không lập được biên bản (null = lập được)
function blockedReason(task, userId) {
  if (task.taskType === 'MAINTENANCE') return null; // xét riêng trong MaintenancePanel (FM được đóng thẳng)
  if (task.taskType === 'REFUND') {
    if (task.status === 'CANCELLED') return 'Yêu cầu hoàn tiền đã bị huỷ.';
    return null;
  }
  if (task.taskType === 'SUPPORT') {
    if (task.status === 'COMPLETED') return null;
    if (task.status === 'CANCELLED') return task.cancelReason ? `Task đã huỷ — ${task.cancelReason}.` : 'Yêu cầu hỗ trợ đã bị huỷ hoặc đã đóng.';
    if (task.status === 'OPEN') return 'Task hỗ trợ chưa có người nhận. Hãy quay lại bảng công việc và bấm "Nhận việc" trước.';
    if (task.status === 'OVERDUE') return 'Task hỗ trợ đã quá hạn (PR-S4). Cần Quản lý cơ sở gia hạn trước khi nhân viên có thể hoàn tất.';
    if (task.staffId !== userId) return `Task hỗ trợ đang do ${task.staffName || 'nhân viên khác'} phụ trách.`;
    if (new Date(task.dueAt) <= new Date()) return 'Task hỗ trợ đã quá hạn 21:00. Cần Quản lý cơ sở gia hạn (PR-S4).';
    return null;
  }
  if (task.taskType !== 'CHECK_IN' && task.taskType !== 'CHECK_OUT') {
    return 'Trang này chỉ hỗ trợ lập biên bản cho task check-in, nghiệm thu check-out, hỗ trợ KH hoặc hoàn tiền.';
  }
  switch (task.status) {
    case 'OPEN': return 'Task chưa có người nhận. Hãy quay lại bảng công việc và bấm "Nhận việc" trước.';
    case 'OVERDUE': return 'Task đã quá hạn 21:00 ngày hẹn nên không thể lập biên bản. Vui lòng báo quản lý cơ sở.';
    case 'CANCELLED': return task.cancelReason ? `Task đã huỷ — ${task.cancelReason}.` : 'Task đã bị huỷ (khách không đến hoặc đã huỷ yêu cầu).';
    case 'COMPLETED': return null;
    default:
      if (task.staffId !== userId) return `Task đang do ${task.staffName || 'nhân viên khác'} phụ trách.`;
      if (new Date(task.dueAt) <= new Date()) return 'Task đã quá hạn 21:00 ngày hẹn nên không thể lập biên bản.';
      if (task.taskType === 'CHECK_IN' && task.dueAt && localTodayIso() < String(task.dueAt).slice(0, 10)) {
        const [y, m, d] = String(task.dueAt).slice(0, 10).split('-');
        return `Khách hẹn nhận kho ngày ${d}/${m}/${y}. Chưa được check-in trước ngày hẹn.`;
      }
      // UC-23 (góp ý test 13/11): chưa tới ngày khách hẹn trả kho thì chưa nghiệm thu (BE chặn CHECK_OUT_TOO_EARLY)
      // D-21: task kiểm tra lại quyết toán ([RECHECK]) làm được ngay, không theo ngày hẹn
      if (task.taskType === 'CHECK_OUT' && task.dueAt && !String(task.note || '').startsWith('[RECHECK]')) {
        const appointment = String(task.dueAt).slice(0, 10);
        if (localTodayIso() < appointment) {
          const [y, m, d] = appointment.split('-');
          return `Khách hẹn trả kho ngày ${d}/${m}/${y}. Chưa được nghiệm thu trước ngày hẹn.`;
        }
      }
      return null;
  }
}

function localTodayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function InfoRow({ label, value, mono, highlight }) {
  return (
    <div className="flex justify-between gap-3 py-2 border-b border-[#F0F0F0] last:border-0 text-xs">
      <span className="font-bold text-[#AFAFAF]">{label}</span>
      <span className={`font-black text-right ${highlight || 'text-[#4B4B4B]'} ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function InfoCard({ icon, title, children }) {
  return (
    <div className="duo-card p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-[20px] text-[#1CB0F6]">{icon}</span>
        <h2 className="text-sm font-black uppercase text-[#4B4B4B] tracking-wide">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function CodeBox({ icon, label, value, big }) {
  return (
    <div className="rounded-2xl border-2 border-b-4 border-[#84D8FF] bg-[#DDF4FF] p-4 flex flex-col items-center gap-1">
      <span className="text-[11px] font-black uppercase text-[#1899D6] flex items-center gap-1">
        <span className="material-symbols-outlined text-[16px]">{icon}</span>{label}
      </span>
      <span className={`font-mono font-black text-[#4B4B4B] break-all text-center ${big ? 'text-4xl tracking-[0.25em] whitespace-nowrap' : 'text-xl tracking-widest'}`}>
        {value || '—'}
      </span>
    </div>
  );
}

// UC-24: danh sách sự cố đã ghi nhận (chỉ đọc) — dùng ở biên bản nghiệm thu và phiếu bảo trì
function DamageCaseList({ cases, onPreview }) {
  return (
    <div className="flex flex-col gap-3">
      {cases.map((dc, idx) => {
        const liable = LIABLE_OPTIONS.find(o => o.value === dc.liableParty) || LIABLE_OPTIONS[0];
        return (
          <div key={dc.id || idx} className="rounded-2xl border-2 border-[#FFE8CC] bg-[#FFFDF9] p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-black text-[#4B4B4B]">
                #{idx + 1}. {dc.title}
              </span>
              <div className="flex flex-wrap justify-end gap-1.5">
                <span className={`duo-badge border text-[10px] whitespace-nowrap ${liable.cls}`}>
                  {liable.label} · {liable.hint}
                </span>
                <span className="duo-badge bg-[#FFDFDF] text-[#FF4B4B] border border-[#FF4B4B] text-xs whitespace-nowrap">
                  {formatCurrency(dc.estimatedCost)}
                </span>
              </div>
            </div>
            {dc.description && (
              <p className="text-xs font-bold text-[#777777]">{dc.description}</p>
            )}
            {dc.evidenceImages && dc.evidenceImages.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {dc.evidenceImages.map((imgUrl, imgIdx) => (
                  <button
                    key={imgIdx}
                    type="button"
                    onClick={() => onPreview(imgUrl)}
                    className="relative w-20 h-20 rounded-xl border-2 border-[#E5E5E5] overflow-hidden group cursor-pointer bg-white"
                    title="Bấm để phóng to ảnh bằng chứng"
                  >
                    <img src={imgUrl} alt={`Evidence ${imgIdx + 1}`} className="w-full h-full object-cover" />
                    <span className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <span className="material-symbols-outlined text-white text-[20px]">zoom_in</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// PR-O10: vì sao người đang xem chưa bấm "Sửa xong" được (null = được). FM đóng thẳng, không cần nhận việc.
function maintenanceBlockedReason(task, userId, isManager) {
  if (task.status === 'COMPLETED') return null;
  if (task.status === 'CANCELLED') return 'Task bảo trì đã bị huỷ.';
  if (isManager) return null;
  if (!task.staffId) {
    return task.status === 'OVERDUE'
      ? 'Task đã quá hạn và chưa ai nhận — báo Quản lý cơ sở hoàn tất hoặc bấm "Mở lại kho".'
      : 'Task chưa có người nhận. Hãy quay lại bảng công việc và bấm "Nhận việc" trước.';
  }
  if (task.staffId !== userId) return `Task bảo trì đang do ${task.staffName || 'nhân viên khác'} phụ trách.`;
  return null;
}

// PR-O10 / PR-Q9: phiếu bảo trì ô kho — sửa chữa sau trả kho có sự cố, hoặc dọn kho sau thanh lý
function MaintenancePanel({ task, userId, isManager, onCompleted, onPreview, onToast }) {
  const [note, setNote] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // PR-Q10 (sửa 05/11/2026): dọn kho sau thanh lý → kiểm kê hàng của khách, chuyển vào kho tổng (BR-134, không bán)
  const [noGoodsLeft, setNoGoodsLeft] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [inventoryNote, setInventoryNote] = useState('');
  const [witnessNote, setWitnessNote] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [inventoryImages, setInventoryImages] = useState([]);

  // Vấn đề 6 (22/11/2026): Staff báo cáo sửa kho kéo dài & yêu cầu FM chuyển HĐ của khách sang ô tiêu chuẩn khác
  const [transferReqReason, setTransferReqReason] = useState('');
  const [sendingTransferReq, setSendingTransferReq] = useState(false);
  const [fmTransferOpen, setFmTransferOpen] = useState(false);

  // Task cũ chưa có maintenanceReason: suy ra từ hợp đồng
  const isLiquidation = task.maintenanceReason === 'LIQUIDATION'
    || (!task.maintenanceReason && task.contractStatus === 'LIQUIDATED');
  const isFromSupport = Boolean(
    task.supportRequestId ||
    task.maintenanceReason === 'FACILITY_DAMAGE' ||
    task.note?.includes('Bảo trì chuyên sâu') ||
    task.note?.includes('Ticket #') ||
    task.note?.includes('SR-') ||
    task.title?.includes('[SR-')
  );
  const isContractActive = task.contractStatus === 'ACTIVE';

  useEffect(() => {
    if (!isLiquidation) return;
    getCentralWarehouses()
      .then(list => {
        const items = Array.isArray(list) ? list : [];
        setWarehouses(items);
        if (items.length === 1) setWarehouseId(String(items[0].id));
      })
      .catch(() => setWarehouses([]));
  }, [isLiquidation]);
  const doneLabel = isLiquidation ? 'Dọn xong' : 'Sửa xong';
  const blocked = maintenanceBlockedReason(task, userId, isManager);
  const noteValid = note.trim().length >= MAINTENANCE_NOTE_MIN && note.trim().length <= NOTES_MAX;
  const inventoryError = !isLiquidation || noGoodsLeft ? null
    : inventoryNote.trim().length < 10 ? 'Liệt kê hàng kiểm kê (tối thiểu 10 ký tự).'
    : !witnessNote.trim() ? 'Ghi rõ người mở kho / chứng kiến.'
    : !warehouseId ? 'Chọn kho tổng nhận hàng.'
    : !storageLocation.trim() ? 'Ghi rõ vị trí kệ trong kho tổng.'
    : inventoryImages.length === 0 ? 'Cần ít nhất 1 ảnh kiểm kê.'
    : null;

  const handleUploadInventory = (files) => {
    if (!files?.length) return;
    setUploading(true);
    Promise.all(Array.from(files).map(file => uploadImageFile(file).then(data => data.url)))
      .then(urls => setInventoryImages(prev => [...prev, ...urls]))
      .catch(err => onToast({ type: 'error', message: err.response?.data?.message || 'Không tải được ảnh kiểm kê.' }))
      .finally(() => setUploading(false));
  };

  const fillDemo = () => {
    if (isLiquidation) {
      setNote('Đã cùng Quản lý mở kho, kiểm kê, chụp ảnh, niêm phong hàng và chuyển vào kho tổng. Ô đã dọn sạch.');
      setNoGoodsLeft(false);
      setInventoryNote('12 thùng carton đồ gia dụng (đã niêm phong), 1 tủ lạnh mini, 2 xe đạp, 1 túi quần áo.');
      setWitnessNote('Nhân viên kho + Quản lý cơ sở, có đại diện tổ dân phố chứng kiến');
      setStorageLocation('Dãy B - kệ 3');
      if (!warehouseId && warehouses.length) setWarehouseId(String(warehouses[0].id));
      setInventoryImages([
        createMockEvidenceDataUrl('Kiểm kê hàng ô ' + (task.storageUnitId || '') + ' (1)'),
        createMockEvidenceDataUrl('Kiểm kê hàng ô ' + (task.storageUnitId || '') + ' (2)'),
      ]);
    } else {
      const lowerNote = String(task.note || '').toLowerCase();
      if (lowerNote.includes('thông gió') || lowerNote.includes('quạt')) {
        setNote('Đã thay cụm bạc đạn quạt thông gió, bổ sung mỡ chịu nhiệt và siết chặt ốc giảm chấn giá treo. Quạt chạy êm ái dưới 45dB, hệ thống thông gió hoạt động ổn định.');
      } else if (lowerNote.includes('đèn') || lowerNote.includes('chiếu sáng')) {
        setNote('Đã thay mới bộ đèn LED 1.2m Rạng Đông 18W chống ẩm và thay driver nguồn ổn áp. Ánh sáng khu vực ô kho đạt chuẩn, đấu nối an toàn tuyệt đối.');
      } else if (lowerNote.includes('cửa') || lowerNote.includes('ray')) {
        setNote('Đã nắn chỉnh thanh đáy cửa cuốn, làm sạch rãnh ray dẫn hướng và tra mỡ bôi trơn chuyên dụng. Cửa cuốn kéo lên hạ xuống êm ái, chốt đáy khít hoàn toàn.');
      } else if (lowerNote.includes('dột') || lowerNote.includes('thấm') || lowerNote.includes('nước')) {
        setNote('Đã siết chặt mối nối ống thoát nước ngưng điều hòa, dán keo chống thấm 3 lớp. Hiện trường khô ráo, tài sản ô kho được bảo vệ an toàn.');
      } else if (lowerNote.includes('ổ cắm') || lowerNote.includes('điện') || lowerNote.includes('công tắc')) {
        setNote('Đã thay mới cụm ổ cắm - công tắc âm tường chống cháy Panasonic 16A, đo kiểm tra điện áp 220V ổn định không có dòng rò.');
      } else {
        setNote('Đã kiểm tra, xử lý dứt điểm toàn bộ sự cố kỹ thuật tại hiện trường ô kho. Bàn giao an toàn, các thiết bị hoạt động ổn định.');
      }
    }
  };

  const handleUpload = (file) => {
    if (!file) return;
    setUploading(true);
    uploadImageFile(file)
      .then(data => setEvidenceUrl(data.url))
      .catch(err => onToast({ type: 'error', message: err.response?.data?.message || 'Không tải được ảnh lên.' }))
      .finally(() => setUploading(false));
  };

  const handleSubmit = () => {
    setSubmitting(true);
    const payload = { note: note.trim(), evidenceImageUrl: evidenceUrl || null };
    if (isLiquidation) {
      Object.assign(payload, noGoodsLeft
        ? { noGoodsLeft: true }
        : {
          inventoryNote: inventoryNote.trim(), witnessNote: witnessNote.trim(), storageLocation: storageLocation.trim(),
          centralWarehouseId: Number(warehouseId), inventoryImages,
        });
    }
    completeMaintenanceTask(task.id, payload)
      .then(data => {
        onCompleted(data);
        onToast({
          type: 'success',
          message: data.heldGoodsId
            ? `Đã dọn xong ô ${data.storageUnitId}. Hàng đã vào kho tổng — hồ sơ lưu giữ #${data.heldGoodsId}.`
            : isFromSupport
            ? `Đã hoàn tất bảo trì kỹ thuật cho ô ${data.storageUnitId}. Khách hàng tiếp tục sử dụng kho an toàn!`
            : `Đã hoàn tất bảo trì. Ô ${data.storageUnitId} sẵn sàng cho thuê.`,
        });
      })
      .catch(err => onToast({ type: 'error', message: err.response?.data?.message || 'Không hoàn tất được task bảo trì.' }))
      .finally(() => {
        setSubmitting(false);
        setConfirmOpen(false);
      });
  };

  return (
    <div className="duo-card p-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-[#4B4B4B]">Phiếu bảo trì ô kho</h2>
          <p className="text-xs font-bold text-[#AFAFAF]">
            Ô {task.storageUnitId} · HĐ {task.contractCode} — {
              isFromSupport
                ? (isContractActive ? 'Khắc phục sự cố kỹ thuật hạ tầng cho khách đang thuê.' : 'Hoàn tất bảo trì kỹ thuật cho ô kho.')
                : isLiquidation
                ? 'xong việc thì ô quay về "Sẵn sàng cho thuê".'
                : 'xong việc thì ô quay về "Sẵn sàng cho thuê".'
            }
          </p>
        </div>
        <span className={`duo-badge whitespace-nowrap border ${
          isLiquidation
            ? 'bg-[#F3E8FF] text-[#9333EA] border-[#C084FC]'
            : isFromSupport
            ? (isContractActive ? 'Bảo trì kỹ thuật hạ tầng (Khách đang thuê)' : 'Bảo trì kỹ thuật hạ tầng')
            : 'bg-[#FFE8CC] text-[#E58800] border-[#FF9600]'
        }`}>
          {isLiquidation
            ? 'Cưỡng chế dọn kho'
            : isFromSupport
            ? (isContractActive ? 'Bảo trì kỹ thuật hạ tầng (Khách đang thuê)' : 'Bảo trì kỹ thuật hạ tầng')
            : 'Sửa chữa sau trả kho'}
        </span>
      </div>

      {task.note && (
        <div className="rounded-2xl bg-[#F7F7F7] border-2 border-[#E5E5E5] p-4">
          <p className="text-[11px] font-black uppercase text-[#AFAFAF] mb-1">Yêu cầu công việc</p>
          <p className="text-xs font-bold text-[#4B4B4B] whitespace-pre-line break-words">{task.note}</p>
        </div>
      )}

      {isLiquidation && (
        <div className="rounded-2xl bg-[#FFF8E1] border-2 border-[#FFC800] p-4 flex flex-col gap-1.5">
          <p className="text-[11px] font-black uppercase text-[#B78900] flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">gavel</span>
            Quy trình theo Điều khoản xử lý tài sản
          </p>
          {[
            'Ít nhất 2 nhân sự cùng mở kho (Staff + Quản lý cơ sở).',
            'Kiểm kê, chụp ảnh toàn bộ hàng của khách, lập biên bản có chữ ký người chứng kiến.',
            'Hàng cấm / chất nguy hiểm / giấy tờ tuỳ thân: giao ngay công an hoặc UBND phường.',
            'Niêm phong, chuyển hàng vào KHO TỔNG — giữ tới khi khách nhận lại, không bán.',
          ].map(line => (
            <p key={line} className="text-xs font-bold text-[#4B4B4B] flex gap-1.5">
              <span className="text-[#B78900]">•</span>{line}
            </p>
          ))}
        </div>
      )}

      {task.damageCases?.length > 0 && (
        <div>
          <p className="text-sm font-black uppercase text-[#4B4B4B] tracking-wide mb-3">Sự cố cần khắc phục</p>
          <DamageCaseList cases={task.damageCases} onPreview={onPreview} />
        </div>
      )}

      {/* Vấn đề 6 (22/11/2026): Khi công việc sửa kho cần nhiều thời gian hơn (đặc biệt khi khách đang lưu tạm ở ô khẩn cấp),
          Staff yêu cầu FM chuyển hợp đồng của khách sang ô tiêu chuẩn khác; FM duyệt chuyển ô ngay tại đây */}
      {!isLiquidation && task.contractId && ['ACTIVE', 'PENDING_CHECK_IN', 'TERMINATION_PENDING', 'OVERDUE'].includes(task.contractStatus)
        && task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (() => {
          const alreadyRequested = typeof task.note === 'string' && task.note.includes('[YÊU CẦU FM ĐỔI KHO CHO KHÁCH');
          const alreadyTransferred = typeof task.note === 'string' && task.note.includes('[FM đã chuyển HĐ sang ô tiêu chuẩn');
          return (
            <div className="rounded-2xl border-2 border-[#FF9600] bg-[#FFF8EE] p-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[#E58800] text-[24px] shrink-0">swap_horiz</span>
                  <div>
                    <h3 className="text-xs font-black uppercase text-[#E58800]">
                      Điều phối ô kho cho khách khi bảo trì kéo dài (HĐ {task.contractCode})
                    </h3>
                    <p className="text-xs font-bold text-[#777777] mt-0.5">
                      {isManager
                        ? 'Nếu việc sửa kho cần nhiều thời gian hoặc khách đang lưu tạm tại ô khẩn cấp, Quản lý có thể chuyển hợp đồng của khách sang ô tiêu chuẩn khác đang trống.'
                        : 'Nếu phát hiện việc sửa chữa ô kho cần nhiều thời gian hơn (đặc biệt khi hàng của khách đang nằm tạm ở kho khẩn cấp), hãy gửi yêu cầu để Quản lý cơ sở (FM) chuyển khách sang ô tiêu chuẩn khác.'}
                    </p>
                  </div>
                </div>
                {alreadyTransferred ? (
                  <span className="duo-badge bg-[#D7FFB8] text-[#58A700] border border-[#58CC02] text-[10px]">
                    FM đã chuyển sang ô tiêu chuẩn
                  </span>
                ) : alreadyRequested ? (
                  <span className="duo-badge bg-[#FFF0D6] text-[#E58800] border border-[#FF9600] text-[10px]">
                    Chờ FM chuyển ô cho khách
                  </span>
                ) : null}
              </div>

              {isManager ? (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] font-bold text-[#4B4B4B]">
                    Ô hiện tại của HĐ {task.contractCode}: <strong className="font-mono">{task.storageUnitId || '—'}</strong> ({task.unitTypeName || '—'})
                  </span>
                  <button
                    type="button"
                    onClick={() => setFmTransferOpen(true)}
                    className="duo-btn-orange px-4 py-2 text-xs gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
                    Chuyển hợp đồng sang ô tiêu chuẩn khác
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={transferReqReason}
                    onChange={e => setTransferReqReason(e.target.value)}
                    placeholder="Mô tả tình trạng hư hỏng kéo dài & đề xuất FM chuyển sang kho khác (10–500 ký tự, VD: Thấm dột mái nghiêm trọng cần chống thấm 2 tuần, đề xuất FM chuyển HĐ sang ô tiêu chuẩn khác)..."
                    className="duo-input text-xs bg-white resize-none"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#AFAFAF]">
                      {transferReqReason.trim().length}/500 ký tự (tối thiểu 10)
                    </span>
                    <button
                      type="button"
                      disabled={sendingTransferReq || transferReqReason.trim().length < 10}
                      onClick={() => {
                        setSendingTransferReq(true);
                        requestMaintenanceUnitTransfer(task.id, { reason: transferReqReason.trim() })
                          .then(updated => {
                            onCompleted(updated);
                            setTransferReqReason('');
                            onToast({
                              type: 'success',
                              message: `Đã gửi yêu cầu Quản lý cơ sở chuyển kho cho HĐ ${task.contractCode}.`,
                            });
                          })
                          .catch(err => {
                            onToast({
                              type: 'error',
                              message: err.response?.data?.message || 'Không gửi được yêu cầu đổi kho.',
                            });
                          })
                          .finally(() => setSendingTransferReq(false));
                      }}
                      className="duo-btn-orange px-4 py-2 text-xs gap-1.5 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">send</span>
                      {sendingTransferReq ? 'Đang gửi...' : alreadyRequested ? 'Gửi bổ sung yêu cầu FM đổi kho' : 'Yêu cầu FM chuyển sang kho khác'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

      {task.status === 'COMPLETED' ? (
        <div className="rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] p-4 flex flex-col gap-2">
          <p className="text-sm font-black text-[#58A700] flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px]">verified</span>
            Đã hoàn tất lúc {formatDateTime(task.completedAt)} — ô kho đã sẵn sàng cho thuê
          </p>
          {task.heldGoodsId && (
            <p className="text-xs font-bold text-[#4B4B4B]">
              Hàng của khách đã chuyển vào kho tổng: hồ sơ lưu giữ #{task.heldGoodsId} (giữ tới khi khách nhận lại).
              {isManager && <> <Link to="/manager/held-goods" className="text-[#1CB0F6] font-black hover:underline">Xem hàng đang lưu giữ</Link></>}
            </p>
          )}
          {task.evidenceImageUrl && (
            <button type="button" onClick={() => onPreview(task.evidenceImageUrl)}
              className="w-28 h-28 rounded-xl border-2 border-[#58CC02] overflow-hidden bg-white cursor-pointer">
              <img src={task.evidenceImageUrl} alt="Ảnh sau bảo trì" className="w-full h-full object-cover" />
            </button>
          )}
        </div>
      ) : blocked ? (
        <div className="rounded-2xl border-2 border-dashed border-[#E5E5E5] p-6 flex flex-col items-center gap-2 text-center">
          <span className="material-symbols-outlined text-[#FF9600] text-[40px]">lock</span>
          <p className="text-sm font-black text-[#4B4B4B]">Chưa thể hoàn tất bảo trì</p>
          <p className="text-xs font-bold text-[#777777] max-w-[360px]">{blocked}</p>
        </div>
      ) : (
        <>
          {task.status === 'OVERDUE' && (
            <p className="rounded-xl bg-[#FFDFDF] border border-[#FF4B4B] px-4 py-2 text-xs font-bold text-[#EA2B2B]">
              Task đã quá hạn 21:00 {formatDateTime(task.dueAt)} — vẫn hoàn tất được, nhưng sẽ được ghi nhận là trễ.
            </p>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-[#777777]">Đã làm những gì? *</span>
              <button type="button"
                onClick={fillDemo}
                className="text-[11px] font-black text-[#1CB0F6] hover:underline cursor-pointer flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>Giả lập hoàn thiện
              </button>
            </span>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder={isLiquidation ? 'VD: Kiểm kê 12 thùng hàng, chuyển vào kho tổng, dọn sạch ô...' : 'VD: Thay vách ngăn, sửa khoá, vệ sinh ô...'}
              className="duo-input resize-none text-xs"
            />
            <span className={`text-[11px] font-bold self-end ${noteValid || !note ? 'text-[#AFAFAF]' : 'text-[#FF4B4B]'}`}>
              {note.trim().length}/{NOTES_MAX} (tối thiểu {MAINTENANCE_NOTE_MIN})
            </span>
          </label>

          {isLiquidation && (
            <div className="rounded-2xl border-2 border-[#C084FC] bg-[#FAF5FF] p-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-black uppercase text-[#9333EA] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">inventory_2</span>
                  Biên bản kiểm kê hàng của khách
                </p>
                <label className="flex items-center gap-2 text-xs font-bold text-[#4B4B4B] cursor-pointer">
                  <input type="checkbox" checked={noGoodsLeft} onChange={e => setNoGoodsLeft(e.target.checked)} className="w-4 h-4 accent-[#9333EA]" />
                  Ô trống, khách không để lại gì
                </label>
              </div>
              {!noGoodsLeft && (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-black uppercase text-[#777777]">Danh sách hàng *</span>
                    <textarea rows={3} maxLength={2000} value={inventoryNote} onChange={e => setInventoryNote(e.target.value)}
                      placeholder="VD: 12 thùng carton (đã niêm phong), 1 tủ lạnh mini, 2 xe đạp..." className="duo-input resize-none text-xs" />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-black uppercase text-[#777777]">Người mở kho / chứng kiến *</span>
                      <input type="text" maxLength={500} value={witnessNote} onChange={e => setWitnessNote(e.target.value)}
                        placeholder="Ít nhất 2 người" className="duo-input text-xs" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-black uppercase text-[#777777]">Kho tổng nhận hàng *</span>
                      <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className="duo-input text-xs">
                        <option value="">— Chọn kho tổng —</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="text-[11px] font-black uppercase text-[#777777]">Vị trí kệ trong kho tổng *</span>
                      <input type="text" maxLength={100} value={storageLocation} onChange={e => setStorageLocation(e.target.value)}
                        placeholder="VD: Dãy B - kệ 3" className="duo-input text-xs" />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {inventoryImages.map((url, idx) => (
                      <div key={idx} className="relative">
                        <button type="button" onClick={() => onPreview(url)}
                          className="w-16 h-16 rounded-xl border-2 border-[#E5E5E5] overflow-hidden bg-white cursor-pointer">
                          <img src={url} alt={`Kiểm kê ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                        <button type="button" onClick={() => setInventoryImages(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#FF4B4B] text-white text-[12px] font-black cursor-pointer leading-none">×</button>
                      </div>
                    ))}
                    <label className="duo-btn-white px-3 py-2 text-xs gap-1.5 cursor-pointer">
                      <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
                      Ảnh kiểm kê *
                      <input type="file" accept="image/*" multiple className="hidden" disabled={uploading}
                        onChange={e => { handleUploadInventory(e.target.files); e.target.value = ''; }} />
                    </label>
                  </div>
                  <p className="text-[11px] font-bold text-[#777777]">
                    Hoàn tất → lập hồ sơ hàng ở kho tổng (trang "Hàng ở kho tổng" của Quản lý cơ sở), giữ tới khi khách nhận lại.
                  </p>
                </>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-black uppercase text-[#777777]">Ảnh sau khi xong (không bắt buộc)</span>
            <div className="flex flex-wrap items-center gap-3">
              {evidenceUrl && (
                <button type="button" onClick={() => onPreview(evidenceUrl)}
                  className="w-20 h-20 rounded-xl border-2 border-[#E5E5E5] overflow-hidden bg-white cursor-pointer">
                  <img src={evidenceUrl} alt="Ảnh sau bảo trì" className="w-full h-full object-cover" />
                </button>
              )}
              <label className="duo-btn-white px-3.5 py-2 text-xs gap-1.5 cursor-pointer">
                <span className="material-symbols-outlined text-[18px]">{uploading ? 'hourglass_top' : 'add_a_photo'}</span>
                {uploading ? 'Đang tải...' : evidenceUrl ? 'Đổi ảnh' : 'Tải ảnh lên'}
                <input type="file" accept="image/*" className="hidden" disabled={uploading}
                  onChange={e => { handleUpload(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={!noteValid || Boolean(inventoryError) || uploading || submitting}
            className="duo-btn-green px-5 py-3 text-sm gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[20px]">task_alt</span>
            {isFromSupport && isContractActive
              ? `${doneLabel} — Hoàn tất bảo trì ô kho`
              : `${doneLabel} — mở lại ô cho thuê`}
          </button>
          {inventoryError && noteValid && (
            <p className="text-[11px] font-bold text-[#FF4B4B] text-center -mt-3">{inventoryError}</p>
          )}
        </>
      )}

      <TaskConfirmDialog
        open={confirmOpen}
        icon="build"
        title={`Xác nhận ${doneLabel.toLowerCase()}?`}
        message={
          isFromSupport && isContractActive
            ? `Task bảo trì #${task.id} sẽ đóng và sự cố kỹ thuật của ô ${task.storageUnitId} được ghi nhận hoàn tất cho khách hàng.`
            : `Task bảo trì #${task.id} sẽ đóng và ô ${task.storageUnitId} chuyển sang "Sẵn sàng cho thuê" (AVAILABLE).`
        }
        confirmLabel={doneLabel}
        submitting={submitting}
        onConfirm={handleSubmit}
        onCancel={() => setConfirmOpen(false)}
      />

      {fmTransferOpen && task.contractId && (
        <TransferUnitModal
          contract={{
            contractId: task.contractId,
            contractCode: task.contractCode,
            storageUnitId: task.storageUnitId,
            unitTypeName: task.unitTypeName,
            status: task.contractStatus,
            customerFullName: task.customerName,
          }}
          managerId={userId}
          onClose={() => setFmTransferOpen(false)}
          onDone={(res) => {
            setFmTransferOpen(false);
            getStaffTaskDetail(task.id).then(updated => onCompleted(updated)).catch(() => {});
            onToast({
              type: 'success',
              message: `Đã chuyển HĐ ${task.contractCode} sang ô ${res?.toUnitId || 'mới'} thành công!`,
            });
          }}
        />
      )}
    </div>
  );
}

function newDamageItem(defaultTitle = '', defaultCost = 0, defaultDesc = '', liableParty = 'CUSTOMER') {
  return {
    uid: Math.random().toString(36).slice(2, 9),
    title: defaultTitle,
    estimatedCost: defaultCost,
    description: defaultDesc,
    liableParty,
    evidenceImages: [],
    urlInput: '',
  };
}

export default function StaffTaskDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const userId = user.userId;
  const isManager = ['FACILITY_MANAGER', 'MANAGER', 'ADMIN'].includes(user.role);

  const [task, setTask] = useState(null);
  const [handover, setHandover] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // State cho Check-in (UC-18)
  const [checks, setChecks] = useState(EMPTY_CHECKIN_CHECKS);
  const [pin, setPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [rfid, setRfid] = useState('');
  const [notes, setNotes] = useState('');
  const [checkInEvidence, setCheckInEvidence] = useState({}); // multiple photos per item
  const [withdrawingCheckIn, setWithdrawingCheckIn] = useState(false);
  const [reopenNote, setReopenNote] = useState('');
  const [reopenPhotos, setReopenPhotos] = useState([]);
  const [blockerNote, setBlockerNote] = useState('');
  const [blockerType, setBlockerType] = useState('FACILITY_ISSUE');
  const [blockerPhotos, setBlockerPhotos] = useState([]);
  const [reportingBlocker, setReportingBlocker] = useState(false);
  const [managerGoodsValue, setManagerGoodsValue] = useState('');
  const [goodsValueAssessment, setGoodsValueAssessment] = useState('MATCHED');
  const [assessedGoodsValue, setAssessedGoodsValue] = useState('');
  const [goodsValueAssessmentNote, setGoodsValueAssessmentNote] = useState('');
  const [fmResolvedGoodsValue, setFmResolvedGoodsValue] = useState('');
  const [fmResolvedGoodsValueNote, setFmResolvedGoodsValueNote] = useState('');

  // State cho Check-out & Damage Cases (UC-23 & UC-24)
  const [coChecks, setCoChecks] = useState(INITIAL_CHECKOUT_CHECKS);
  const [damageCases, setDamageCases] = useState([]);
  const [coNotes, setCoNotes] = useState('');
  const [checkOutPhotos, setCheckOutPhotos] = useState([]); // BR-121
  const [previewImage, setPreviewImage] = useState(null);

  // State cho Refund (UC-25)
  const [evidenceImageUrl, setEvidenceImageUrl] = useState('');
  const [refundNotes, setRefundNotes] = useState('');
  const [copiedField, setCopiedField] = useState(null);

  // State cho Support (UC-27)
  const [resolutionNote, setResolutionNote] = useState('');
  const [inspectionImages, setInspectionImages] = useState([]); // BR-126
  const [preliminaryCause, setPreliminaryCause] = useState('');
  const [securityLockStatus, setSecurityLockStatus] = useState('INTACT');
  const [securityImages, setSecurityImages] = useState([]);
  const [repairStatus, setRepairStatus] = useState('FIXED');
  const [repairImages, setRepairImages] = useState([]);
  const [cleaningImages, setCleaningImages] = useState([]);
  const [confirmSupportOpen, setConfirmSupportOpen] = useState(false);
  const [incidentReportModalOpen, setIncidentReportModalOpen] = useState(false);
  const [editResolutionOpen, setEditResolutionOpen] = useState(false);
  const [editResolutionNote, setEditResolutionNote] = useState('');
  const [editResolutionImages, setEditResolutionImages] = useState([]);
  const [updatingResolution, setUpdatingResolution] = useState(false);
  const [reopenSupportOpen, setReopenSupportOpen] = useState(false);
  const [reopenSupportReason, setReopenSupportReason] = useState('');
  const [reopeningSupport, setReopeningSupport] = useState(false);
  const [pinResetting, setPinResetting] = useState(false);
  const [extendDueDate, setExtendDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [extendReason, setExtendReason] = useState('');
  const [extendingSupport, setExtendingSupport] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmRefundOpen, setConfirmRefundOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);

  const fetchPin = useCallback(() => {
    setPinLoading(true);
    return suggestAccessPin()
      .then(data => setPin(data.accessPinCode))
      .catch(err => setToast({ type: 'error', message: err.response?.data?.message || 'Không lấy được mã PIN.' }))
      .finally(() => setPinLoading(false));
  }, []);

  const loadTask = useCallback(() => {
    return getStaffTaskDetail(id, userId)
      .then(async data => {
        setTask(data);
        setLoadError('');
        if (data.taskType === 'CHECK_IN' && data.contractId) {
          const latestHandover = await getCheckInHandover(data.contractId);
          setHandover(latestHandover);
          if (latestHandover?.status === 'REJECTED') {
            setChecks(EMPTY_CHECKIN_CHECKS);
            setCheckInEvidence({});
          }
          const resolvedValue = latestHandover?.issueResolution?.resolvedGoodsValue;
          if (Number(resolvedValue) > 0) {
            setFmResolvedGoodsValue(String(resolvedValue));
            setFmResolvedGoodsValueNote(latestHandover.issueResolution.goodsValueResolutionNote || 'Giá trị đã được FM kết luận sau khi đối chiếu.');
            setGoodsValueAssessment('ADJUSTED');
            setAssessedGoodsValue(String(resolvedValue));
            setGoodsValueAssessmentNote(latestHandover.issueResolution.goodsValueResolutionNote || 'Giá trị đã được FM kết luận sau khi đối chiếu.');
          } else {
            setFmResolvedGoodsValue('');
            setFmResolvedGoodsValueNote('');
          }
        } else setHandover(null);
        if (data.taskType === 'CHECK_IN' && !blockedReason(data, userId) && data.status !== 'COMPLETED') {
          fetchPin();
        }
      })
      .catch(err => setLoadError(err.response?.data?.message || 'Không tải được công việc.'))
      .finally(() => setLoading(false));
  }, [id, userId, fetchPin]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  // ================== LOGIC CHECK-IN (UC-18) ==================
  const allCheckInChecked = CHECKIN_CHECKLIST.every(item => checks[item.key]);
  const allCheckInPhotos = CHECKIN_CHECKLIST.every(item => (checkInEvidence[item.key] || []).length > 0);
  const checkInPhotoCount = CHECKIN_CHECKLIST.reduce((count, item) => count + (checkInEvidence[item.key] || []).length, 0);
  const goodsValueAssessmentValid = goodsValueAssessment === 'MATCHED'
    ? Number(task?.declaredGoodsValue) > 0
    : Number(assessedGoodsValue) > 0 && Number(assessedGoodsValue) <= 10000000000
      && goodsValueAssessmentNote.trim().length >= 5;
  const canSubmitCheckIn = handover?.status === 'ACCEPTED'
    ? /^\d{6}$/.test(pin) && /^RFID-\d{5}$/.test(rfid) && !submitting
    : allCheckInChecked && allCheckInPhotos && checkInPhotoCount <= 10 && goodsValueAssessmentValid && notes.length <= NOTES_MAX && !submitting;

  const handleCheckInSubmit = () => {
    setSubmitting(true);
    (handover?.status === 'ACCEPTED'
      ? checkInStaffTask(task.id, userId, { approvalId: handover.id, accessPinCode: pin, rfidCardCode: rfid.trim() })
      : prepareCheckInHandover(task.id, {
          ...checks,
          notes,
          checklistEvidence: checkInEvidence,
          goodsValueAssessment,
          assessedGoodsValue: goodsValueAssessment === 'MATCHED' ? Number(task.declaredGoodsValue) : Number(assessedGoodsValue),
          goodsValueAssessmentNote: goodsValueAssessment === 'ADJUSTED' ? goodsValueAssessmentNote.trim() : undefined,
        }))
      .then(() => {
        loadTask();
        setToast({ type: 'success', message: handover?.status === 'ACCEPTED'
          ? 'Đã bàn giao ô và kích hoạt hợp đồng.'
          : 'Đã gửi biên bản nháp. Khách cần kiểm tra ô và xác nhận trên tài khoản của mình.' });
      })
      .catch(err => {
        const code = err.response?.data?.error;
        setToast({ type: 'error', message: err.response?.data?.message || 'Không lưu được biên bản, vui lòng thử lại.' });
        if (code === 'PIN_TAKEN') {
          fetchPin();
        } else if (code?.startsWith('TASK_') || code === 'CONTRACT_STATUS_INVALID') {
          loadTask();
        }
      })
      .finally(() => {
        setSubmitting(false);
        setConfirmOpen(false);
      });
  };

  // ================== LOGIC CHECK-OUT & DAMAGE CASES (UC-23 & UC-24) ==================
  // D-21 / PR-O22: task kiểm tra lại theo khiếu nại quyết toán — chỉ lập lại danh sách sự cố + kết quả kiểm tra
  const isRecheckTask = task?.taskType === 'CHECK_OUT' && String(task?.note || '').startsWith('[RECHECK]');
  const blockingPassed = isRecheckTask ||
    (coChecks.identityVerified && coChecks.unitEmpty && coChecks.customerSignatureConfirmed);
  const conditionFailed = !isRecheckTask && (!coChecks.unitClean || !coChecks.lockIntact);
  const showDamageSection = conditionFailed || damageCases.length > 0;

  // Khi bỏ chọn "Ô sạch" hoặc "Khoá nguyên vẹn", nếu chưa có mục sự cố nào thì tự tạo sẵn 1 mục gợi ý
  const handleToggleCoCondition = (key, checked) => {
    setCoChecks(prev => {
      const next = { ...prev, [key]: checked };
      const nextFailed = !next.unitClean || !next.lockIntact;
      if (!checked && damageCases.length === 0) {
        if (key === 'unitClean') {
          setDamageCases([newDamageItem('Phí vệ sinh rác thải tồn đọng trong kho', 150000, 'Khách để lại rác thải cần nhân viên dọn dẹp.')]);
        } else if (key === 'lockIntact') {
          setDamageCases([newDamageItem('Hư hỏng khoá SmartLock / vách kho', 350000, 'Khoá hoặc vách ngăn có dấu hiệu hư hại.')]);
        }
      } else if (!nextFailed && damageCases.length > 0) {
        // Giữ nguyên danh sách nếu người dùng đã nhập, họ có thể xoá tay nếu muốn
      }
      return next;
    });
  };

  const handleAddDamageItem = (preset) => {
    if (preset) {
      setDamageCases(prev => [...prev, newDamageItem(preset.title, preset.cost, preset.desc, preset.liableParty)]);
    } else {
      setDamageCases(prev => [...prev, newDamageItem('', 0, '')]);
    }
  };

  const handleRemoveDamageItem = (uid) => {
    setDamageCases(prev => prev.filter(item => item.uid !== uid));
  };

  const handleUpdateDamageField = (uid, field, value) => {
    setDamageCases(prev =>
      prev.map(item => (item.uid === uid ? { ...item, [field]: value } : item))
    );
  };

  const handleUploadEvidenceFiles = async (uid, fileList) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    try {
      const dataUrls = await Promise.all(files.map(file => compressImageToDataUrl(file)));
      setDamageCases(prev =>
        prev.map(item =>
          item.uid === uid
            ? { ...item, evidenceImages: [...item.evidenceImages, ...dataUrls] }
            : item
        )
      );
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể xử lý ảnh tải lên.' });
    }
  };

  const handleAddEvidenceUrl = (uid) => {
    setDamageCases(prev =>
      prev.map(item => {
        if (item.uid !== uid) return item;
        const url = (item.urlInput || '').trim();
        if (!url) return item;
        return {
          ...item,
          evidenceImages: [...item.evidenceImages, url],
          urlInput: '',
        };
      })
    );
  };

  const handleRemoveEvidenceImage = (uid, imgIdx) => {
    setDamageCases(prev =>
      prev.map(item =>
        item.uid === uid
          ? { ...item, evidenceImages: item.evidenceImages.filter((_, idx) => idx !== imgIdx) }
          : item
      )
    );
  };

  // Kiểm tra tính hợp lệ của từng mục sự cố (UC-24)
  const damageValidationError = (() => {
    if (conditionFailed && damageCases.length === 0) {
      return 'Ô kho không sạch hoặc khoá hư hỏng — bắt buộc thêm ít nhất 1 hạng mục sự cố .';
    }
    for (let i = 0; i < damageCases.length; i++) {
      const d = damageCases[i];
      if (!d.title || !d.title.trim()) {
        return `Sự cố #${i + 1}: Vui lòng nhập tên / hạng mục sự cố.`;
      }
      if (d.estimatedCost === '' || d.estimatedCost === null || Number(d.estimatedCost) < 0) {
        return `Sự cố #${i + 1}: Chi phí đền bù phải lớn hơn hoặc bằng 0.`;
      }
      if (!d.evidenceImages || d.evidenceImages.length === 0) {
        return `Sự cố #${i + 1} ("${d.title.trim()}"): Bắt buộc tải lên ít nhất 1 ảnh bằng chứng hiện trường.`;
      }
    }
    return null;
  })();

  // Quyết toán tài chính theo bộ Business Rules mới (PR-O2, PR-O11, PR-O14, PR-Q3)
  // UC-24: chỉ sự cố LỖI KHÁCH bị trừ vào cọc; lỗi cơ sở ghi nhận chi phí nội bộ
  const totalDamageCost = damageCases
    .filter(item => item.liableParty !== 'FACILITY')
    .reduce((sum, item) => sum + (Number(item.estimatedCost) || 0), 0);
  const facilityDamageCost = damageCases
    .filter(item => item.liableParty === 'FACILITY')
    .reduce((sum, item) => sum + (Number(item.estimatedCost) || 0), 0);
  const depositHeld = Number(task?.depositHeldAmount || 0);
  const basePrice = Number(task?.baseMonthlyPrice) || depositHeld;

  const todayStr = new Date().toISOString().slice(0, 10);
  const endDateStr = task?.contractEndDate || todayStr;
  const startDateStr = task?.contractStartDate || todayStr;

  // Tính số tháng của gói hợp đồng từ startDate -> endDate để luôn chính xác kể cả khi billing_cycle_months = 1
  const calcMonthsBetween = (s, e) => {
    if (!s || !e) return 1;
    const [y1, m1] = String(s).split('-').map(Number);
    const [y2, m2] = String(e).split('-').map(Number);
    const diff = (y2 - y1) * 12 + (m2 - m1);
    return diff > 0 ? diff : 1;
  };
  const cycleMonths = Math.max(Number(task?.cycleMonths) || 1, calcMonthsBetween(startDateStr, endDateStr));

  const isEarlyCheckout = endDateStr > todayStr;
  const isOverdueOrGrace = todayStr > endDateStr;

  // Tính tiền thuê kỳ hiện tại đã trả (ưu tiên số thực đóng từ Backend payment_transactions)
  let discountRate = 0;
  if (cycleMonths >= 12) discountRate = 0.15;
  else if (cycleMonths >= 6) discountRate = 0.10;
  else if (cycleMonths >= 3) discountRate = 0.05;

  const formulaRentPaid = Math.round(basePrice * cycleMonths * (1 - discountRate));
  const rentPaid = Number(task?.rentPaid) > 0 ? Number(task.rentPaid) : formulaRentPaid;

  // PR-O2: Số tháng đã dùng làm tròn lên
  let usedMonths = 0;
  let breakFee = 0;
  let estimatedEarlyRentRefund = 0;

  if (isEarlyCheckout) {
    const sDate = new Date(startDateStr);
    const nDate = new Date(todayStr);
    if (nDate > sDate) {
      let months = (nDate.getFullYear() - sDate.getFullYear()) * 12 + (nDate.getMonth() - sDate.getMonth());
      if (nDate.getDate() > sDate.getDate()) {
        months += 1;
      }
      usedMonths = Math.max(1, months);
    } else {
      usedMonths = 1;
    }
    breakFee = Number(task?.breakFee) > 0 ? Number(task.breakFee) : basePrice;
    const usedCost = basePrice * usedMonths;
    estimatedEarlyRentRefund = Number(task?.earlyRentRefund) > 0
      ? Number(task.earlyRentRefund)
      : Math.max(0, rentPaid - usedCost - breakFee);
  }

  // PR-Q3 & PR-Q14 (D-15 đã bỏ ân hạn 5 ngày): Phí phạt trễ hạn & phí chiếm dụng ô tính tới hôm nay
  const taskOverdueFee = getOverdueFeeBreakdown(task);
  let daysPast = 0;

  if (isOverdueOrGrace) {
    const eDate = new Date(endDateStr);
    const nDate = new Date(todayStr);
    const diffTime = Math.abs(nDate - eDate);
    daysPast = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  const hasBackendOverdueFee =
    task?.totalPenaltyFee != null || task?.lateFee != null || task?.overstayFee != null || task?.graceFee != null;
  const estimatedLateFee = hasBackendOverdueFee
    ? taskOverdueFee.lateFee
    : (isOverdueOrGrace && !taskOverdueFee.lateFeeWaived ? Math.round(depositHeld * Math.min(daysPast, 5) * 0.10) : 0);
  const estimatedOverstayFee = hasBackendOverdueFee ? taskOverdueFee.overstayFee : 0;
  const estimatedTotalPenalty = hasBackendOverdueFee
    ? taskOverdueFee.totalPenalty
    : (estimatedLateFee + estimatedOverstayFee);

  const totalDepositDeductions = totalDamageCost + estimatedTotalPenalty;
  const estimatedDepositRefund = Math.max(0, depositHeld - totalDepositDeductions);
  let estimatedExcessDebt = Math.max(0, totalDepositDeductions - depositHeld);

  let estimatedTotalRefund = estimatedDepositRefund + estimatedEarlyRentRefund;
  if (estimatedExcessDebt > 0) {
    if (estimatedEarlyRentRefund >= estimatedExcessDebt) {
      estimatedTotalRefund = estimatedEarlyRentRefund - estimatedExcessDebt;
      estimatedExcessDebt = 0;
    } else {
      estimatedExcessDebt -= estimatedEarlyRentRefund;
      estimatedTotalRefund = 0;
    }
  }

  const canSubmitCheckOut = isRecheckTask
    ? !damageValidationError && coNotes.trim().length >= 10 && coNotes.length <= NOTES_MAX && !submitting
    : blockingPassed && !damageValidationError && coNotes.length <= NOTES_MAX && checkOutPhotos.length > 0 && !submitting;

  const handleCheckOutSubmit = () => {
    setSubmitting(true);
    const payload = {
      ...coChecks,
      notes: coNotes,
      evidenceImages: checkOutPhotos,
      damageCases: damageCases.map(d => ({
        title: d.title.trim(),
        description: d.description?.trim() || '',
        estimatedCost: Number(d.estimatedCost) || 0,
        liableParty: d.liableParty,
        evidenceImages: d.evidenceImages,
      })),
    };

    checkOutStaffTask(task.id, userId, payload)
      .then(data => {
        setTask(data);
        setJustCompleted(true);
        setToast({
          type: 'success',
          message: isRecheckTask
            ? `Đã gửi kết quả kiểm tra lại. Khách sẽ nhận bảng quyết toán mới của hợp đồng ${data.contractCode}.`
            : `Nghiệm thu xong! Hợp đồng ${data.contractCode} chờ khách xác nhận quyết toán để kết thúc.`,
        });
      })
      .catch(err => {
        const code = err.response?.data?.error;
        setToast({
          type: 'error',
          message: err.response?.data?.message || 'Không lưu được biên bản nghiệm thu, vui lòng thử lại.',
        });
        if (code?.startsWith('TASK_') || code === 'CONTRACT_STATUS_INVALID') {
          loadTask();
        }
      })
      .finally(() => {
        setSubmitting(false);
        setConfirmOpen(false);
      });
  };

  const isRefund = task?.taskType === 'REFUND';
  const parsedRefund = isRefund ? parseRefundNote(task?.note) : null;

  const effectiveEarlyRentRefund = Number(task?.earlyRentRefund) > 0
    ? Number(task.earlyRentRefund)
    : (parsedRefund?.earlyRentRefundNum > 0 ? parsedRefund.earlyRentRefundNum : (isEarlyCheckout ? estimatedEarlyRentRefund : 0));

  const effectiveDepositRefund = task?.depositRefund != null
    ? Number(task.depositRefund)
    : Math.max(0, Number(task?.depositHeldAmount || 0) - Number(task?.totalDamageCost || 0));

  const calculatedSum = effectiveDepositRefund + effectiveEarlyRentRefund;
  const effectiveRefundAmount = Number(task?.refundAmount) > 0
    ? Number(task.refundAmount)
    : (calculatedSum > 0 ? calculatedSum : (parsedRefund?.refundAmountNum || 0));

  // Submit Refund (UC-25)
  const handleSubmitRefund = () => {
    if (!evidenceImageUrl.trim()) {
      setToast({ type: 'error', message: parsedRefund?.isCash
        ? 'Vui lòng tải ảnh phiếu chi có chữ ký nhận tiền của khách.'
        : 'Vui lòng tải lên ảnh chụp biên lai chuyển tiền trước khi xác nhận hoàn tiền.' });
      return;
    }
    if (task.receiptStatus === 'DISPUTED') {
      setToast({ type: 'error', message: 'Khách báo chưa nhận tiền — xử lý ở Bảng hoàn tiền (giao dịch đúng / chuyển bổ sung).' });
      return;
    }
    setSubmitting(true);
    const amount = effectiveRefundAmount > 0 ? effectiveRefundAmount : undefined;
    completeRefundTask(task.id, userId, {
      refundAmount: amount,
      paymentMethod: parsedRefund?.isCash ? 'CASH' : 'BANK_TRANSFER',
      bankTransactionCode: refundNotes.trim(),
      cashReceiptConfirmed: parsedRefund?.isCash ? true : undefined,
      evidenceImageUrl: evidenceImageUrl.trim(),
      notes: refundNotes.trim()
    })
      .then(data => {
        setTask(data);
        setJustCompleted(true);
        setToast({
          type: 'success',
          message: task.contractId
            ? 'Xác nhận hoàn tiền thành công! Hợp đồng đã kết thúc và khoang được giải phóng.'
            : 'Xác nhận hoàn tiền thành công! Trạng thái đơn đặt chỗ đã chuyển sang ĐÃ HOÀN TIỀN.'
        });
      })
      .catch(err => {
        setToast({ type: 'error', message: err.response?.data?.message || 'Không thể xác nhận hoàn tiền, vui lòng thử lại.' });
        loadTask();
      })
      .finally(() => {
        setSubmitting(false);
        setConfirmRefundOpen(false);
      });
  };

  // Sao chép nội dung (STK hoặc thông tin)
  const handleCopyText = (text, fieldName = 'all') => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  // ================== LOGIC HỖ TRỢ KHÁCH HÀNG (UC-27) ==================
  const isSupport = task?.taskType === 'SUPPORT';
  // BR-126: ticket hàng hư / mất → task hỗ trợ là kiểm tra hiện trường (bắt buộc ảnh + nguyên nhân sơ bộ)
  const claim = task?.claim;
  const isClaimInspection = isSupport && Boolean(claim);
  const canSubmitSupport =
    resolutionNote.trim().length >= (isClaimInspection ? 10 : 1) && resolutionNote.trim().length <= NOTES_MAX && !submitting
    && (!isClaimInspection || (inspectionImages.length > 0 && Boolean(preliminaryCause)))
    && (task?.issueType !== 'SECURITY' || (Boolean(securityLockStatus) && securityImages.length > 0))
    && (task?.issueType !== 'FACILITY_DAMAGE' || Boolean(repairStatus))
    && (task?.issueType !== 'CLEANING' || cleaningImages.length > 0);

  const handleResolveSupportSubmit = () => {
    setSubmitting(true);
    const resolvedImages = isClaimInspection
      ? inspectionImages
      : task.issueType === 'SECURITY'
      ? securityImages
      : task.issueType === 'FACILITY_DAMAGE'
      ? repairImages
      : task.issueType === 'CLEANING'
      ? cleaningImages
      : [];

    resolveSupportTask(task.id, userId, {
      resolutionNote: resolutionNote.trim(),
      inspectionImages: resolvedImages,
      ...(isClaimInspection ? { preliminaryCause } : {}),
      ...(task.issueType === 'SECURITY' ? { securityLockStatus } : {}),
      ...(task.issueType === 'FACILITY_DAMAGE' ? { repairStatus } : {}),
    })
      .then(data => {
        setTask(data);
        setJustCompleted(true);
        setToast({
          type: 'success',
          message: isClaimInspection
            ? `Đã lập biên bản kiểm tra hồ sơ ${claim.claimCode}. Quản lý cơ sở sẽ thẩm định và chốt bồi thường.`
            : repairStatus === 'ESCALATED_MAINTENANCE'
            ? `Đã xử lý ticket ${data.ticketCode || ''} & chuyển sang Bảo trì chuyên sâu (Task bảo trì mới đang ở cột Chờ nhận trên Bảng công việc).`
            : `Đã xử lý xong yêu cầu hỗ trợ ${data.ticketCode || ''}. Trạng thái phiếu chuyển sang Chờ khách xác nhận (RESOLVED).`,
        });
      })
      .catch(err => {
        const errorMsg = err.response?.data?.message
          || err.response?.data?.error
          || (err.response ? `Lỗi máy chủ (${err.response.status})` : 'Mất kết nối máy chủ (Backend port 8080 chưa chạy hoặc bị ngắt kết nối).');
        setToast({
          type: 'error',
          message: errorMsg,
        });
        loadTask();
      })
      .finally(() => {
        setSubmitting(false);
        setConfirmSupportOpen(false);
      });
  };

  const resolvedImagesForPreview = isClaimInspection
    ? inspectionImages
    : task?.issueType === 'SECURITY'
    ? securityImages
    : task?.issueType === 'FACILITY_DAMAGE'
    ? repairImages
    : task?.issueType === 'CLEANING'
    ? cleaningImages
    : [];

  const handleUpdateResolutionSubmit = () => {
    if (!editResolutionNote.trim()) return;
    setUpdatingResolution(true);
    updateSupportResolution(task.id, userId, {
      resolutionNote: editResolutionNote.trim(),
      inspectionImages: editResolutionImages,
    })
      .then(data => {
        setTask(data);
        setEditResolutionOpen(false);
        setToast({
          type: 'success',
          message: 'Đã cập nhật lại nội dung phản hồi cho khách hàng thành công!',
        });
      })
      .catch(err => {
        setToast({
          type: 'error',
          message: err.response?.data?.message || 'Không thể cập nhật phản hồi.',
        });
      })
      .finally(() => {
        setUpdatingResolution(false);
      });
  };

  const handleReopenSupportSubmit = () => {
    setReopeningSupport(true);
    reopenSupportTask(task.id, userId, reopenSupportReason.trim())
      .then(data => {
        setTask(data);
        setReopenSupportOpen(false);
        setJustCompleted(false);
        if (data.resolutionNote) {
          setResolutionNote(data.resolutionNote);
        }
        setToast({
          type: 'success',
          message: `Đã mở lại task #${task.id} thành công! Task quay về trạng thái Đang xử lý (IN_PROGRESS) để bạn thao tác lại.`,
        });
      })
      .catch(err => {
        setToast({
          type: 'error',
          message: err.response?.data?.message || 'Không thể mở lại task hỗ trợ.',
        });
      })
      .finally(() => {
        setReopeningSupport(false);
      });
  };

  const handleResetPinForLockIssue = () => {
    setPinResetting(true);
    resetSupportContractPin(task.id, userId)
      .then(data => {
        setTask(data);
        if (!resolutionNote.trim()) {
          setResolutionNote(
            `Đã cấp lại mã PIN SmartLock 6 số mới (${data.accessPinCode}) cho khách hàng và kiểm tra khoá hoạt động ổn định.`
          );
        }
        setToast({
          type: 'success',
          message: `Cấp lại mã PIN thành công! Mã PIN 6 số mới của hợp đồng ${data.contractCode} là: ${data.accessPinCode}.`,
        });
      })
      .catch(err => {
        setToast({
          type: 'error',
          message: err.response?.data?.message || 'Không thể cấp lại mã PIN cho hợp đồng này.',
        });
      })
      .finally(() => setPinResetting(false));
  };

  // Vấn đề 2 (22/11/2026): FM dời lịch nhận kho trực tiếp trên trang chi tiết task CHECK_IN quá hạn
  const [rescheduleCheckInDate, setRescheduleCheckInDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [rescheduleCheckInReason, setRescheduleCheckInReason] = useState('');
  const [reschedulingCheckIn, setReschedulingCheckIn] = useState(false);

  const handleRescheduleCheckInFromTask = async () => {
    if (!task?.reservationId || !rescheduleCheckInDate) return;
    setReschedulingCheckIn(true);
    try {
      await rescheduleReservation(task.reservationId, {
        newStartDate: rescheduleCheckInDate,
        reason: rescheduleCheckInReason.trim() || 'Dời lịch nhận kho từ task check-in quá hạn',
        managerId: userId,
      });
      setRescheduleCheckInReason('');
      await loadTask();
      setToast({
        type: 'success',
        message: `Đã dời lịch nhận kho đơn ${task.reservationCode || '#' + task.reservationId} sang ngày ${formatDate(rescheduleCheckInDate)}. Task đã được mở lại!`,
      });
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Không thể dời lịch nhận kho.',
      });
    } finally {
      setReschedulingCheckIn(false);
    }
  };

  const handleExtendSupportSubmit = () => {
    if (!extendDueDate || !extendReason.trim()) return;
    setExtendingSupport(true);
    extendOverdueTask(task.id, {
      newDueDate: extendDueDate,
      reason: extendReason.trim(),
    })
      .then(data => {
        setTask(data);
        setExtendReason('');
        setToast({
          type: 'success',
          message: `Đã gia hạn task #${data.id} đến 21:00 ngày ${formatDate(extendDueDate)}.`,
        });
      })
      .catch(err => {
        setToast({
          type: 'error',
          message: err.response?.data?.message || 'Không thể gia hạn task.',
        });
      })
      .finally(() => setExtendingSupport(false));
  };

  if (loading) {
    return (
      <div className="max-w-[1240px] mx-auto px-8 py-8">
        <div className="duo-card flex flex-col items-center justify-center py-16 gap-3">
          <span className="material-symbols-outlined text-[#58CC02] text-[36px] animate-spin">progress_activity</span>
          <span className="text-xs font-black uppercase text-[#AFAFAF]">Đang tải công việc...</span>
        </div>
      </div>
    );
  }

  if (loadError || !task) {
    const isRefundPath = location.pathname.startsWith('/manager/refunds');
    return (
      <div className="max-w-[1240px] mx-auto px-8 py-8">
        <div className="duo-card flex flex-col items-center justify-center py-16 gap-3 text-center">
          <span className="material-symbols-outlined text-[#FF4B4B] text-[40px]">error</span>
          <p className="text-sm font-black text-[#FF4B4B]">{loadError || 'Không tìm thấy công việc.'}</p>
          <Link
            to={isManager ? (isRefundPath ? "/manager/refunds" : "/manager/tasks") : "/staff"}
            className="duo-btn-gray px-5 py-2.5 text-xs"
          >
            {isRefundPath ? 'Về danh sách hoàn tiền' : 'Về bảng công việc'}
          </Link>
        </div>
      </div>
    );
  }

  const type = isRecheckTask
    ? { label: 'Kiểm tra lại', icon: 'manage_search', cls: 'bg-[#F3E8FF] text-[#9333EA] border-[#CE82FF]' }
    : TYPE_META[task.taskType] || { label: task.taskType, icon: 'task', cls: 'bg-[#F7F7F7] text-[#777777] border-[#E5E5E5]' };
  const checkInDisplayStatus = task.taskType === 'CHECK_IN' && task.status === 'IN_PROGRESS'
    ? handover?.status === 'PENDING_CUSTOMER' ? 'AWAITING_CUSTOMER'
      : handover?.status === 'REJECTED' ? 'BLOCKED_UNIT_ISSUE' : task.status
    : task.status;
  const status = isRefund && task.status === 'OPEN'
    ? { label: 'Chờ xử lý', cls: 'bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF]' }
    : (STATUS_META[checkInDisplayStatus] || { label: checkInDisplayStatus, cls: 'bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]' });
  const reason = blockedReason(task, userId) || (task.taskType === 'CHECK_IN' && task.status === 'IN_PROGRESS'
    ? handover?.status === 'PENDING_CUSTOMER' ? 'Đã gửi biên bản. Khách cần kiểm tra ô và xác nhận trên tài khoản.'
      : handover?.status === 'BLOCKED_FM' ? 'Vấn đề bàn giao đang chờ quản lý xử lý. Task check-in vẫn mở; chưa gửi biên bản mới.'
      : null
    : null);
  const record = task.handoverRecord;
  const isCheckOut = task.taskType === 'CHECK_OUT';
  const rejectedIssueTypes = handover?.rejectionTypes?.length ? handover.rejectionTypes : ['UNIT_CONDITION'];

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8">
      {/* Header breadcrumb */}
      <Link
        to={isManager ? (task.taskType === 'REFUND' || location.pathname.startsWith('/manager/refunds') ? "/manager/refunds" : "/manager/tasks") : "/staff"}
        className="inline-flex items-center gap-1 text-xs font-black uppercase text-[#AFAFAF] hover:text-[#1CB0F6] mb-4"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        {isManager ? (task.taskType === 'REFUND' || location.pathname.startsWith('/manager/refunds') ? "Quản lý hoàn tiền" : "Bảng công việc cơ sở") : "Bảng công việc nhân viên"}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 mb-6 border-b-2 border-[#E5E5E5]">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl border-2 border-b-4 flex items-center justify-center shrink-0 ${type.cls}`}>
            <span className="material-symbols-outlined text-[24px]">{type.icon}</span>
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#4B4B4B] tracking-tight">{type.label} · Task #{task.id}</h1>
            <p className="text-xs font-bold text-[#AFAFAF]">
              Hạn chót {formatDateTime(task.dueAt)}
              {task.staffName && <> · Phụ trách: <span className="text-[#4B4B4B] font-black">{task.staffName}</span></>}
            </p>
          </div>
        </div>
        <span className={`duo-badge whitespace-nowrap ${status.cls}`}>{status.label}</span>
      </div>

      {/* PR-T1: ngoài khung 30 ngày trước ngày hẹn → chưa giao / nhận được */}
      {task.status === 'OPEN' && assignLockedUntil(task) && (
        <div className="mb-6 flex items-start gap-2 rounded-2xl border-2 border-[#E5E5E5] bg-[#F7F7F7] px-4 py-3 text-xs font-bold text-[#777777]">
          <span className="material-symbols-outlined text-[20px] text-[#AFAFAF]">lock_clock</span>
          <span>Việc này chỉ giao / nhận được trong vòng 30 ngày trước ngày hẹn — mở từ <strong className="text-[#4B4B4B]">{assignLockedUntil(task)}</strong>.</span>
        </div>
      )}

      {/* Demo: tua thời gian cho task bàn giao chưa check-in (ẩn khi backend tắt giả lập) */}
      {task.taskType === 'CHECK_IN' && task.contractStatus === 'PENDING_CHECK_IN'
        && ['OPEN', 'IN_PROGRESS', 'OVERDUE'].includes(task.status) && (
        <div className="flex flex-wrap items-start gap-3 mb-6">
          <SimulationButton
            label="Khách tới hôm nay"
            description="Dời lịch hẹn của khách về hôm nay (hạn 21:00) để check-in ngay, không phải chờ đúng ngày hẹn."
            onRun={() => simulateArriveToday(task.id)}
            onDone={() => loadTask()}
          />
          {/* PR-T1: demo khung 30 ngày giao / nhận task — D-18: chỉ FM (người giao việc) thấy, Staff không */}
          {isManager && (
            <>
              <SimulationButton
                label="Hẹn còn 45 ngày (khoá giao việc)"
                description="Dời lịch hẹn nhận kho về 45 ngày nữa: task nằm ngoài khung 30 ngày nên FM chưa giao, Staff chưa nhận được."
                onRun={() => simulateAppointmentIn(task.id, 45)}
                onDone={() => loadTask()}
              />
              <SimulationButton
                label="Hẹn còn 30 ngày (mở giao việc)"
                description="Dời lịch hẹn nhận kho về đúng 30 ngày nữa: task vừa vào khung, FM giao / Staff nhận được."
                onRun={() => simulateAppointmentIn(task.id, 30)}
                onDone={() => loadTask()}
              />
            </>
          )}
          {isManager && task.reservationId && (
            <SimulationButton
              label="Khách bùng hẹn (đủ No-Show)"
              description="Lùi giờ hẹn 49 giờ và ghi 2 lần gọi khách thất bại cách nhau 25 giờ. Sau đó đơn hiện ở tab No-Show với nút huỷ đã bật."
              onRun={() => simulateNoShow(task.reservationId)}
              onDone={() => loadTask()}
            />
          )}
        </div>
      )}

      {/* Demo: task hỗ trợ / bảo trì quá hạn ngay → FM thấy nút "Gia hạn xử lý" trên bảng công việc (PR-S4) */}
      {isManager && ['SUPPORT', 'MAINTENANCE'].includes(task.taskType)
        && ['OPEN', 'IN_PROGRESS'].includes(task.status) && (
        <div className="flex flex-wrap items-start gap-3 mb-6">
          <SimulationButton
            label="Task quá hạn ngay"
            description="Lùi hạn xử lý của task về 1 phút trước và chạy ngay job đánh quá hạn (FM + nhân viên giữ task nhận thông báo). Sau đó dùng nút Gia hạn xử lý trên bảng công việc."
            onRun={() => simulateTaskOverdue(task.id)}
            onDone={() => navigate(`/manager/tasks?highlightTaskId=${task.id}`)}
          />
        </div>
      )}

      {/* Demo: khách tới trả kho hôm nay / khách không tới trả kho (task nghiệm thu đang mở) */}
      {task.taskType === 'CHECK_OUT' && task.contractStatus === 'TERMINATION_PENDING'
        && ['OPEN', 'IN_PROGRESS', 'OVERDUE'].includes(task.status) && (
        <div className="flex flex-wrap items-start gap-3 mb-6">
          <SimulationButton
            label="Khách tới trả kho hôm nay"
            description="Dời ngày hẹn trả kho về hôm nay (hạn 21:00) để nghiệm thu ngay, không phải chờ đúng ngày hẹn."
            onRun={() => simulateCheckoutToday(task.id)}
            onDone={() => loadTask()}
          />
          {isManager && task.contractId && (
            <SimulationButton
              label="Khách không tới trả kho (31 ngày)"
              description="Qua ngày hẹn trả kho mà khách không tới: hợp đồng chuyển QUÁ HẠN 31 ngày (phí trễ chạm trần 50% cọc), huỷ task nghiệm thu. Sau đó vào màn Hợp đồng quá hạn để liên hệ và cưỡng chế dọn kho."
              onRun={() => simulateOverdue(task.contractId, 31)}
              onDone={() => navigate('/manager/overdue')}
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)] gap-6 items-start">
        {/* Cột trái: thông tin khách, ô kho, hợp đồng */}
        <div className="flex flex-col gap-4">
          <InfoCard icon="person" title="Khách hàng">
            <InfoRow label="Họ tên" value={task.customerName} />
            <InfoRow label="Số điện thoại" value={task.customerPhone} />
            <InfoRow label="Số CCCD" value={task.customerCccd || 'Chưa cập nhật'} mono />
            <InfoRow label="Email" value={task.customerEmail} />
          </InfoCard>
          <InfoCard icon="warehouse" title="Ô kho">
            <InfoRow label="Mã ô" value={task.storageUnitId} mono />
            <InfoRow label="Loại ô" value={task.unitTypeName} />
            <InfoRow label="Trạng thái ô" value={UNIT_STATUS_LABEL[task.storageUnitStatus] || task.storageUnitStatus} />
            <InfoRow label="Cơ sở" value={task.facilityName} />
          </InfoCard>

          {/* UC-06: vị trí ô trên mặt bằng để tới check-in / nghiệm thu / hỗ trợ nhanh hơn */}
          {task.contractId && (
            <InfoCard icon="map" title="Vị trí ô trên mặt bằng">
              <div className="mt-2">
                <UnitLocationMap contractId={task.contractId} viewer="staff" />
              </div>
            </InfoCard>
          )}

          {task.contractCode ? (
            <InfoCard icon="description" title="Hợp đồng">
              <InfoRow
                label="Mã hợp đồng"
                value={isManager && task.contractId
                  ? <Link to={`/manager/contracts/${task.contractId}`} className="text-[#1CB0F6] hover:underline">{task.contractCode}</Link>
                  : task.contractCode}
                mono
              />
              <InfoRow label="Trạng thái" value={CONTRACT_STATUS_LABEL[task.contractStatus] || task.contractStatus} />
              <InfoRow label="Ngày bắt đầu" value={formatDate(task.contractStartDate)} />
              <InfoRow label="Ngày kết thúc" value={formatDate(task.contractEndDate)} />
              {isSupport && (
                <InfoRow
                  label="Mã PIN SmartLock hiện tại"
                  value={task.accessPinCode || 'Chưa cấp'}
                  mono
                  highlight="text-[#D97706]"
                />
              )}
              <InfoRow
                label="Tiền cọc hợp đồng"
                value={formatCurrency(task.depositHeldAmount)}
                highlight="text-[#1CB0F6]"
              />
            </InfoCard>
          ) : (
            <InfoCard icon="inventory_2" title="Đối tượng">
              <InfoRow label="Loại việc" value={parsedRefund?.isNoShow ? "Hoàn tiền No-Show" : "Hoàn tiền đơn đặt chỗ (Hủy đơn)"} />
              <InfoRow label="Mã đơn đặt" value={task.reservationCode || parsedRefund?.orderCode} mono />
              {task.unitTypeName && <InfoRow label="Loại khoang" value={task.unitTypeName} />}
              <InfoRow label="Cơ sở" value={task.facilityName || 'Cơ sở hiện tại'} />
            </InfoCard>
          )}

          {task.taskType === 'REFUND' ? (
            <InfoCard icon="notes" title="Lý do hoàn tiền & Ghi chú">
              <div className="flex flex-col gap-3">
                <div className="rounded-xl bg-[#F7F7F7] p-3.5 border border-[#E5E5E5] text-xs font-bold text-[#4B4B4B] leading-relaxed">
                  <span className="text-[11px] font-black uppercase text-[#AFAFAF] block mb-1">{parsedRefund?.isNoShow ? "Lý do No-Show" : "Lý do từ khách hàng"}</span>
                  <p className="text-sm font-black text-[#4B4B4B]">
                    {parsedRefund?.reason || 'Khách yêu cầu trả kho / hoàn tiền.'}
                  </p>
                </div>

                {/* BẢNG CHÍNH SÁCH HOÀN TIỀN & KHẤU TRỪ */}
                <div className={`rounded-xl p-3.5 border-2 flex flex-col gap-2.5 ${
                  (parsedRefund?.isPenalty50 || parsedRefund?.isDamagePenalty)
                    ? 'bg-[#FFF5F5] border-[#FEB2B2]'
                    : 'bg-[#F2FBF2] border-[#9AE6B4]'
                }`}>
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                    <span className={`text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5 ${
                      (parsedRefund?.isPenalty50 || parsedRefund?.isDamagePenalty) ? 'text-[#C53030]' : 'text-[#22543D]'
                    }`}>
                      <span className="material-symbols-outlined text-[18px]">
                        {(parsedRefund?.isPenalty50 || parsedRefund?.isDamagePenalty) ? 'warning' : 'verified_user'}
                      </span>
                      Chính sách hoàn tiền &amp; khấu trừ
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                      (parsedRefund?.isPenalty50 || parsedRefund?.isDamagePenalty)
                        ? 'bg-[#FED7D7] text-[#C53030] border-[#FEB2B2]'
                        : 'bg-[#C6F6D5] text-[#22543D] border-[#9AE6B4]'
                    }`}>
                      {parsedRefund?.policyBadge || (parsedRefund?.isPenalty50 ? 'Khấu trừ 50% tiền cọc' : 'Hoàn 100%')}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5 text-xs">
                    {parsedRefund?.isNoShow ? (
                      <>
                        <div className="flex justify-between py-0.5"><span>Tổng tiền khách đã đóng:</span><strong>{parsedRefund.originalTotal}</strong></div>
                        {!parsedRefund.noShowWaived && <div className="flex justify-between py-0.5"><span>Giữ cọc + 1 tháng thuê:</span><strong>{parsedRefund.noShowKeptAmount}</strong></div>}
                        <div className="flex justify-between py-0.5"><span>Chính sách áp dụng:</span><strong>{parsedRefund.policyApplied}</strong></div>
                      </>
                    ) : (<>
                    {(Number(task.depositHeldAmount) > 0 || parsedRefund?.originalTotal) && (
                      <div className="flex justify-between py-0.5">
                        <span className="font-bold text-[#718096]">
                          {task.contractCode || parsedRefund?.isCheckout ? 'Tiền cọc giữ chỗ ban đầu:' : 'Tổng tiền khách đã đóng:'}
                        </span>
                        <span className="font-black text-[#2D3748]">
                          {Number(task.depositHeldAmount) > 0 ? formatCurrency(task.depositHeldAmount) : parsedRefund?.originalTotal}
                        </span>
                      </div>
                    )}

                    {parsedRefund?.isPenalty50 ? (
                      <div className="flex justify-between items-center py-0.5">
                        <span className="font-bold text-[#718096] flex items-center gap-1">
                          Khấu trừ tiền cọc:
                          <span className="text-[10px] font-semibold text-[#E53E3E]">(hủy đơn trễ trong 24h trước thời điểm nhận kho)</span>
                        </span>
                        <span className="font-black text-[#E53E3E]">
                          - {parsedRefund.penaltyAmount}
                        </span>
                      </div>
                    ) : (
                      <>
                        {(Number(task.totalDamageCost) > 0 || parsedRefund?.penaltyAmountNum > 0) && (
                          <div className="flex justify-between items-center py-0.5">
                            <span className="font-bold text-[#718096]">Khấu trừ hư hại khoang:</span>
                            <span className="font-black text-[#E53E3E]">
                              - {Number(task.totalDamageCost) > 0 ? formatCurrency(task.totalDamageCost) : parsedRefund?.penaltyAmount}
                            </span>
                          </div>
                        )}
                        {parsedRefund?.totalPenaltyNum > 0 && (
                          <div className="space-y-0.5 py-0.5">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-[#718096]">
                                Khấu trừ tổng tiền phạt quá hạn {parsedRefund.overdueDays ? `(${parsedRefund.overdueDays} ngày):` : ':'}
                              </span>
                              <span className="font-black text-[#E53E3E]">
                                - {parsedRefund.totalPenalty}
                              </span>
                            </div>
                            <div className="pl-3 space-y-0.5 text-[11px] text-[#718096]">
                              {parsedRefund.lateFeeNum > 0 && (
                                <div className="flex justify-between items-center">
                                  <span>• Phí phạt trễ hạn:</span>
                                  <span className="font-bold text-[#E53E3E]">- {parsedRefund.lateFee}</span>
                                </div>
                              )}
                              {parsedRefund.overstayFeeNum > 0 && (
                                <div className="flex justify-between items-center">
                                  <span>• Phí chiếm dụng ô:</span>
                                  <span className="font-bold text-[#E53E3E]">- {parsedRefund.overstayFee}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {effectiveEarlyRentRefund > 0 && (
                          <div className="flex justify-between items-center py-0.5 bg-[#EAFBE0] px-2 rounded-lg border border-[#9AE6B4]">
                            <span className="font-bold text-[#22543D]">Hoàn tiền thuê trả sớm (PR-O2):</span>
                            <span className="font-black text-[#2F855A]">
                              + {formatCurrency(effectiveEarlyRentRefund)}
                            </span>
                          </div>
                        )}
                        {!parsedRefund?.penaltyAmountNum && !parsedRefund?.totalPenaltyNum && !(Number(task.totalDamageCost) > 0) && (
                          <div className="flex justify-between items-center py-0.5">
                            <span className="font-bold text-[#718096]">Chính sách áp dụng:</span>
                            <span className="font-black text-[#2F855A]">
                              {parsedRefund?.policyApplied || (task.contractCode || parsedRefund?.isCheckout ? 'Khoang bàn giao nguyên vẹn (Hoàn 100% cọc)' : 'Khách hủy đơn sớm trước 24h so với thời điểm nhận kho (hoàn 100%)')}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    </>)}

                    <div className="pt-2 mt-1 border-t-2 border-dashed border-[#CBD5E0] flex justify-between items-baseline">
                      <span className="text-xs font-black uppercase tracking-wider text-[#2D3748]">
                        Số tiền thực tế hoàn trả:
                      </span>
                      <span className="text-xl font-black text-[#2F855A]">
                        {effectiveRefundAmount > 0 ? formatCurrency(effectiveRefundAmount) : (parsedRefund?.refundAmount || '—')}
                      </span>
                    </div>

                    <p className="text-[10px] text-[#A0AEC0] italic mt-0.5">
                      {parsedRefund?.footerNote || (task.contractCode || parsedRefund?.isCheckout
                        ? '* Tổng tiền hoàn bao gồm tiền cọc hợp đồng và tiền thuê các tháng còn lại sau khi trừ thời gian đã dùng & phí phạt trả sớm (PR-O2).'
                        : '* Khách hủy đơn sớm trước 24h so với thời điểm nhận kho được hoàn trả 100% tiền cọc.')}
                    </p>
                  </div>
                </div>
              </div>
            </InfoCard>
          ) : task.note ? (
            <InfoCard icon="sticky_note_2" title="Ghi chú">
              <div className="rounded-xl bg-[#F7F7F7] p-3 border border-[#E5E5E5] text-xs font-bold text-[#4B4B4B] leading-relaxed whitespace-pre-line">
                {task.note}
              </div>
            </InfoCard>
          ) : null}
        </div>

        {/* Cột phải: Hoàn tiền (UC-25), Nghiệm thu trả kho & Sự cố (UC-23/24), hoặc Check-in (UC-18) */}
        <div className="flex flex-col gap-4">
          {isRefund ? (
            /* ================== MÀN HÌNH XỬ LÝ HOÀN TIỀN (REFUND - UC-25) ================== */
            <div className="duo-card p-6 flex flex-col gap-5">
              {task.status === 'COMPLETED' ? (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center gap-3 rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] p-4">
                    <span className="material-symbols-outlined text-[32px] text-[#58A700]">verified</span>
                    <div>
                      <p className="text-sm font-black text-[#58A700]">Đã hoàn tất hoàn tiền cho khách hàng!</p>
                      <p className="text-xs font-bold text-[#58A700]">
                        Khoản tiền hoàn trả đã được ghi nhận thành công vào hệ thống.
                      </p>
                    </div>
                  </div>

                  {/* Thông tin tài khoản thụ hưởng & số tiền đã hoàn */}
                  <div className="rounded-2xl border-2 border-[#84D8FF] bg-[#F0F9FF] p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-[#BAE6FD] pb-2.5">
                      <span className="text-xs font-black uppercase text-[#0284C7] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[18px]">account_balance</span>
                        Thông tin thụ hưởng &amp; Số tiền đã hoàn trả
                      </span>
                      <span className="duo-badge bg-[#D7FFB8] text-[#58A700] border border-[#58CC02] text-[10px]">
                        {task.settlementRefund && task.settlementRefund.settlementStatus !== 'COMPLETED' ? 'Đã chi · chờ khách nhận' : 'Đã chi tiền'}
                      </span>
                    </div>

                    {parsedRefund?.isCash ? (
                      <div className="flex justify-between text-xs py-1">
                        <span className="font-bold text-[#64748B]">Hình thức nhận tiền:</span>
                        <span className="font-black text-[#0F172A]">Nhận tiền mặt trực tiếp tại quầy cơ sở</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between text-xs py-0.5">
                          <span className="font-bold text-[#64748B]">Ngân hàng:</span>
                          <span className="font-black text-[#0F172A]">{parsedRefund?.bankName || '—'}</span>
                        </div>
                        <div className="flex justify-between text-xs py-0.5">
                          <span className="font-bold text-[#64748B]">Số tài khoản:</span>
                          <span className="font-mono font-black text-[#0284C7] text-sm">{parsedRefund?.accountNumber || '—'}</span>
                        </div>
                        <div className="flex justify-between text-xs py-0.5">
                          <span className="font-bold text-[#64748B]">Chủ tài khoản:</span>
                          <span className="font-black text-[#0F172A] uppercase">{parsedRefund?.accountHolder || task.customerName || '—'}</span>
                        </div>
                      </>
                    )}

                    <div className="border-t border-[#BAE6FD] pt-3 mt-1 flex flex-col gap-1.5">
                      {task.settlementRefund ? (
                        <SettlementRefundRows split={task.settlementRefund} isManager={isManager} />
                      ) : (
                        <>
                          {(task.contractCode || parsedRefund?.isCheckout) && (
                            <div className="flex justify-between text-xs text-[#475569]">
                              <span className="font-bold">• Tiền cọc hợp đồng hoàn lại:</span>
                              <span className="font-black">{formatCurrency(effectiveDepositRefund)}</span>
                            </div>
                          )}
                          {effectiveEarlyRentRefund > 0 && (
                            <div className="flex justify-between text-xs text-[#15803D] bg-[#DCFCE7] px-2.5 py-1.5 rounded-xl border border-[#86EFAC]">
                              <span className="font-bold">• Hoàn tiền thuê các tháng còn lại (PR-O2):</span>
                              <span className="font-black">+ {formatCurrency(effectiveEarlyRentRefund)}</span>
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex justify-between items-baseline pt-1">
                        <span className="text-xs font-black uppercase text-[#0284C7]">Tổng số tiền đã hoàn trả:</span>
                        <span className="text-2xl font-black text-[#16A34A]">
                          {effectiveRefundAmount > 0 ? formatCurrency(effectiveRefundAmount) : (parsedRefund?.refundAmount || '—')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ghi chú & Chứng từ xác nhận của Quản lý */}
                  {(parsedRefund?.managerNote || parsedRefund?.evidenceUrl) && (
                    <div className="rounded-2xl bg-[#F8FAFC] border-2 border-[#E2E8F0] p-4 flex flex-col gap-2.5 text-xs">
                      <span className="text-[11px] font-black uppercase text-[#64748B] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-[#0284C7]">receipt_long</span>
                        Chứng từ &amp; Ghi chú xác nhận từ Quản lý
                      </span>
                      {parsedRefund?.managerNote && (
                        <p className="font-bold text-[#334155] whitespace-pre-line">{parsedRefund.managerNote}</p>
                      )}
                      {parsedRefund?.evidenceUrl && (
                        <div className="pt-1">
                          <img
                            src={parsedRefund.evidenceUrl}
                            alt="Biên lai hoàn tiền"
                            onClick={() => setPreviewImage(parsedRefund.evidenceUrl)}
                            className="max-h-48 rounded-xl border-2 border-[#CBD5E1] object-contain cursor-pointer bg-white"
                            title="Bấm để phóng to ảnh biên lai"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <Link
                    to={isManager ? "/manager/refunds" : "/staff"}
                    className="duo-btn-gray px-5 py-2.5 text-xs self-end"
                  >
                    Về danh sách hoàn tiền
                  </Link>
                </div>
              ) : reason ? (
                <div className="duo-card p-6 flex flex-col items-center justify-center gap-3 text-center py-12">
                  <span className="material-symbols-outlined text-[#FF9600] text-[40px]">lock</span>
                  <p className="text-sm font-black text-[#4B4B4B]">Không thể xử lý hoàn tiền</p>
                  <p className="text-xs font-bold text-[#777777] max-w-[360px]">{reason}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  <div>
                    <h2 className="text-lg font-black text-[#4B4B4B]">Xác nhận hoàn tiền cho khách hàng</h2>
                    <p className="text-xs font-bold text-[#AFAFAF]">
                      Kiểm tra thông tin tài khoản thụ hưởng bên dưới và bấm xác nhận sau khi đã chuyển khoản hoàn tiền.
                    </p>
                  </div>

                  {/* Thông tin tài khoản ngân hàng của khách */}
                  <div className="rounded-2xl border-2 border-[#84D8FF] bg-[#F0F9FF] p-5 flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#BAE6FD] pb-2.5">
                      <span className="text-xs font-black uppercase text-[#0284C7] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[18px]">account_balance</span>
                        Thông tin thụ hưởng của khách hàng
                      </span>
                      {!parsedRefund?.isCash && (parsedRefund?.bankName || parsedRefund?.accountNumber) && (
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(
                              `${parsedRefund?.bankName || ''} - STK: ${parsedRefund?.accountNumber || ''} - ${parsedRefund?.accountHolder || ''} - Số tiền: ${effectiveRefundAmount > 0 ? formatCurrency(effectiveRefundAmount) : (parsedRefund?.refundAmount || '')}`,
                              'all'
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-white border border-[#7DD3FC] text-[11px] font-black text-[#0284C7] hover:bg-[#E0F2FE] flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {copiedField === 'all' ? 'check' : 'content_copy'}
                          </span>
                          {copiedField === 'all' ? 'Đã sao chép!' : 'Sao chép toàn bộ'}
                        </button>
                      )}
                    </div>

                    {parsedRefund?.isCash ? (
                      <div className="flex items-center gap-2.5 py-2 text-xs font-black text-[#0F172A]">
                        <span className="material-symbols-outlined text-[20px] text-[#0284C7]">payments</span>
                        Khách đăng ký nhận tiền mặt trực tiếp tại quầy cơ sở
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 text-xs">
                        <div className="flex justify-between items-center py-0.5">
                          <span className="font-bold text-[#64748B]">Ngân hàng:</span>
                          <span className="font-black text-[#0F172A]">{parsedRefund?.bankName || '—'}</span>
                        </div>
                        <div className="flex justify-between items-center py-0.5">
                          <span className="font-bold text-[#64748B]">Số tài khoản:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-[#0284C7]">
                              {parsedRefund?.accountNumber || '—'}
                            </span>
                            {parsedRefund?.accountNumber && (
                              <button
                                type="button"
                                onClick={() => handleCopyText(parsedRefund.accountNumber, 'stk')}
                                className="px-2 py-0.5 rounded-md bg-white border border-[#BAE6FD] text-[10px] font-black text-[#0284C7] hover:bg-[#E0F2FE] cursor-pointer"
                              >
                                {copiedField === 'stk' ? 'Đã chép' : 'Copy STK'}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between items-center py-0.5">
                          <span className="font-bold text-[#64748B]">Chủ tài khoản:</span>
                          <span className="font-black text-[#0F172A] uppercase">
                            {parsedRefund?.accountHolder || task.customerName || '—'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Tổng tiền cần chuyển */}
                    <div className="border-t border-[#BAE6FD] pt-3 mt-1 flex flex-col gap-1.5">
                      {task.settlementRefund ? (
                        <SettlementRefundRows split={task.settlementRefund} isManager={isManager} />
                      ) : (
                        <>
                          {(task.contractCode || parsedRefund?.isCheckout) && (
                            <div className="flex justify-between text-xs text-[#475569]">
                              <span className="font-bold">• Tiền cọc hợp đồng hoàn lại:</span>
                              <span className="font-black">{formatCurrency(effectiveDepositRefund)}</span>
                            </div>
                          )}
                          {effectiveEarlyRentRefund > 0 && (
                            <div className="flex justify-between text-xs text-[#15803D] bg-[#DCFCE7] px-2.5 py-1.5 rounded-xl border border-[#86EFAC]">
                              <span className="font-bold">• Hoàn tiền thuê các tháng còn lại (PR-O2):</span>
                              <span className="font-black">+ {formatCurrency(effectiveEarlyRentRefund)}</span>
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex justify-between items-baseline pt-1">
                        <span className="text-xs font-black uppercase text-[#0284C7]">Tổng số tiền cần chuyển hoàn:</span>
                        <span className="text-2xl font-black text-[#16A34A]">
                          {effectiveRefundAmount > 0 ? formatCurrency(effectiveRefundAmount) : (parsedRefund?.refundAmount || '—')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Đính kèm ảnh biên lai chuyển khoản (Tuỳ chọn) */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-[#AFAFAF]">
                        {parsedRefund?.isCash
                          ? 'Ảnh phiếu chi có chữ ký nhận tiền của khách *'
                          : 'Ảnh biên lai chuyển khoản / ủy nhiệm chi *'}
                      </span>
                      <label className="duo-btn-white px-3 py-1 text-xs gap-1 cursor-pointer">
                        <span className="material-symbols-outlined text-[16px] text-[#1CB0F6]">upload_file</span>
                        Tải ảnh biên lai
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              let finalUrl = null;
                              try {
                                const res = await uploadImageFile(file);
                                if (res?.url) finalUrl = res.url;
                              } catch (uploadErr) {
                                console.warn('Upload API failed, fallback to compressed dataUrl', uploadErr);
                              }
                              const dataUrl = finalUrl || await compressImageToDataUrl(file);
                              setEvidenceImageUrl(dataUrl);
                            } catch (err) {
                              setToast({ type: 'error', message: err.message || 'Không đọc được ảnh biên lai.' });
                            }
                            e.target.value = '';
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <input
                      type="text"
                      value={evidenceImageUrl}
                      onChange={e => setEvidenceImageUrl(e.target.value)}
                      placeholder="Hoặc dán link URL ảnh chụp màn hình chuyển khoản tại đây..."
                      className="duo-input text-xs"
                    />
                    {evidenceImageUrl && (
                      <div className="relative w-28 h-28 rounded-xl border-2 border-[#84D8FF] overflow-hidden bg-[#F7F7F7]">
                        <img
                          src={evidenceImageUrl}
                          alt="Preview"
                          onClick={() => setPreviewImage(evidenceImageUrl)}
                          className="w-full h-full object-cover cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => setEvidenceImageUrl('')}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#FF4B4B] text-white flex items-center justify-center text-xs font-black cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>

                  {/* D-22 / PR-O26: khách báo chưa nhận → xử lý ở modal Bảng hoàn tiền */}
                  {task.receiptStatus === 'DISPUTED' && (
                    <div className="rounded-xl border-2 border-[#FFB8B8] bg-[#FFF2F2] p-3 text-xs font-bold text-[#4B4B4B] flex flex-col gap-1">
                      <span className="font-black text-[#FF4B4B]">Khách báo chưa nhận được tiền: “{task.receiptDisputeReason}”</span>
                      <span>Mở <Link to="/manager/refunds" className="text-[#1CB0F6] underline">Bảng hoàn tiền</Link> → “Xử lý: khách báo chưa nhận” để chọn giao dịch đúng hoặc chuyển bổ sung.</span>
                    </div>
                  )}

                  {/* Ghi chú xác nhận hoàn tiền */}
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-black uppercase text-[#AFAFAF]">Ghi chú xác nhận hoàn tiền</span>
                    <textarea
                      value={refundNotes}
                      onChange={e => setRefundNotes(e.target.value)}
                      rows={2}
                      placeholder="Nhập mã giao dịch ngân hàng (FT...) hoặc ghi chú tất toán..."
                      className="duo-input resize-none text-xs"
                    />
                  </label>

                  {!evidenceImageUrl.trim() && (
                    <p className="text-[11px] font-bold text-[#FF4B4B]">
                      * Bắt buộc tải {parsedRefund?.isCash ? 'ảnh phiếu chi có chữ ký khách (chữ ký = khách xác nhận đã nhận tiền)' : 'ảnh biên lai chuyển tiền'} trước khi xác nhận
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!evidenceImageUrl.trim()) {
                        setToast({ type: 'error', message: 'Vui lòng tải lên ảnh chụp biên lai chuyển tiền trước khi xác nhận hoàn tiền.' });
                        return;
                      }
                      setConfirmRefundOpen(true);
                    }}
                    disabled={submitting || !evidenceImageUrl.trim() || task.receiptStatus === 'DISPUTED'}
                    className="duo-btn-green px-5 py-3 text-sm gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-[20px]">payments</span>
                    Xác nhận đã hoàn tiền ({effectiveRefundAmount > 0 ? formatCurrency(effectiveRefundAmount) : (parsedRefund?.refundAmount || '')})
                  </button>
                </div>
              )}
            </div>
          ) : task.taskType === 'MAINTENANCE' ? (
            /* ================== PHIẾU BẢO TRÌ Ô KHO (PR-O10 / PR-Q9) ================== */
            <MaintenancePanel
              task={task}
              userId={userId}
              isManager={isManager}
              onCompleted={data => setTask(data)}
              onPreview={setPreviewImage}
              onToast={setToast}
            />
          ) : isSupport ? (
            /* ================== MÀN HÌNH XỬ LÝ YÊU CẦU HỖ TRỢ (SUPPORT - UC-27) ================== */
            <div className="duo-card p-6 flex flex-col gap-5">
              {/* Khung thông tin phiếu hỗ trợ của khách hàng */}
              <div className="rounded-2xl border-2 border-[#F59E0B] bg-[#FFFBEB] p-5 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#FDE68A] pb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black uppercase text-[#B45309] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px]">confirmation_number</span>
                      Phiếu hỗ trợ #{task.ticketCode || task.supportRequestId || '—'}
                    </span>
                    {task.urgent && (
                      <span className="px-2 py-0.5 rounded-lg bg-[#FF4B4B] text-white text-[10px] font-black uppercase flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">priority_high</span>
                        KHẨN CẤP (PR-34)
                      </span>
                    )}
                  </div>
                  {task.ticketStatus && (
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                      SUPPORT_TICKET_STATUS_META[task.ticketStatus]?.cls || 'bg-white text-[#4B4B4B] border border-[#E5E5E5]'
                    }`}>
                      {SUPPORT_TICKET_STATUS_META[task.ticketStatus]?.label || task.ticketStatus}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between sm:justify-start sm:gap-2 flex-wrap items-center">
                    <span className="font-bold text-[#92400E]">Phân loại sự cố:</span>
                    <span className="font-black text-[#4B4B4B]">
                      {SUPPORT_ISSUE_LABEL[task.issueType] || task.issueType || 'Hỗ trợ khách hàng'}
                    </span>
                    {task.subCategory && (
                      <span className="px-2 py-0.5 rounded-md bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A] text-[10px] font-black">
                        {task.subCategory}
                      </span>
                    )}
                  </div>
                  {task.ticketCreatedAt && (
                    <div className="flex justify-between sm:justify-end sm:gap-2">
                      <span className="font-bold text-[#92400E]">Thời điểm gửi:</span>
                      <span className="font-black text-[#4B4B4B]">{formatDateTime(task.ticketCreatedAt)}</span>
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-white p-3.5 border border-[#FDE68A] text-xs flex flex-col gap-2">
                  <span className="text-[11px] font-black uppercase text-[#B45309]">
                    Nội dung phản ánh từ khách hàng:
                  </span>
                  <p className="font-bold text-[#4B4B4B] whitespace-pre-line leading-relaxed">
                    {task.ticketDescription || task.note || 'Khách hàng yêu cầu kiểm tra và hỗ trợ tại ô kho.'}
                  </p>
                  {task.ticketEvidenceImages?.length > 0 && (
                    <div className="mt-1 pt-2 border-t border-[#FDE68A] flex flex-col gap-1.5">
                      <span className="text-[10px] font-black uppercase text-[#B45309] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">photo_camera</span>
                        Hình ảnh hiện trường khách gửi:
                      </span>
                      <PhotoGrid images={task.ticketEvidenceImages} />
                    </div>
                  )}
                </div>

                {task.resolutionNote && (
                  <div className="rounded-xl bg-[#D7FFB8]/60 p-3.5 border border-[#58CC02] text-xs flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] font-black uppercase text-[#58A700] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">check_circle</span>
                        Kết quả xử lý đã phản hồi cho khách (PR-S5):
                      </span>
                      <div className="flex items-center gap-2">
                        {task.ticketResolvedAt && (
                          <span className="text-[10px] font-bold text-[#58A700]">
                            {formatDateTime(task.ticketResolvedAt)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setIncidentReportModalOpen(true)}
                          className="px-2.5 py-1 rounded-xl bg-white border border-[#58CC02] hover:bg-[#D7FFB8] text-[11px] font-black text-[#2B5300] cursor-pointer flex items-center gap-1 transition-colors shadow-2xs"
                        >
                          <span className="material-symbols-outlined text-[15px]">print</span>
                          In biên bản sự cố A4
                        </button>
                        {task.ticketStatus === 'RESOLVED' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditResolutionNote(task.resolutionNote || '');
                              setEditResolutionImages(task.resolutionImages || []);
                              setEditResolutionOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-xl bg-white border border-[#58CC02] hover:bg-[#D7FFB8] text-[11px] font-black text-[#2B5300] cursor-pointer flex items-center gap-1 transition-colors shadow-2xs"
                          >
                            <span className="material-symbols-outlined text-[15px]">edit</span>
                            Sửa phản hồi
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="font-bold text-[#2B5300] whitespace-pre-line leading-relaxed">
                      {task.resolutionNote}
                    </p>
                    {task.resolutionImages?.length > 0 && (
                      <div className="mt-1 pt-2 border-t border-[#86EFAC] flex flex-col gap-1.5">
                        <span className="text-[10px] font-black uppercase text-[#15803D] flex items-center gap-1">
                          <span className="material-symbols-outlined text-[15px]">photo_library</span>
                          Hình ảnh bằng chứng xử lý từ nhân viên:
                        </span>
                        <PhotoGrid images={task.resolutionImages} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {task.status === 'COMPLETED' ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] p-4">
                    <span className="material-symbols-outlined text-[32px] text-[#58A700]">verified</span>
                    <div>
                      <p className="text-sm font-black text-[#58A700]">Đã hoàn tất xử lý yêu cầu hỗ trợ!</p>
                      <p className="text-xs font-bold text-[#58A700]">
                        Phiếu hỗ trợ đã chuyển sang trạng thái Chờ khách xác nhận (RESOLVED). Nếu sau 3 ngày khách không phản hồi, hệ thống tự động đóng phiếu (PR-52).
                      </p>
                    </div>
                  </div>

                  {task.issueType === 'FACILITY_DAMAGE' && Boolean(task.escalatedMaintenanceTaskId || task.resolutionNote?.includes('[Chuyển bảo trì chuyên sâu]')) && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl bg-[#FFF7ED] border-2 border-[#F97316] p-4">
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-[28px] text-[#EA580C] shrink-0 mt-0.5">engineering</span>
                        <div>
                          <p className="text-sm font-black text-[#EA580C]">Đã chuyển sang quy trình Bảo trì chuyên sâu</p>
                          <p className="text-xs font-bold text-[#9A3412]">
                            {task.escalatedMaintenanceTaskId ? (
                              <>
                                Hệ thống đã tự động tạo Task bảo trì kho <strong>#{task.escalatedMaintenanceTaskId}</strong> và bàn giao cho bạn trực tiếp xử lý tiếp tại hiện trường.
                              </>
                            ) : (
                              <>
                                Hệ thống đã tự động tạo Task bảo trì kho mới (MAINTENANCE) và tự động bàn giao cho bạn thực hiện tiếp.
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <Link
                        to={task.escalatedMaintenanceTaskId ? `/staff/tasks/${task.escalatedMaintenanceTaskId}` : '/staff?tab=OPEN'}
                        className="duo-btn-yellow px-4 py-2 text-xs font-black gap-1.5 whitespace-nowrap shrink-0 flex items-center"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {task.escalatedMaintenanceTaskId ? 'arrow_forward' : 'assignment'}
                        </span>
                        {task.escalatedMaintenanceTaskId
                          ? `Đến Task bảo trì #${task.escalatedMaintenanceTaskId}`
                          : 'Đến Bảng công việc'}
                      </Link>
                    </div>
                  )}

                  {task.issueType === 'LOCK_ISSUE' && (
                    task.subCategory && (task.subCategory.includes('RFID') || task.subCategory.includes('thẻ')) ? (
                      <CodeBox icon="badge" label="Mã thẻ từ RFID ô kho" value={task.rfidCardCode || `RF-${task.storageUnitId || 'TB01'}-09`} big />
                    ) : task.accessPinCode ? (
                      <CodeBox icon="pin" label="Mã PIN SmartLock hiện tại của hợp đồng" value={task.accessPinCode} big />
                    ) : null
                  )}

                  {task.ticketStatus === 'RESOLVED' && (
                    <div className="rounded-2xl border-2 border-[#84D8FF] bg-[#F0F9FF] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className="material-symbols-outlined text-[#0284C7] text-[24px]">replay_circle_filled</span>
                        <div>
                          <p className="text-xs font-black text-[#0369A1]">
                            Cần điều chỉnh hoặc thao tác lại toàn bộ task này?
                          </p>
                          <p className="text-[11px] font-bold text-[#64748B]">
                            Phiếu đang ở trạng thái Chờ khách xác nhận (RESOLVED). Bạn có thể thu hồi kết quả và mở lại task để làm lại từ đầu.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setReopenSupportReason('');
                          setReopenSupportOpen(true);
                        }}
                        className="duo-btn-blue px-4 py-2 text-xs flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                      >
                        <span className="material-symbols-outlined text-[17px]">restart_alt</span>
                        Mở lại nguyên task để làm lại
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    {task.ticketStatus === 'RESOLVED' ? (
                      <span className="text-[11px] font-bold text-[#AFAFAF]">
                        * Phiếu hỗ trợ vẫn có thể mở lại cho đến khi khách hàng xác nhận hoặc quá 3 ngày.
                      </span>
                    ) : <span />}
                    <Link
                      to={isManager ? '/manager/tasks' : '/staff'}
                      className="duo-btn-gray px-5 py-2.5 text-xs self-end"
                    >
                      Về bảng công việc
                    </Link>
                  </div>
                </div>
              ) : task.status === 'OVERDUE' && isManager ? (
                /* Quản lý cơ sở gia hạn task SUPPORT quá hạn (PR-S4) */
                <div className="rounded-2xl border-2 border-[#FF9600] bg-[#FFF5E6] p-5 flex flex-col gap-4">
                  <div className="flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-[#E58800] text-[26px]">update</span>
                    <div>
                      <h3 className="text-sm font-black uppercase text-[#E58800]">
                        Gia hạn xử lý task hỗ trợ quá hạn (PR-S4)
                      </h3>
                      <p className="text-xs font-bold text-[#777777] mt-0.5">
                        Task hỗ trợ đã quá hạn 21:00 nên nhân viên bị khóa thao tác hoàn tất. Quản lý cơ sở chọn hạn mới bên dưới để mở lại cho nhân viên xử lý tiếp.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-black uppercase text-[#777777]">Ngày hạn mới (21:00) *</span>
                      <DateInput
                        min={new Date().toISOString().slice(0, 10)}
                        value={extendDueDate}
                        onChange={e => setExtendDueDate(e.target.value)}
                        className="duo-input text-xs font-bold bg-white"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-black uppercase text-[#777777]">Lý do gia hạn *</span>
                      <input
                        type="text"
                        maxLength={500}
                        value={extendReason}
                        onChange={e => setExtendReason(e.target.value)}
                        placeholder="VD: Chờ kỹ thuật kiểm tra khoá vào sáng mai..."
                        className="duo-input text-xs bg-white"
                      />
                    </label>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Link to="/manager/tasks" className="duo-btn-gray px-4 py-2.5 text-xs">
                      Về bảng công việc
                    </Link>
                    <button
                      type="button"
                      disabled={extendingSupport || !extendDueDate || !extendReason.trim()}
                      onClick={handleExtendSupportSubmit}
                      className="duo-btn-blue px-5 py-2.5 text-xs gap-1.5 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">event_upcoming</span>
                      {extendingSupport ? 'Đang gia hạn...' : 'Xác nhận gia hạn task hỗ trợ'}
                    </button>
                  </div>
                </div>
              ) : reason ? (
                <div className="rounded-2xl border-2 border-[#E5E5E5] bg-[#FAFAFA] p-6 flex flex-col items-center justify-center gap-3 text-center py-10">
                  <span className="material-symbols-outlined text-[#FF9600] text-[40px]">lock</span>
                  <p className="text-sm font-black text-[#4B4B4B]">Chưa thể hoàn tất xử lý hỗ trợ</p>
                  <p className="text-xs font-bold text-[#777777] max-w-[400px]">{reason}</p>
                  <Link
                    to={isManager ? '/manager/tasks' : '/staff'}
                    className="duo-btn-gray px-4 py-2 text-xs mt-1"
                  >
                    Về bảng công việc
                  </Link>
                </div>
              ) : (
                /* Nhân viên đang giữ task IN_PROGRESS xử lý yêu cầu hỗ trợ */
                <div className="flex flex-col gap-5">
                  {/* Xử lý sự cố KHÓA & MÃ PIN (LOCK_ISSUE) - Phân nhánh chính xác theo mục khách chọn */}
                  {task.issueType === 'LOCK_ISSUE' && (() => {
                    const isRfidIssue = task.subCategory && (task.subCategory.includes('RFID') || task.subCategory.includes('thẻ'));
                    const isBatteryIssue = task.subCategory && (task.subCategory.includes('Hết pin') || task.subCategory.includes('không nhận mã') || task.subCategory.includes('pin'));
                    const isJammedKeypad = task.subCategory && (task.subCategory.includes('kẹt') || task.subCategory.includes('liệt') || task.subCategory.includes('bàn phím'));

                    if (isRfidIssue) {
                      return (
                        <div className="rounded-2xl border-2 border-[#84D8FF] bg-[#F0F9FF] p-4 flex flex-col gap-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h3 className="text-xs font-black uppercase text-[#0284C7] flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[18px]">contactless</span>
                                Công cụ xử lý thẻ từ RFID SmartLock (PR-S7)
                              </h3>
                              <p className="text-[11px] font-bold text-[#64748B] mt-0.5">
                                Dành riêng cho sự cố thẻ từ không nhận tín hiệu, chập chờn hoặc đầu đọc báo đèn đỏ. Nhân viên nạp lại mã thẻ hoặc cấp phát thẻ RFID mới.
                              </p>
                            </div>
                            <div className="px-3 py-1.5 rounded-xl bg-white border-2 border-[#BAE6FD] flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase text-[#0284C7]">Thẻ RFID ô:</span>
                              <span className="font-mono text-sm font-black tracking-wider text-[#0F172A]">
                                {task.rfidCardCode || `RF-${task.storageUnitId || 'TB01'}-09`}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#BAE6FD]/60">
                            <span className="text-[11px] font-bold text-[#0369A1]">
                              * Nạp lại mã thẻ vào bộ nhớ đầu đọc hoặc cấp phát thẻ RFID mới và đồng bộ ngay vào hợp đồng khách hàng.
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setToast({
                                    type: 'success',
                                    message: 'Đã nạp lại mã thẻ từ RFID vào đầu đọc SmartLock ô kho thành công! Quẹt thẻ mở chốt tức thì.'
                                  });
                                  const sample = INCIDENT_REPORT_TEMPLATES.LOCK_ISSUE?.find(t => t.id === 'LOCK_RFID_ERROR') || findMatchingTemplate(task);
                                  setResolutionNote(buildIncidentReportNote(task, sample, repairStatus));
                                }}
                                className="duo-btn-blue px-3.5 py-2 text-xs gap-1.5 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[16px]">sync</span>
                                Nạp &amp; Đồng bộ lại đầu đọc thẻ
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const newRfidCode = `RF-${task.storageUnitId || 'TB01'}-${Math.floor(1000 + Math.random() * 9000)}`;
                                  reissueSupportContractRfid(task.id, userId, newRfidCode)
                                    .then(data => {
                                      setTask(data);
                                      setToast({
                                        type: 'success',
                                        message: `Đã cấp phát và cập nhật thẻ từ RFID mới (${data.rfidCardCode || newRfidCode}) vào hợp đồng ${data.contractCode || ''} thành công!`
                                      });
                                      const now = new Date();
                                      const pad = n => String(n).padStart(2, '0');
                                      const dateStr = `${pad(now.getHours())}:${pad(now.getMinutes())} ngày ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
                                      const unit = task?.storageUnitId || 'Ô kho';
                                      const staff = task?.staffName || task?.assignedStaffName || 'Nhân viên cơ sở';
                                      const rawTicket = task?.ticketCode || (task?.id ? `SR-${task.id}` : '---');
                                      const ticketCode = String(rawTicket).startsWith('#') ? String(rawTicket).slice(1) : String(rawTicket);
                                      setResolutionNote(`[BIÊN BẢN XỬ LÝ SỰ CỐ & KIỂM TRA HIỆN TRƯỜNG]
• Thời gian: ${dateStr} · Ô kho: ${unit}
• Cán bộ xử lý: ${staff} · Phiếu: ${ticketCode} [Lỗi thẻ từ RFID]
• Hiện trạng: Thẻ từ RFID cũ bị trầy xước chip từ, đầu đọc báo đèn đỏ không nhận diện.
• Nguyên nhân sơ bộ: Hỏng vi mạch thẻ từ do va chạm cơ học trong quá trình sử dụng.
• Biện pháp xử lý kỹ thuật:
  - Vô hiệu hóa mã thẻ RFID cũ trong bộ nhớ điều khiển khóa ô kho.
  - Cấp mới thẻ từ RFID mã số ${data.rfidCardCode || newRfidCode} và kích hoạt quyền truy cập mở khóa ô kho.
  - Thử quẹt thẻ 03 lần liên tiếp: đầu đọc báo đèn xanh và mở chốt êm ái 100%.
• Kết quả nghiệm thu: Đã bàn giao thẻ từ RFID mới (${data.rfidCardCode || newRfidCode}) cho khách hàng, kiểm tra mở khóa hoạt động hoàn hảo.`);
                                    })
                                    .catch(err => {
                                      setToast({
                                        type: 'error',
                                        message: err.response?.data?.message || 'Không thể cấp đổi thẻ từ RFID lúc này.'
                                      });
                                    });
                                }}
                                className="duo-btn-green px-3.5 py-2 text-xs gap-1.5 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[16px]">add_card</span>
                                Cấp phát thẻ từ RFID mới
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (isBatteryIssue) {
                      return (
                        <div className="rounded-2xl border-2 border-[#84D8FF] bg-[#F0F9FF] p-4 flex flex-col gap-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h3 className="text-xs font-black uppercase text-[#0284C7] flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[18px]">battery_alert</span>
                                Quy trình kích nguồn dự phòng &amp; Thay pin SmartLock (PR-S8)
                              </h3>
                              <p className="text-[11px] font-bold text-[#64748B] mt-0.5">
                                Bàn phím không sáng đèn, không có tiếng bip báo hiệu, pin sụt dưới 10% không đủ điện áp kích mở chốt điện tử.
                              </p>
                            </div>
                            <div className="px-3 py-1.5 rounded-xl bg-white border-2 border-[#BAE6FD] flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase text-[#E58800]">Nguồn khẩn cấp:</span>
                              <span className="font-mono text-xs font-black text-[#0F172A]">Cổng phụ Type-C 5V</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#BAE6FD]/60">
                            <span className="text-[11px] font-bold text-[#0369A1]">
                              * Kích nguồn qua cổng USB phụ mặt dưới khóa, sau đó mở cửa và thay mới 04 pin AA Panasonic Alkaline.
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setToast({
                                  type: 'success',
                                  message: 'Đã kích nguồn khẩn cấp qua cổng Type-C và thay mới trọn bộ 04 pin AA Panasonic Alkaline! Điện áp đạt 6.2V.'
                                });
                                const sample = INCIDENT_REPORT_TEMPLATES.LOCK_ISSUE?.find(t => t.id === 'LOCK_DEAD_BATTERY') || findMatchingTemplate(task);
                                setResolutionNote(buildIncidentReportNote(task, sample, repairStatus));
                              }}
                              className="duo-btn-blue px-4 py-2 text-xs gap-1.5 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[17px]">battery_charging_full</span>
                              Kích nguồn &amp; Thay 04 pin AA Panasonic mới
                            </button>
                          </div>
                        </div>
                      );
                    }

                    if (isJammedKeypad) {
                      return (
                        <div className="rounded-2xl border-2 border-[#84D8FF] bg-[#F0F9FF] p-4 flex flex-col gap-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h3 className="text-xs font-black uppercase text-[#0284C7] flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[18px]">keyboard</span>
                                Khắc phục kẹt phím &amp; Vệ sinh bàn phím số SmartLock
                              </h3>
                              <p className="text-[11px] font-bold text-[#64748B] mt-0.5">
                                Phím số bị rít, kẹt cơ học hoặc giảm độ nhạy cảm ứng do bụi bẩn bám dính lâu ngày trong môi trường kho.
                              </p>
                            </div>
                            <div className="px-3 py-1.5 rounded-xl bg-white border-2 border-[#BAE6FD] flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase text-[#0284C7]">Tiếp điểm:</span>
                              <span className="font-mono text-xs font-black text-[#0F172A]">Cảm ứng &amp; Cơ</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#BAE6FD]/60">
                            <span className="text-[11px] font-bold text-[#0369A1]">
                              * Tháo nắp che, vệ sinh cặn bụi bằng cồn chuyên dụng và cân chỉnh độ nảy lò xo phím số.
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setToast({
                                  type: 'success',
                                  message: 'Đã vệ sinh tiếp điểm và căn chỉnh lực đàn hồi phím số thành công! Các phím 0-9 nhạy 100%.'
                                });
                                const sample = INCIDENT_REPORT_TEMPLATES.LOCK_ISSUE?.find(t => t.id === 'LOCK_JAMMED_KEYPAD') || findMatchingTemplate(task);
                                setResolutionNote(buildIncidentReportNote(task, sample, repairStatus));
                              }}
                              className="duo-btn-blue px-4 py-2 text-xs gap-1.5 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[17px]">cleaning_services</span>
                              Vệ sinh tiếp điểm &amp; Cân chỉnh lò xo phím
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // Mặc định: Quên mã PIN SmartLock
                    return (
                      <div className="rounded-2xl border-2 border-[#84D8FF] bg-[#F0F9FF] p-4 flex flex-col gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-xs font-black uppercase text-[#0284C7] flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[18px]">dialpad</span>
                              Công cụ cấp lại mã PIN 6 số (PR-S6)
                            </h3>
                            <p className="text-[11px] font-bold text-[#64748B] mt-0.5">
                              Dành riêng cho sự cố khóa / quên mã PIN. Hệ thống sinh mã PIN 6 số mới duy nhất theo BR-73.
                            </p>
                          </div>
                          <div className="px-3 py-1.5 rounded-xl bg-white border-2 border-[#BAE6FD] flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-[#0284C7]">PIN hiện tại:</span>
                            <span className="font-mono text-base font-black tracking-widest text-[#0F172A]">
                              {task.accessPinCode || '------'}
                            </span>
                          </div>
                        </div>

                        {task.contractStatus === 'OVERDUE' ? (
                          <div className="rounded-xl bg-[#FFDFDF] border border-[#FF4B4B] px-3.5 py-2.5 flex items-center gap-2 text-xs font-bold text-[#FF4B4B]">
                            <span className="material-symbols-outlined text-[18px]">block</span>
                            Hợp đồng đang QUÁ HẠN THANH TOÁN (OVERDUE) — Không được cấp lại mã PIN theo quy tắc PR-Q5 &amp; PR-S6. Vui lòng hướng dẫn khách thanh toán cước trước.
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <span className="text-[11px] font-bold text-[#0369A1]">
                              * Khi bấm cấp lại, mã PIN cũ sẽ bị vô hiệu hóa ngay lập tức và ghi nhật ký [PIN_RESET].
                            </span>
                            <button
                              type="button"
                              disabled={pinResetting}
                              onClick={handleResetPinForLockIssue}
                              className="duo-btn-blue px-4 py-2 text-xs gap-1.5 disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-[17px]">autorenew</span>
                              {pinResetting ? 'Đang cấp PIN mới...' : 'Cấp lại mã PIN (6 số)'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Xử lý sự cố AN NINH (SECURITY) */}
                  {task.issueType === 'SECURITY' && (
                    <div className="rounded-2xl border-2 border-[#EF4444] bg-[#FEF2F2] p-4 flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-xs font-black uppercase text-[#B91C1C] flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[18px]">security</span>
                          Biên bản kiểm tra an ninh hiện trường
                        </h3>
                        <span className="duo-badge bg-white text-[#B91C1C] border border-[#FCA5A5] text-[10px]">
                          Khẩn cấp / An ninh
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-[#7F1D1D]">
                        Kiểm tra trực tiếp tại ô kho: xem xét kỹ chốt khóa, tai khóa, tình trạng cửa và đối chiếu với camera giám sát hành lang.
                      </p>

                      <label className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-black uppercase text-[#777777]">Tình trạng chốt khóa / cửa kho *</span>
                        <select
                          value={securityLockStatus}
                          onChange={e => setSecurityLockStatus(e.target.value)}
                          className="duo-input text-xs bg-white"
                        >
                          <option value="">— Chọn kết luận an ninh —</option>
                          <option value="INTACT">Khóa và niêm phong nguyên vẹn (Không có dấu hiệu cạy phá / đột nhập)</option>
                          <option value="TAMPERED">Phát hiện dấu hiệu bất thường / Cạy phá / Tác động ngoại lực</option>
                        </select>
                      </label>

                      <HandoverPhotoPicker
                        images={securityImages}
                        onChange={setSecurityImages}
                        label="Ảnh bằng chứng kiểm tra an ninh (Bắt buộc ít nhất 1 ảnh)"
                        mockLabel={`Ảnh kiểm tra an ninh ô ${task.storageUnitId || ''}`}
                      />

                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#FCA5A5]/60">
                        <span className="text-[11px] font-bold text-[#991B1B]">Gợi ý thao tác nhanh:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const sample = findMatchingTemplate(task);
                            setResolutionNote(buildIncidentReportNote(task, sample, repairStatus));
                            setToast({
                              type: 'success',
                              message: `Đã áp dụng mẫu biên bản an ninh khớp với [${task.subCategory || 'An ninh'}].`
                            });
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white border border-[#EF4444] hover:bg-[#FEE2E2] text-[11px] font-black text-[#B91C1C] flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span className="material-symbols-outlined text-[15px]">verified_user</span>
                          Áp dụng biên bản an ninh khớp với [{task.subCategory || 'Sự cố an ninh'}]
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Xử lý sự cố HƯ HỎNG HẠ TẦNG (FACILITY_DAMAGE) */}
                  {task.issueType === 'FACILITY_DAMAGE' && (
                    <div className="rounded-2xl border-2 border-[#F59E0B] bg-[#FFFBEB] p-4 flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-xs font-black uppercase text-[#D97706] flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[18px]">handyman</span>
                          Khắc phục sự cố cơ sở vật chất &amp; thiết bị
                        </h3>
                        <span className="duo-badge bg-white text-[#D97706] border border-[#FDE68A] text-[10px]">
                          Bảo trì hạ tầng
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-[#92400E]">
                        Kiểm tra thực tế hỏng hóc thiết bị tại hiện trường (cửa cuốn, đèn chiếu sáng, ổ điện, ray trượt, vách ngăn).
                      </p>

                      <label className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-black uppercase text-[#777777]">Biện pháp xử lý *</span>
                        <select
                          value={repairStatus}
                          onChange={e => {
                            const newStatus = e.target.value;
                            setRepairStatus(newStatus);
                            if (
                              !resolutionNote.trim() ||
                              resolutionNote.includes('[BIÊN BẢN XỬ LÝ SỰ CỐ & KIỂM TRA HIỆN TRƯỜNG]') ||
                              resolutionNote.includes('chuyên sâu') ||
                              resolutionNote.includes('tiêu chuẩn') ||
                              resolutionNote.includes('hoạt động ổn định')
                            ) {
                              const sampleTemplate = findMatchingTemplate(task);
                              setResolutionNote(buildIncidentReportNote(task, sampleTemplate, newStatus));
                            }
                          }}
                          className="duo-input text-xs bg-white"
                        >
                          <option value="">— Chọn biện pháp xử lý —</option>
                          <option value="FIXED">Đã khắc phục / sửa chữa xong tại chỗ</option>
                          <option value="ESCALATED_MAINTENANCE">Sự cố phức tạp, đã lập phiếu yêu cầu kỹ thuật bảo trì chuyên sâu</option>
                        </select>
                      </label>

                      <HandoverPhotoPicker
                        images={repairImages}
                        onChange={setRepairImages}
                        label="Ảnh hiện trạng hoặc kết quả sau khi khắc phục"
                        mockLabel={`Ảnh bảo trì ô ${task.storageUnitId || ''}`}
                      />
                    </div>
                  )}

                  {/* Xử lý sự cố VỆ SINH (CLEANING) */}
                  {task.issueType === 'CLEANING' && (
                    <div className="rounded-2xl border-2 border-[#10B981] bg-[#ECFDF5] p-4 flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-xs font-black uppercase text-[#059669] flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[18px]">cleaning_services</span>
                          Xử lý vệ sinh kho bãi &amp; môi trường
                        </h3>
                        <span className="duo-badge bg-white text-[#059669] border border-[#A7F3D0] text-[10px]">
                          Vệ sinh cơ sở
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-[#065F46]">
                        Nhân viên dọn dẹp rác thải, xử lý ẩm mốc, khử mùi hoặc lau dọn sàn/vách ngăn theo phản ánh của khách hàng.
                      </p>

                      <HandoverPhotoPicker
                        images={cleaningImages}
                        onChange={setCleaningImages}
                        label="Ảnh bằng chứng khu vực sau khi đã được dọn sạch sẽ (Bắt buộc ít nhất 1 ảnh)"
                        mockLabel={`Ảnh nghiệm thu vệ sinh ô ${task.storageUnitId || ''}`}
                      />

                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#A7F3D0]/60">
                        <span className="text-[11px] font-bold text-[#065F46]">Gợi ý thao tác nhanh:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const sample = findMatchingTemplate(task);
                            setResolutionNote(buildIncidentReportNote(task, sample, repairStatus));
                            setToast({
                              type: 'success',
                              message: `Đã áp dụng mẫu biên bản vệ sinh khớp với [${task.subCategory || 'Vệ sinh'}].`
                            });
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white border border-[#10B981] hover:bg-[#D1FAE5] text-[11px] font-black text-[#047857] flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span className="material-symbols-outlined text-[15px]">sanitizer</span>
                          Áp dụng biên bản vệ sinh khớp với [{task.subCategory || 'Vệ sinh kho'}]
                        </button>
                      </div>
                    </div>
                  )}

                  {/* BR-126: hồ sơ bồi thường khách gửi — nhân viên kiểm tra hiện trường */}
                  {isClaimInspection && (
                    <div className="flex flex-col gap-3 rounded-2xl border-2 border-[#FFB8B8] bg-[#FFF5F5] p-4">
                      <p className="text-sm font-black text-[#FF4B4B] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[20px]">gavel</span>
                        Hồ sơ bồi thường {claim.claimCode} — {claim.claimType === 'GOODS_LOSS' ? 'Mất hàng' : 'Hàng bị hư hỏng'}
                      </p>
                      <p className="text-xs font-bold text-[#4B4B4B] whitespace-pre-line">{claim.itemsDescription}</p>
                      <p className="text-xs font-bold text-[#777777]">
                        Khách đề nghị {Number(claim.claimedAmount).toLocaleString('vi-VN')}đ · phát hiện ngày {claim.incidentDate || '—'} · gói bảo hiểm {claim.insurancePlanLabel}
                      </p>
                      {claim.customerImages?.length > 0 && <PhotoGrid images={claim.customerImages} />}
                      <p className="text-[11px] font-bold text-[#FF9600]">
                        Mở ô cùng khách, chụp hiện trạng (dấu thấm, ẩm mốc, khoá, hàng hư) và ghi nguyên nhân sơ bộ. Quản lý cơ sở sẽ đối chiếu với ảnh lúc nhận kho và cảm biến để kết luận.
                      </p>
                      <HandoverPhotoPicker
                        images={inspectionImages}
                        onChange={setInspectionImages}
                        label="Ảnh kiểm tra hiện trường"
                        mockLabel={`Hiện trường ô ${task.storageUnitId || ''}`}
                      />
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-black uppercase text-[#777777]">Nguyên nhân sơ bộ *</span>
                        <select value={preliminaryCause} onChange={e => setPreliminaryCause(e.target.value)} className="duo-input text-xs">
                          <option value="">— Chọn —</option>
                          <option value="FACILITY">Do cơ sở (dột, nhiệt độ / độ ẩm, khoá hỏng...)</option>
                          <option value="CUSTOMER">Do khách (đóng gói kém, hàng tự hư, hàng cấm...)</option>
                          <option value="FORCE_MAJEURE">Bất khả kháng (thiên tai, hoả hoạn từ bên ngoài)</option>
                          <option value="UNKNOWN">Chưa xác định được</option>
                        </select>
                      </label>
                    </div>
                  )}

                  {/* Form nhập kết quả xử lý (PR-S5) */}
                  <div className="flex flex-col gap-3">
                    <div>
                      <h3 className="text-base font-black text-[#4B4B4B]">
                        {isClaimInspection ? 'Biên bản kiểm tra hiện trường' : 'Báo cáo kết quả xử lý hỗ trợ (PR-S5)'}
                      </h3>
                      <p className="text-xs font-bold text-[#AFAFAF]">
                        {isClaimInspection
                          ? 'Mô tả những gì đã kiểm tra tại ô (tối thiểu 10 ký tự). Phiếu hỗ trợ vẫn đang xử lý cho tới khi quản lý chốt bồi thường.'
                          : 'Nhập nội dung đã kiểm tra / khắc phục tại hiện trường (1–1000 ký tự) để gửi phản hồi cho khách hàng xác nhận.'}
                      </p>
                    </div>

                    {/* Hộp công cụ Biên bản xử lý sự cố chuẩn hóa (Góp ý Hội đồng) */}
                    <div className="rounded-2xl bg-[#F0F8FF] border border-[#BAE3FF] p-3.5 flex flex-col gap-2.5 min-w-0 w-full overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="material-symbols-outlined text-[20px] text-[#006699] shrink-0">assignment</span>
                          <span className="text-xs font-black uppercase text-[#004B73] truncate">
                            Biên bản xử lý sự cố chuẩn hóa (Hội đồng)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setResolutionNote(buildBlankIncidentReport(task, repairStatus));
                            }}
                            className="px-3 py-1.5 rounded-xl bg-white border border-[#006699] hover:bg-[#E0F2FE] text-[11px] font-black text-[#006699] flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors shrink-0"
                            title="Tạo khung biên bản trống chuẩn để nhân viên tự điền"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit_note</span>
                            + Chèn khung biên bản (tự điền)
                          </button>
                          <button
                            type="button"
                            onClick={() => setIncidentReportModalOpen(true)}
                            className="px-3 py-1.5 rounded-xl bg-[#006699] hover:bg-[#004B73] text-[11px] font-black text-white flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors shrink-0"
                          >
                            <span className="material-symbols-outlined text-[16px]">print</span>
                            Xem &amp; In biên bản A4
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#5588A3] pt-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium leading-relaxed">
                            💡 <em>Hệ thống điền sẵn thông tin hành chính.</em>
                          </p>
                          {task?.subCategory && (
                            <span className="px-2 py-0.5 rounded-md bg-[#E0F2FE] text-[#0369A1] font-bold text-[10px] border border-[#BAE6FD]">
                              Khớp danh mục: {task.subCategory}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const sampleTemplate = findMatchingTemplate(task);
                            setResolutionNote(buildIncidentReportNote(task, sampleTemplate, repairStatus));
                          }}
                          className="text-[10px] font-bold text-[#006699] hover:underline cursor-pointer shrink-0"
                          title="Điền dữ liệu mẫu chuẩn khớp với mục khách đã chọn"
                        >
                          + Điền mẫu tham khảo (demo)
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] font-black uppercase text-[#94A3B8] mr-1 flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[13px]">bolt</span>
                        Gợi ý phản hồi nhanh:
                      </span>
                      {getPresetsForTask(task, repairStatus).map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setResolutionNote(preset)}
                          className="px-2.5 py-1 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#38BDF8] hover:bg-[#F0F9FF] text-[11px] font-bold text-[#475569] cursor-pointer transition-colors text-left"
                          title={preset}
                        >
                          + Mẫu #{idx + 1}: {preset.slice(0, 38)}...
                        </button>
                      ))}
                    </div>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-black uppercase text-[#777777]">
                        Nội dung kết quả xử lý (Bắt buộc) *
                      </span>
                      <textarea
                        rows={4}
                        maxLength={NOTES_MAX}
                        value={resolutionNote}
                        onChange={e => setResolutionNote(e.target.value)}
                        placeholder="Mô tả rõ nguyên nhân và biện pháp đã xử lý cho khách hàng..."
                        className="duo-input resize-none text-xs"
                      />
                      <span className={`text-[11px] font-bold self-end ${
                        resolutionNote.length > NOTES_MAX ? 'text-[#FF4B4B]' : 'text-[#AFAFAF]'
                      }`}>
                        {resolutionNote.length}/{NOTES_MAX} ký tự
                      </span>
                    </label>

                    <button
                      type="button"
                      disabled={!canSubmitSupport}
                      onClick={() => setConfirmSupportOpen(true)}
                      className="duo-btn-green px-5 py-3 text-sm gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-[20px]">task_alt</span>
                      Xác nhận hoàn tất xử lý &amp; Gửi phản hồi cho khách
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : task.status === 'COMPLETED' ? (
            /* ================== MÀN HÌNH ĐÃ HOÀN THÀNH (CHECK_OUT / CHECK_IN) ================== */
            isCheckOut ? (
              <div className="duo-card p-6 flex flex-col gap-5">
                {justCompleted && (
                  <div className="flex items-center gap-3 rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] p-4">
                    <span className="material-symbols-outlined text-[32px] text-[#58A700]">verified</span>
                    <div>
                      <p className="text-sm font-black text-[#58A700]">
                        {isRecheckTask ? 'Đã gửi kết quả kiểm tra lại!' : 'Đã hoàn tất nghiệm thu trả kho!'}
                      </p>
                      <p className="text-xs font-bold text-[#58A700]">
                        {isRecheckTask
                          ? 'Bảng quyết toán mới đã gửi khách xác nhận.'
                          : 'Mã PIN/RFID đã bị thu hồi. Khách xem bảng quyết toán trên tài khoản và xác nhận mới kết thúc hợp đồng (D-21).'}
                      </p>
                    </div>
                  </div>
                )}

                {/* D-21: bảng quyết toán trả kho (Staff thu tiền mặt phần âm). Hợp đồng trả kho trước D-21 → bảng tóm tắt cũ */}
                <SettlementPanel
                  contractId={task.contractId}
                  viewer={isManager ? 'FACILITY_MANAGER' : 'STAFF'}
                  onChanged={() => loadTask()}
                  fallback={(
                <div className="rounded-2xl border-2 border-[#84D8FF] bg-[#DDF4FF]/50 p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-[#1899D6] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                      Quyết toán tài chính &amp; Hoàn tiền
                    </span>
                    <span className="duo-badge bg-white text-[#4B4B4B] border border-[#E5E5E5] text-[10px]">
                      Ô kho: {UNIT_STATUS_LABEL[task.storageUnitStatus] || task.storageUnitStatus}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-[#4B4B4B] pt-1">
                    <span>Tiền cọc hợp đồng:</span>
                    <span className="font-black">{formatCurrency(task.depositHeldAmount)}</span>
                  </div>
                  {Number(task.totalDamageCost) > 0 && (
                    <div className="flex justify-between text-xs font-bold text-[#4B4B4B]">
                      <span>Khấu trừ sự cố hư hỏng ({task.damageCases?.length || 0} mục):</span>
                      <span className="font-black text-[#FF4B4B]">- {formatCurrency(task.totalDamageCost)}</span>
                    </div>
                  )}
                  {(() => {
                    const fee = getOverdueFeeBreakdown(task);
                    if (!(fee.totalPenalty > 0 || fee.lateFeeWaived || fee.overstayFeeWaived)) return null;
                    return (
                      <div className="flex flex-col gap-1 py-1">
                        <div className="flex justify-between text-xs font-bold text-[#4B4B4B]">
                          <span>Khấu trừ tổng tiền phạt quá hạn:</span>
                          <span className="font-black text-[#FF4B4B]">- {formatCurrency(fee.totalPenalty)}</span>
                        </div>
                        <div className="pl-3 border-l-2 border-[#FCA5A5] space-y-0.5 text-[11px] font-bold text-[#777777]">
                          <div className="flex justify-between">
                            <span>• Phí phạt trễ hạn:</span>
                            <span className="text-[#FF4B4B]">{fee.lateFeeWaived ? 'Đã miễn (0₫)' : `- ${formatCurrency(fee.lateFee)}`}</span>
                          </div>
                          {(fee.overstayFee > 0 || fee.overstayFeeWaived) && (
                            <div className="flex justify-between">
                              <span>• Phí chiếm dụng ô:</span>
                              <span className="text-[#FF4B4B]">{fee.overstayFeeWaived ? 'Đã miễn (0₫)' : `- ${formatCurrency(fee.overstayFee)}`}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  <div className="flex justify-between text-xs font-bold text-[#4B4B4B]">
                    <span>Tiền cọc hoàn lại:</span>
                    <span className="font-black text-[#026AA2]">
                      {formatCurrency(effectiveDepositRefund)}
                    </span>
                  </div>
                  {effectiveEarlyRentRefund > 0 && (
                    <div className="flex justify-between text-xs font-bold text-[#58CC02] bg-[#EAFBE0] p-2 rounded-xl border border-[#D0F8AB]">
                      <span>Hoàn tiền thuê trả sớm (PR-O2):</span>
                      <span className="font-black text-[#58A700]">+ {formatCurrency(effectiveEarlyRentRefund)}</span>
                    </div>
                  )}
                  <div className="border-t border-[#84D8FF] pt-2 flex justify-between items-center">
                    <span className="text-xs font-black uppercase text-[#1899D6]">Tổng tiền hoàn trả khách:</span>
                    <span className="text-xl font-black text-[#58A700]">{formatCurrency(effectiveRefundAmount)}</span>
                  </div>
                  {Number(task.excessDebtAmount) > 0 && (
                    <div className="rounded-xl bg-[#FFDFDF] border border-[#FF4B4B] px-3 py-2 flex justify-between items-center text-xs">
                      <span className="font-black text-[#FF4B4B]">Khoản nợ vượt cọc khách cần đóng thêm:</span>
                      <span className="font-black text-[#FF4B4B] text-sm">{formatCurrency(task.excessDebtAmount)}</span>
                    </div>
                  )}
                  {task.refundBreakdownNote && (
                    <p className="text-[11px] font-bold text-[#777777] bg-white/70 p-2 rounded-xl border border-[#B9E6FE] mt-1 leading-relaxed">
                      {task.refundBreakdownNote}
                    </p>
                  )}
                </div>
                  )}
                />

                {/* Biên bản nghiệm thu */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-black uppercase text-[#4B4B4B] tracking-wide">Biên bản nghiệm thu trả kho</h2>
                    {record && <span className="text-[11px] font-bold text-[#AFAFAF]">#{record.id} · {formatDateTime(record.createdAt)}</span>}
                  </div>
                  {record ? (
                    <>
                      <ul className="flex flex-col gap-2">
                        {[...CHECKOUT_BLOCKING_LIST, ...CHECKOUT_CONDITION_LIST].map(item => (
                          <li key={item.key} className="flex items-center gap-2 text-xs font-bold text-[#4B4B4B]">
                            <span className={`material-symbols-outlined text-[20px] ${record[item.key] ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}`}>
                              {record[item.key] ? 'check_circle' : 'cancel'}
                            </span>
                            {item.label}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-4 rounded-2xl bg-[#F7F7F7] px-4 py-3 text-xs">
                        <p><span className="font-black text-[#AFAFAF] uppercase mr-1">Người nghiệm thu:</span><span className="font-black text-[#4B4B4B]">{record.staffName}</span></p>
                        <p className="mt-1 whitespace-pre-line"><span className="font-black text-[#AFAFAF] uppercase mr-1">Ghi chú:</span><span className="font-bold text-[#777777]">{record.notes || 'Không có'}</span></p>
                      </div>
                      {record.evidenceImages?.length > 0 && (
                        <div className="mt-3"><PhotoGrid images={record.evidenceImages} /></div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs font-bold text-[#AFAFAF]">Task này không có biên bản nghiệm thu.</p>
                  )}
                </div>

                {/* Danh sách sự cố đã ghi nhận (UC-24) */}
                <div>
                  <h2 className="text-sm font-black uppercase text-[#4B4B4B] tracking-wide mb-3">
                    Báo cáo sự cố hư hỏng
                  </h2>
                  {!task.damageCases || task.damageCases.length === 0 ? (
                    <div className="rounded-2xl bg-[#D7FFB8]/50 border-2 border-[#58CC02] px-4 py-3 flex items-center gap-2.5 text-xs font-black text-[#58A700]">
                      <span className="material-symbols-outlined text-[20px]">verified_user</span>
                      Ô kho nguyên vẹn, sạch sẽ — Không phát sinh sự cố hư hỏng.
                    </div>
                  ) : (
                    <DamageCaseList cases={task.damageCases} onPreview={setPreviewImage} />
                  )}
                  {Number(task.facilityDamageCost) > 0 && (
                    <p className="mt-2 text-[11px] font-bold text-[#1899D6]">
                      Cơ sở tự chịu {formatCurrency(task.facilityDamageCost)} cho các sự cố lỗi cơ sở — không trừ vào cọc của khách.
                    </p>
                  )}
                </div>

                <Link to={isManager ? "/manager/tasks" : "/staff"} className="duo-btn-gray px-5 py-2.5 text-xs self-end">Về bảng công việc</Link>
              </div>
            ) : (
              /* Đã hoàn thành CHECK_IN */
              <div className="duo-card p-6 flex flex-col gap-5">
                {justCompleted && (
                  <div className="flex items-center gap-3 rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] p-4">
                    <span className="material-symbols-outlined text-[32px] text-[#58A700]">verified</span>
                    <div>
                      <p className="text-sm font-black text-[#58A700]">Bàn giao thành công!</p>
                      <p className="text-xs font-bold text-[#58A700]">Đọc mã PIN và mã thẻ RFID bên dưới cho khách, sau đó phát thẻ từ.</p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  <CodeBox icon="pin" label="Mã PIN SmartLock" value={task.accessPinCode} big />
                  <CodeBox icon="contactless" label="Mã thẻ RFID" value={task.rfidCardCode} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-black uppercase text-[#4B4B4B] tracking-wide">Biên bản bàn giao</h2>
                    {record && <span className="text-[11px] font-bold text-[#AFAFAF]">#{record.id} · {formatDateTime(record.createdAt)}</span>}
                  </div>
                  {record ? (
                    <>
                      <ul className="flex flex-col gap-2">
                        {CHECKIN_CHECKLIST.filter(item => record[item.recordKey || item.key] != null).map(item => (
                          <li key={item.key} className="flex items-center gap-2 text-xs font-bold text-[#4B4B4B]">
                            <span className={`material-symbols-outlined text-[20px] ${record[item.recordKey || item.key] ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}`}>
                              {record[item.recordKey || item.key] ? 'check_circle' : 'cancel'}
                            </span>
                            {item.label}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-4 rounded-2xl bg-[#F7F7F7] px-4 py-3 text-xs">
                        <p><span className="font-black text-[#AFAFAF] uppercase mr-1">Người lập:</span><span className="font-black text-[#4B4B4B]">{record.staffName}</span></p>
                        <p className="mt-1 whitespace-pre-line"><span className="font-black text-[#AFAFAF] uppercase mr-1">Ghi chú:</span><span className="font-bold text-[#777777]">{record.notes || 'Không có'}</span></p>
                      </div>
                      {record.evidenceImages?.length > 0 && (
                        <div className="mt-3"><PhotoGrid images={record.evidenceImages} /></div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs font-bold text-[#AFAFAF]">Task này không có biên bản bàn giao.</p>
                  )}
                </div>

                <Link to={isManager ? "/manager/tasks" : "/staff"} className="duo-btn-gray px-5 py-2.5 text-xs self-end">Về bảng công việc</Link>
              </div>
            )
          ) : reason ? (
            /* ================== MÀN HÌNH BỊ CHẶN ================== */
            <div className="duo-card p-6 flex flex-col items-center justify-center gap-3 text-center py-12">
              <span className="material-symbols-outlined text-[#FF9600] text-[40px]">lock</span>
              <p className="text-sm font-black text-[#4B4B4B]">Không thể lập biên bản</p>
              <p className="text-xs font-bold text-[#777777] max-w-[360px]">{reason}</p>
              {!isManager && task.taskType === 'CHECK_IN' && handover?.status === 'PENDING_CUSTOMER'
                && task.staffId === userId && (
                <button type="button" className="duo-btn-gray px-4 py-2 text-xs disabled:opacity-50"
                  disabled={withdrawingCheckIn} onClick={async () => {
                    try {
                      setWithdrawingCheckIn(true);
                      await withdrawCheckInHandover(task.id);
                      await loadTask();
                      setToast({ type: 'success', message: 'Đã hoàn tác biên bản. Bạn có thể lập bản mới.' });
                    } catch (err) {
                      await loadTask();
                      setToast({ type: 'error', message: err.response?.data?.message || 'Không hoàn tác được biên bản.' });
                    } finally {
                      setWithdrawingCheckIn(false);
                    }
                  }}>Hoàn tác biên bản đã gửi</button>
              )}
              {task.taskType === 'CHECK_IN' && handover?.status === 'BLOCKED_FM' && <div className="w-full max-w-lg rounded-2xl border-2 border-[#FF9600] bg-[#FFF8EE] p-4 text-left flex flex-col gap-3">
                <p className="text-xs font-black text-[#B45309]">{handover.blockerType !== 'FACILITY_ISSUE' ? 'Bất đồng cần FM thống nhất với khách' : `Báo cáo không thể bàn giao ô ${handover.blockedUnitId || task.storageUnitId}`}</p>
                <p className="text-xs font-bold text-[#4B4B4B] whitespace-pre-line">{handover.blockerReason}</p>
                {handover.blockerEvidenceImages?.length > 0 && <PhotoGrid images={handover.blockerEvidenceImages} />}
                {handover.customerRejectionReason && <p className="text-xs font-bold text-[#4B4B4B] whitespace-pre-line">Khách từ chối trước đó: {handover.customerRejectionReason}</p>}
                {handover.customerRejectionImages?.length > 0 && <PhotoGrid images={handover.customerRejectionImages} />}
                {isManager ? <>
                  <p className="text-xs font-bold text-[#4B4B4B]">{handover.blockerType !== 'FACILITY_ISSUE' ? 'Liên hệ khách, thống nhất phương án tiếp tục hoặc huỷ theo chính sách. Không tự áp dụng hoàn 100% vì bất đồng.' : 'Kiểm tra sự cố, thống nhất với khách phương án đổi ô, dời lịch hoặc huỷ do lỗi cơ sở.'}</p>
                  {handover.blockerType === 'FACILITY_ISSUE' && task.contractId && <Link className="duo-btn-white px-4 py-2 text-xs" to={`/manager/contracts/${task.contractId}?transfer=1`}>Đổi ô cho khách</Link>}
                  <textarea className="duo-input text-xs" value={reopenNote} onChange={e => setReopenNote(e.target.value)} maxLength={500} placeholder="Kết luận và phương án đã thống nhất với khách (10–500 ký tự)" />
                  {handover.blockerType === 'GOODS_VALUE_DISPUTE' && <input type="number" min="1" max="10000000000" value={managerGoodsValue} onChange={e => setManagerGoodsValue(e.target.value)} className="duo-input text-xs" placeholder="Giá trị hàng FM thống nhất với khách *" />}
                  {handover.blockerType === 'FACILITY_ISSUE' && !handover.facilityFaultConfirmed && <button type="button" className="duo-btn-red px-4 py-2 text-xs" disabled={reopenNote.trim().length < 10}
                    onClick={async () => { try { await confirmCheckInUnitIssue(task.id, reopenNote.trim()); await loadTask(); setToast({ type: 'success', message: 'Đã xác nhận lỗi cơ sở; khách có thể dời lịch hoặc huỷ hoàn 100%.' }); } catch (err) { setToast({ type: 'error', message: err.response?.data?.message || 'Không xác nhận được sự cố.' }); } }}>Xác nhận lỗi cơ sở, mở phương án dời/huỷ cho khách</button>}
                  {handover.blockerType === 'FACILITY_ISSUE' && <HandoverPhotoPicker images={reopenPhotos} onChange={setReopenPhotos} label="Ảnh ô sau khắc phục hoặc ô thay thế" maxPhotos={10} />}
                  <button type="button" className="duo-btn-blue px-4 py-2 text-xs" disabled={reopenNote.trim().length < 10 || (handover.blockerType === 'GOODS_VALUE_DISPUTE' && Number(managerGoodsValue) <= 0) || (handover.blockerType === 'FACILITY_ISSUE' && reopenPhotos.length === 0)}
                    onClick={async () => { try { await reopenCheckInHandover(task.id, { note: reopenNote.trim(), evidenceImageUrl: reopenPhotos[0] || null, resolvedGoodsValue: handover.blockerType === 'GOODS_VALUE_DISPUTE' ? managerGoodsValue : null }); await loadTask(); setToast({ type: 'success', message: 'Đã cho tiếp tục bàn giao; nhân viên kiểm tra ô và lập biên bản mới.' }); } catch (err) { setToast({ type: 'error', message: err.response?.data?.message || 'Không mở lại được bàn giao.' }); } }}>Cho tiếp tục bàn giao sau khi xử lý</button>
                </> : <p className="text-xs font-bold text-[#777777]">Quản lý đang kiểm tra và thống nhất phương án với khách.</p>}
              </div>}

              {/* Vấn đề 2 (22/11/2026): Task CHECK_IN bị OVERDUE (kể cả khi đã lập biên bản nháp / bị từ chối) → FM dời lịch nhận kho ngay tại trang task */}
              {isManager && task.taskType === 'CHECK_IN' && task.reservationId
                && (task.status === 'OVERDUE' || (task.dueAt && new Date(task.dueAt) <= new Date())) && (
                <div className="w-full max-w-md rounded-2xl border-2 border-[#FF9600] bg-[#FFF5E6] p-5 flex flex-col gap-3.5 text-left mt-2">
                  <div className="flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-[#E58800] text-[24px] shrink-0">edit_calendar</span>
                    <div>
                      <h3 className="text-xs font-black uppercase text-[#E58800]">
                        Dời lịch nhận kho để mở lại task Check-in quá hạn
                      </h3>
                      <p className="text-xs font-bold text-[#777777] mt-0.5">
                        Task nhận kho đã quá hạn 21:00 nên không thể mở lại biên bản hoặc bàn giao tiếp. Quản lý chọn ngày nhận kho mới bên dưới để cập nhật hạn task và tiếp tục xử lý.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-black uppercase text-[#777777]">Ngày nhận kho mới *</span>
                      <DateInput
                        min={localTodayIso()}
                        value={rescheduleCheckInDate}
                        onChange={e => setRescheduleCheckInDate(e.target.value)}
                        className="duo-input text-xs font-bold bg-white"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-black uppercase text-[#777777]">Lý do dời lịch</span>
                      <input
                        type="text"
                        maxLength={300}
                        value={rescheduleCheckInReason}
                        onChange={e => setRescheduleCheckInReason(e.target.value)}
                        placeholder="VD: Khách hẹn quay lại ký biên bản bàn giao vào ngày mai..."
                        className="duo-input text-xs bg-white"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={reschedulingCheckIn || !rescheduleCheckInDate}
                      onClick={handleRescheduleCheckInFromTask}
                      className="duo-btn-blue px-4 py-2.5 text-xs gap-1.5 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">event_upcoming</span>
                      {reschedulingCheckIn ? 'Đang dời lịch...' : 'Xác nhận dời lịch nhận kho'}
                    </button>
                  </div>
                </div>
              )}

              {/* Vấn đề 3C (22/11/2026): Task phúc tra CHECK_OUT [RECHECK] bị OVERDUE → FM gia hạn xử lý ngay tại trang task */}
              {isManager && isRecheckTask
                && (task.status === 'OVERDUE' || (task.dueAt && new Date(task.dueAt) <= new Date())) && (
                <div className="w-full max-w-md rounded-2xl border-2 border-[#FF9600] bg-[#FFF5E6] p-5 flex flex-col gap-3.5 text-left mt-2">
                  <div className="flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-[#E58800] text-[24px] shrink-0">more_time</span>
                    <div>
                      <h3 className="text-xs font-black uppercase text-[#E58800]">
                        Gia hạn xử lý task kiểm tra lại nghiệm thu quá hạn (PR-S4)
                      </h3>
                      <p className="text-xs font-bold text-[#777777] mt-0.5">
                        Task phúc tra quyết toán đã quá hạn 21:00 nên nhân viên bị khóa thao tác. Quản lý chọn ngày hạn mới bên dưới để mở lại (hệ thống tự bắn chuông báo và gửi email cho khách &amp; nhân viên).
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-black uppercase text-[#777777]">Ngày hạn mới (hạn lúc 21:00, tối đa 7 ngày) *</span>
                      <DateInput
                        min={localTodayIso()}
                        value={extendDueDate}
                        onChange={e => setExtendDueDate(e.target.value)}
                        className="duo-input text-xs font-bold bg-white"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-black uppercase text-[#777777]">Lý do gia hạn *</span>
                      <input
                        type="text"
                        maxLength={500}
                        value={extendReason}
                        onChange={e => setExtendReason(e.target.value)}
                        placeholder="VD: Chờ đối chiếu lại hình ảnh hiện trạng cùng khách hàng..."
                        className="duo-input text-xs bg-white"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={extendingSupport || !extendDueDate || !extendReason.trim()}
                      onClick={handleExtendSupportSubmit}
                      className="duo-btn-blue px-4 py-2.5 text-xs gap-1.5 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">event_upcoming</span>
                      {extendingSupport ? 'Đang gia hạn...' : 'Xác nhận gia hạn task kiểm tra lại'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : isCheckOut ? (
            /* ================== FORM NGHIỆM THU TRẢ KHO & SỰ CỐ (UC-23 & UC-24) ================== */
            <div className="duo-card p-6 flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-[#4B4B4B]">
                    {isRecheckTask ? 'Kiểm tra lại ô theo khiếu nại quyết toán' : 'Biên bản nghiệm thu trả kho'}
                  </h2>
                  <p className="text-xs font-bold text-[#AFAFAF]">
                    {isRecheckTask
                      ? 'Mở ô, đối chiếu ảnh lúc nhận / trả kho, lập lại danh sách sự cố. Kết quả tạo bảng quyết toán mới gửi khách xác nhận.'
                      : 'Kiểm tra hiện trạng ô kho, thu hồi quyền truy cập và lập biên bản sự cố nếu có hư hại.'}
                  </p>
                </div>
                {!isRecheckTask && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCoChecks({
                        identityVerified: true,
                        unitEmpty: true,
                        unitClean: true,
                        lockIntact: true,
                        customerSignatureConfirmed: true,
                      });
                      setDamageCases([]);
                      setCheckOutPhotos(prev => withMockHandoverPhoto(prev, task, 'trả kho'));
                    }}
                    className="duo-btn-white px-3.5 py-2 text-xs gap-1.5"
                    title="Điền nhanh trường hợp kho nguyên vẹn 100%"
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#58CC02]">auto_fix_high</span>
                    Giả lập kho tốt
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCoChecks({
                        identityVerified: true,
                        unitEmpty: true,
                        unitClean: true,
                        lockIntact: false,
                        customerSignatureConfirmed: true,
                      });
                      // Lỗi khách vượt cọc (3.000.000đ) + 1 lỗi cơ sở → demo nợ DAMAGE_FEE và phần cơ sở tự chịu
                      const customerFault = newDamageItem(
                        'Vỡ vách ngăn do va chạm khi chuyển đồ',
                        3000000,
                        'Vách tôn bị thủng, khung biến dạng — khách xác nhận do xe đẩy hàng va vào.'
                      );
                      customerFault.evidenceImages = [createMockEvidenceDataUrl('Vách ngăn bị vỡ tại ô ' + (task.storageUnitId || ''))];
                      const facilityFault = newDamageItem(
                        'Thấm dột mái / rỉ nước từ trần',
                        800000,
                        'Nước mưa thấm từ mái tôn của cơ sở, không do khách gây ra.',
                        'FACILITY'
                      );
                      facilityFault.evidenceImages = [createMockEvidenceDataUrl('Vết thấm trần ô ' + (task.storageUnitId || ''))];
                      setDamageCases([customerFault, facilityFault]);
                      setCheckOutPhotos(prev => withMockHandoverPhoto(prev, task, 'trả kho'));
                    }}
                    className="duo-btn-white px-3.5 py-2 text-xs gap-1.5"
                    title="Điền nhanh 1 sự cố lỗi khách vượt cọc + 1 sự cố lỗi cơ sở, kèm ảnh mẫu"
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#FF9600]">report_problem</span>
                    Giả lập lỗi khách (vượt cọc)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCoChecks({
                        identityVerified: true,
                        unitEmpty: true,
                        unitClean: true,
                        lockIntact: true,
                        customerSignatureConfirmed: true,
                      });
                      const facilityFault = newDamageItem(
                        'Thấm dột mái / rỉ nước từ trần',
                        800000,
                        'Nước mưa thấm từ mái tôn của cơ sở, không do khách gây ra.',
                        'FACILITY'
                      );
                      facilityFault.evidenceImages = [createMockEvidenceDataUrl('Vết thấm trần ô ' + (task.storageUnitId || ''))];
                      setDamageCases([facilityFault]);
                      setCheckOutPhotos(prev => withMockHandoverPhoto(prev, task, 'trả kho'));
                    }}
                    className="duo-btn-white px-3.5 py-2 text-xs gap-1.5"
                    title="Điền nhanh sự cố do cơ sở: ô vẫn vào bảo trì nhưng khách được hoàn cọc đầy đủ"
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#1CB0F6]">roofing</span>
                    Giả lập lỗi cơ sở
                  </button>
                </div>
                )}
              </div>

              {isRecheckTask && (
                <div className="rounded-2xl border-2 border-[#CE82FF] bg-[#F3E8FF] p-4 text-xs font-bold text-[#4B4B4B] leading-relaxed">
                  <p className="font-black text-[#9333EA] mb-1">Yêu cầu kiểm tra lại</p>
                  <p className="whitespace-pre-line">{String(task.note || '').replace('[RECHECK]', '').trim()}</p>
                  <p className="mt-2 text-[#777777]">Danh sách sự cố bạn lập dưới đây sẽ <strong>thay</strong> danh sách lúc nghiệm thu. Ô không có sự cố lỗi khách thì để trống danh sách.</p>
                </div>
              )}

              {/* Bước 1: Điều kiện bắt buộc (Blocking) */}
              {!isRecheckTask && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-[#4B4B4B] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-[#1CB0F6]">verified_user</span>
                    1. Điều kiện bắt buộc (Phải đạt mới được trả kho)
                  </span>
                  <span className={`text-[11px] font-black ${blockingPassed ? 'text-[#58A700]' : 'text-[#FF9600]'}`}>
                    {CHECKOUT_BLOCKING_LIST.filter(i => coChecks[i.key]).length}/{CHECKOUT_BLOCKING_LIST.length} mục đạt
                  </span>
                </div>
                {CHECKOUT_BLOCKING_LIST.map(item => (
                  <label
                    key={item.key}
                    className={`flex items-start gap-3 rounded-2xl border-2 px-4 py-3 cursor-pointer select-none transition-colors ${
                      coChecks[item.key] ? 'bg-[#D7FFB8] border-[#58CC02]' : 'bg-white border-[#E5E5E5] hover:bg-[#F7F7F7]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={coChecks[item.key]}
                      onChange={e => setCoChecks(prev => ({ ...prev, [item.key]: e.target.checked }))}
                      className="mt-0.5 w-4 h-4 accent-[#58CC02]"
                    />
                    <span className="flex flex-col flex-1">
                      <span className="text-xs font-black text-[#4B4B4B]">{item.label} *</span>
                      <span className="text-[11px] font-bold text-[#AFAFAF]">{item.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              )}

              {/* Bước 2: Kiểm tra tình trạng vệ sinh & khoá (Non-blocking -> Kích hoạt UC-24) */}
              {!isRecheckTask && (
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-black uppercase text-[#4B4B4B] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-[#FF9600]">fact_check</span>
                  2. Kiểm tra hiện trạng ô kho (Bỏ chọn nếu phát hiện bẩn hoặc hư hại)
                </span>
                {CHECKOUT_CONDITION_LIST.map(item => {
                  const passed = coChecks[item.key];
                  return (
                    <label
                      key={item.key}
                      className={`flex items-start gap-3 rounded-2xl border-2 px-4 py-3 cursor-pointer select-none transition-colors ${
                        passed ? 'bg-[#D7FFB8] border-[#58CC02]' : 'bg-[#FFF5E6] border-[#FF9600]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={passed}
                        onChange={e => handleToggleCoCondition(item.key, e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-[#58CC02]"
                      />
                      <span className="flex flex-col flex-1">
                        <span className="text-xs font-black text-[#4B4B4B] flex items-center justify-between">
                          <span>{item.label}</span>
                          <span className={`text-[10px] uppercase px-2 py-0.5 rounded-lg font-black ${
                            passed ? 'bg-white/70 text-[#58A700]' : 'bg-[#FF9600] text-white'
                          }`}>
                            {passed ? 'Đạt chuẩn' : 'Không đạt → Lập sự cố'}
                          </span>
                        </span>
                        <span className="text-[11px] font-bold text-[#777777]">{item.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              )}

              {/* Bước 3: Ghi nhận sự cố hư hỏng & Ảnh bằng chứng (UC-24) */}
              <div className="rounded-2xl border-2 border-[#E5E5E5] bg-[#FAFAFA] p-4 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black uppercase text-[#4B4B4B] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px] text-[#FF4B4B]">build_circle</span>
                      3. Ghi nhận sự cố hư hỏng &amp; Ảnh bằng chứng (UC-24)
                    </h3>
                    <p className="text-[11px] font-bold text-[#AFAFAF]">
                      {conditionFailed
                        ? 'Bắt buộc nhập chi tiết hư hỏng, chi phí dự kiến và đính kèm ảnh chụp hiện trường.'
                        : 'Nếu phát hiện hư hại khác, bấm "+ Thêm sự cố" bên dưới để ghi nhận khấu trừ cọc.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddDamageItem()}
                    className="duo-btn-blue px-3.5 py-2 text-xs flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">add_circle</span>
                    Thêm hạng mục sự cố
                  </button>
                </div>

                {/* Gợi ý chọn nhanh hạng mục thường gặp */}
                {showDamageSection && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase text-[#AFAFAF] mr-1">Thêm nhanh:</span>
                    {DAMAGE_PRESETS.map(p => (
                      <button
                        key={p.title}
                        type="button"
                        onClick={() => handleAddDamageItem(p)}
                        className="px-2.5 py-1 rounded-xl bg-white border border-[#E5E5E5] hover:border-[#1CB0F6] text-[11px] font-bold text-[#4B4B4B] cursor-pointer transition-colors"
                      >
                        + {p.title} ({formatCurrency(p.cost)}){p.liableParty === 'FACILITY' ? ' · lỗi cơ sở' : ''}
                      </button>
                    ))}
                  </div>
                )}

                {damageCases.length === 0 ? (
                  <div className={`rounded-xl px-4 py-3 text-xs font-bold flex items-center gap-2 ${
                    conditionFailed
                      ? 'bg-[#FFDFDF] text-[#FF4B4B] border border-[#FF4B4B]'
                      : 'bg-[#D7FFB8]/60 text-[#58A700] border border-[#58CC02]'
                  }`}>
                    <span className="material-symbols-outlined text-[20px]">
                      {conditionFailed ? 'warning' : 'check_circle'}
                    </span>
                    {conditionFailed
                      ? 'Bạn đã đánh dấu ô kho Không sạch hoặc Khoá hư hỏng. Vui lòng bấm "+ Thêm hạng mục sự cố" để ghi nhận!'
                      : 'Ô kho nguyên vẹn, không có sự cố hư hỏng nào được ghi nhận (Hoàn 100% cọc).'}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {damageCases.map((item, idx) => (
                      <div
                        key={item.uid}
                        className="rounded-2xl bg-white border-2 border-[#FFE8CC] p-4 flex flex-col gap-3 shadow-xs"
                      >
                        <div className="flex items-center justify-between border-b border-[#F0F0F0] pb-2">
                          <span className="text-xs font-black uppercase text-[#E58800] flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">report</span>
                            Hạng mục sự cố #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDamageItem(item.uid)}
                            className="text-xs font-black text-[#FF4B4B] hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                            Xoá mục này
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-black uppercase text-[#777777]">Tên / Loại sự cố *</span>
                            <input
                              type="text"
                              maxLength={150}
                              value={item.title}
                              onChange={e => handleUpdateDamageField(item.uid, 'title', e.target.value)}
                              placeholder="VD: Vệ sinh rác tồn đọng, Hỏng khoá SmartLock..."
                              className="duo-input text-xs"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-black uppercase text-[#777777]">Chi phí đền bù (VNĐ) *</span>
                            <input
                              type="number"
                              min={0}
                              step={10000}
                              value={item.estimatedCost}
                              onChange={e => handleUpdateDamageField(item.uid, 'estimatedCost', e.target.value)}
                              placeholder="0"
                              className="duo-input text-xs font-mono font-black text-[#FF4B4B]"
                            />
                          </label>
                        </div>

                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-black uppercase text-[#777777]">Mô tả chi tiết hiện trạng</span>
                          <input
                            type="text"
                            maxLength={1000}
                            value={item.description}
                            onChange={e => handleUpdateDamageField(item.uid, 'description', e.target.value)}
                            placeholder="Mô tả rõ vị trí, mức độ hư hại để đối chiếu..."
                            className="duo-input text-xs"
                          />
                        </label>

                        {/* UC-24: ai chịu lỗi — quyết định có trừ vào cọc của khách không */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-black uppercase text-[#777777]">Lỗi do ai *</span>
                          <div className="grid grid-cols-2 gap-2">
                            {LIABLE_OPTIONS.map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleUpdateDamageField(item.uid, 'liableParty', opt.value)}
                                className={`rounded-xl border-2 px-3 py-2 text-left cursor-pointer transition-colors ${
                                  item.liableParty === opt.value ? opt.cls : 'border-[#E5E5E5] bg-white text-[#AFAFAF]'
                                }`}
                              >
                                <span className="block text-xs font-black">{opt.label}</span>
                                <span className="block text-[10px] font-bold">{opt.hint}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Khu vực Upload ảnh bằng chứng */}
                        <div className="flex flex-col gap-2 pt-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-black uppercase text-[#4B4B4B] flex items-center gap-1">
                              <span className="material-symbols-outlined text-[16px] text-[#1CB0F6]">photo_camera</span>
                              Ảnh bằng chứng hiện trường * ({item.evidenceImages.length} ảnh)
                            </span>
                            <label className="duo-btn-white px-3 py-1.5 text-xs gap-1.5 cursor-pointer">
                              <span className="material-symbols-outlined text-[16px] text-[#1CB0F6]">upload_file</span>
                              Chọn ảnh / Chụp ảnh
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={e => {
                                  handleUploadEvidenceFiles(item.uid, e.target.files);
                                  e.target.value = '';
                                }}
                                className="hidden"
                              />
                            </label>
                          </div>

                          {/* Nhập link ảnh nếu muốn */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={item.urlInput || ''}
                              onChange={e => handleUpdateDamageField(item.uid, 'urlInput', e.target.value)}
                              placeholder="Hoặc dán link URL ảnh bằng chứng tại đây..."
                              className="duo-input flex-1 text-xs py-1.5"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddEvidenceUrl(item.uid)}
                              className="duo-btn-gray px-3 py-1.5 text-xs"
                            >
                              Thêm link
                            </button>
                          </div>

                          {/* Danh sách thumbnail ảnh đã tải lên */}
                          {item.evidenceImages.length === 0 ? (
                            <p className="text-[11px] font-bold text-[#FF4B4B] flex items-center gap-1">
                              <span className="material-symbols-outlined text-[15px]">error</span>
                              Bắt buộc đính kèm ít nhất 1 ảnh chụp bằng chứng cho hạng mục sự cố này.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-2.5 pt-1">
                              {item.evidenceImages.map((imgSrc, imgIdx) => (
                                <div
                                  key={imgIdx}
                                  className="relative w-20 h-20 rounded-xl border-2 border-[#84D8FF] overflow-hidden bg-[#F7F7F7] group"
                                >
                                  <img
                                    src={imgSrc}
                                    alt={`Evidence ${imgIdx + 1}`}
                                    onClick={() => setPreviewImage(imgSrc)}
                                    className="w-full h-full object-cover cursor-pointer"
                                    title="Bấm để xem ảnh lớn"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveEvidenceImage(item.uid, imgIdx)}
                                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#FF4B4B] text-white flex items-center justify-center text-xs font-black shadow-sm cursor-pointer"
                                    title="Xoá ảnh này"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bước 4: Bảng đối soát & Quyết toán tài chính hoàn tiền (PR-O2, PR-O11, PR-O14) */}
              {!isRecheckTask && (
              <div className="rounded-2xl border-2 border-[#84D8FF] bg-[#DDF4FF]/50 p-4 flex flex-col gap-2">
                <span className="text-xs font-black uppercase text-[#1899D6] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">calculate</span>
                  4. Bảng tính quyết toán hoàn tiền (Tự động theo Business Rules)
                </span>
                <div className="flex justify-between text-xs font-bold text-[#4B4B4B]">
                  <span>Tiền cọc hợp đồng đang giữ:</span>
                  <span className="font-black">{formatCurrency(depositHeld)}</span>
                </div>
                {totalDamageCost > 0 && (
                  <div className="flex justify-between text-xs font-bold text-[#4B4B4B]">
                    <span>Sự cố lỗi khách ({damageCases.filter(d => d.liableParty !== 'FACILITY').length} hạng mục):</span>
                    <span className="font-black text-[#FF4B4B]">- {formatCurrency(totalDamageCost)}</span>
                  </div>
                )}
                {facilityDamageCost > 0 && (
                  <div className="flex justify-between text-xs font-bold text-[#1899D6]">
                    <span>Sự cố lỗi cơ sở (cơ sở tự chịu, không trừ cọc):</span>
                    <span className="font-black">{formatCurrency(facilityDamageCost)}</span>
                  </div>
                )}
                {(estimatedTotalPenalty > 0 || taskOverdueFee.lateFeeWaived || taskOverdueFee.overstayFeeWaived) && (
                  <div className="flex flex-col gap-1 py-1">
                    <div className="flex justify-between text-xs font-bold text-[#4B4B4B]">
                      <span>Khấu trừ tổng tiền phạt quá hạn {daysPast > 0 ? `(${daysPast} ngày)` : ''}:</span>
                      <span className="font-black text-[#FF4B4B]">- {formatCurrency(estimatedTotalPenalty)}</span>
                    </div>
                    <div className="pl-3 border-l-2 border-[#FCA5A5] space-y-0.5 text-[11px] font-bold text-[#777777]">
                      <div className="flex justify-between">
                        <span>• Phí phạt trễ hạn:</span>
                        <span className="text-[#FF4B4B]">{taskOverdueFee.lateFeeWaived ? 'Đã miễn (0₫)' : `- ${formatCurrency(estimatedLateFee)}`}</span>
                      </div>
                      {(estimatedOverstayFee > 0 || taskOverdueFee.overstayFeeWaived) && (
                        <div className="flex justify-between">
                          <span>• Phí chiếm dụng ô:</span>
                          <span className="text-[#FF4B4B]">{taskOverdueFee.overstayFeeWaived ? 'Đã miễn (0₫)' : `- ${formatCurrency(estimatedOverstayFee)}`}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex justify-between text-xs font-bold text-[#4B4B4B]">
                  <span>Tiền cọc hoàn lại:</span>
                  <span className="font-black text-[#026AA2]">{formatCurrency(estimatedDepositRefund)}</span>
                </div>
                {isEarlyCheckout && (
                  <div className="flex flex-col gap-1.5 bg-[#EAFBE0] p-3 rounded-xl border border-[#D0F8AB] text-xs font-bold text-[#2B5300]">
                    <div className="flex justify-between items-center border-b border-[#D0F8AB] pb-1">
                      <span className="font-black text-[#58A700]">Hoàn tiền thuê các tháng còn lại (PR-O2 - Gói {cycleMonths} tháng):</span>
                      <span className="font-black text-sm text-[#58A700]">+ {formatCurrency(estimatedEarlyRentRefund)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-[#2B5300]/90">
                      <span>• Tiền thuê khách đã đóng ({cycleMonths} tháng):</span>
                      <span className="font-black">{formatCurrency(rentPaid)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-[#2B5300]/90">
                      <span>• Trừ thời gian đã sử dụng ({usedMonths} tháng × giá gốc {formatCurrency(basePrice)}):</span>
                      <span className="font-black text-[#FF4B4B]">- {formatCurrency(basePrice * usedMonths)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-[#2B5300]/90">
                      <span>• Trừ phí phạt trả kho sớm (1 tháng giá gốc):</span>
                      <span className="font-black text-[#FF4B4B]">- {formatCurrency(breakFee)}</span>
                    </div>
                  </div>
                )}
                <div className="border-t border-[#84D8FF] pt-2 flex justify-between items-center">
                  <span className="text-xs font-black uppercase text-[#1899D6]">Tổng số tiền hoàn trả khách:</span>
                  <span className="text-xl font-black text-[#58A700]">{formatCurrency(estimatedTotalRefund)}</span>
                </div>
                {estimatedExcessDebt > 0 ? (
                  <div className="rounded-xl bg-[#FFDFDF] border border-[#FF4B4B] px-3 py-2 flex flex-col gap-0.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-[#FF4B4B]">Khoản nợ vượt cọc khách cần thanh toán thêm:</span>
                      <span className="font-black text-[#FF4B4B] text-base">{formatCurrency(estimatedExcessDebt)}</span>
                    </div>
                    <span className="text-[11px] font-bold text-[#FF4B4B]/90">
                      Hệ thống sẽ ghi nhận công nợ {totalDamageCost > 0 && estimatedOverstayFee > 0 ? 'DAMAGE_FEE / OVERSTAY_FEE' : estimatedOverstayFee > 0 ? 'OVERSTAY_FEE' : 'DAMAGE_FEE'} (PENDING). Khách cần thanh toán khoản này ở mục Thanh toán.
                    </span>
                  </div>
                ) : (
                  <span className="text-[11px] font-bold text-[#1899D6]">
                    Bảng tính dự kiến. Sau khi xác nhận nghiệm thu, khách nhận bảng quyết toán trên tài khoản và phải xác nhận mới kết thúc hợp đồng
                    (dương → Quản lý hoàn tiền; âm → khách thanh toán thêm — D-21).
                  </span>
                )}
              </div>
              )}

              {/* BR-121: ảnh hiện trạng ô lúc trả — so với ảnh lúc nhận kho để biết hư hỏng phát sinh khi nào */}
              {!isRecheckTask && (
              <HandoverPhotoPicker
                images={checkOutPhotos}
                onChange={setCheckOutPhotos}
                label="Ảnh hiện trạng ô lúc trả kho"
                hint="Chụp toàn cảnh bên trong ô, cửa và khoá. Ảnh lưu vào biên bản, khách xem lại được — là căn cứ khi có tranh chấp."
                mockLabel={`Hiện trạng ô ${task.storageUnitId || ''} lúc trả kho`}
              />
              )}

              {/* Ghi chú biên bản */}
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black uppercase text-[#AFAFAF]">
                  {isRecheckTask ? 'Kết quả kiểm tra lại (gửi khách và quản lý, tối thiểu 10 ký tự) *' : 'Ghi chú biên bản nghiệm thu'}
                </span>
                <textarea
                  value={coNotes}
                  onChange={e => setCoNotes(e.target.value)}
                  rows={2}
                  placeholder={isRecheckTask
                    ? 'Ví dụ: đối chiếu ảnh nhận kho, vết trầy vách đã có từ trước → bỏ phí; khoá hỏng do khách → giữ nguyên'
                    : 'Ghi chú thêm về quá trình trả kho, bàn giao chìa khoá/thẻ từ...'}
                  className="duo-input resize-none text-xs"
                />
                <span className={`text-[11px] font-bold self-end ${coNotes.length > NOTES_MAX ? 'text-[#FF4B4B]' : 'text-[#AFAFAF]'}`}>
                  {coNotes.length}/{NOTES_MAX}
                </span>
              </label>

              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={!canSubmitCheckOut}
                className="duo-btn-green px-5 py-3 text-sm gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[20px]">task_alt</span>
                {isRecheckTask ? 'Gửi kết quả kiểm tra lại' : 'Xác nhận hoàn tất nghiệm thu trả kho'}
              </button>
              {!canSubmitCheckOut && !submitting && (
                <p className="text-[11px] font-bold text-[#FF4B4B] text-center -mt-3">
                  {isRecheckTask
                    ? (damageValidationError || 'Ghi kết quả kiểm tra lại (tối thiểu 10 ký tự).')
                    : !blockingPassed
                    ? 'Vui lòng hoàn thành đủ 3 mục Điều kiện bắt buộc (CCCD, Ô trống, Chữ ký khách).'
                    : damageValidationError
                      || (checkOutPhotos.length === 0 ? 'Cần ít nhất 1 ảnh hiện trạng ô lúc trả kho.' : 'Vui lòng kiểm tra lại thông tin biên bản.')}
                </p>
              )}
            </div>
          ) : (
            /* ================== FORM CHECK-IN (UC-18) ================== */
            <div className="duo-card p-6 flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-[#4B4B4B]">{handover?.status === 'ACCEPTED' ? 'Hoàn tất bàn giao' : 'Biên bản bàn giao'}</h2>
                  <p className="text-xs font-bold text-[#AFAFAF]">{handover?.status === 'ACCEPTED'
                    ? `Khách đã đồng ý nhận ô ${handover.storage_unit_id}. Cấp PIN/RFID để kích hoạt hợp đồng.`
                    : 'Dẫn khách đến ô, kiểm tra hiện trạng và gửi biên bản nháp để khách tự xác nhận.'}</p>
                </div>
                {handover?.status !== 'ACCEPTED' && <button
                  type="button"
                  onClick={() => {
                    setChecks(CHECKIN_CHECKLIST.reduce((acc, item) => ({ ...acc, [item.key]: true }), {}));
                    setCheckInEvidence(Object.fromEntries(CHECKIN_CHECKLIST.map(item => [item.key,
                      [createMockEvidenceDataUrl(`${item.label} - ô ${task.storageUnitId || ''}`, 'ẢNH MINH CHỨNG CHECK-IN')]])));
                  }}
                  className="duo-btn-white px-4 py-2 text-xs gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>
                  Giả lập hoàn thiện
                </button>}
              </div>

              {handover?.status === 'REJECTED' && <div className="rounded-2xl border-2 border-[#FFB4B4] bg-[#FFF4F4] p-4 flex flex-col gap-2">
                <p className="text-sm font-black text-[#B42318]">Khách từ chối biên bản — xử lý trên task check-in này</p>
                <p className="text-xs font-bold text-[#4B4B4B] whitespace-pre-line">Lý do: {handover.rejection_reason || 'Không có lý do'}</p>
                <p className="text-xs font-bold text-[#4B4B4B]">Nội dung: {rejectedIssueTypes.map(type => ({ UNIT_CONDITION: 'Ô kho/cơ sở', GOODS_VALUE: 'Giá trị hàng', GOODS_INFORMATION: 'Hàng/chứng từ', OTHER: 'Khác' }[type] || type)).join(', ')}</p>
                {handover.customerEvidenceImages?.length > 0 && <PhotoGrid images={handover.customerEvidenceImages} />}
                <p className="text-xs font-bold text-[#777777]">Kiểm tra và xử lý cùng khách, cập nhật ảnh hoặc giá trị hàng rồi gửi biên bản mới để khách xác nhận.</p>
              </div>}

              {!isManager && handover?.status !== 'ACCEPTED' && <details className="rounded-2xl border-2 border-[#FF9600] bg-[#FFF8EE] p-4">
                <summary className="cursor-pointer text-xs font-black text-[#B45309]">Không thể bàn giao hoặc không thống nhất? Báo Quản lý</summary>
                <div className="mt-3 flex flex-col gap-3">
                  <select className="duo-input text-xs" value={blockerType} onChange={e => setBlockerType(e.target.value)}>
                    <option value="FACILITY_ISSUE">Ô gặp sự cố, không thể bàn giao</option>
                    <option value="GOODS_VALUE_DISPUTE">Không thống nhất giá trị hàng</option>
                    <option value="OTHER_DISPUTE">Không thể thống nhất nội dung khác</option>
                  </select>
                  <p className="text-xs font-bold text-[#4B4B4B]">Công việc bàn giao sẽ chờ Quản lý quyết định; không cấp quyền vào kho.</p>
                  <textarea className="duo-input text-xs" value={blockerNote} onChange={e => setBlockerNote(e.target.value)} maxLength={500} placeholder="Mô tả sự cố và vì sao không thể bàn giao (10–500 ký tự)" />
                  <HandoverPhotoPicker images={blockerPhotos} onChange={setBlockerPhotos} label={blockerType === 'FACILITY_ISSUE' ? 'Ảnh sự cố *' : 'Ảnh/chứng từ nếu có'} maxPhotos={10} />
                  <button type="button" className="duo-btn-red px-4 py-2 text-xs" disabled={reportingBlocker || blockerNote.trim().length < 10 || (blockerType === 'FACILITY_ISSUE' && blockerPhotos.length === 0)}
                    onClick={async () => { try { setReportingBlocker(true); await reportCheckInBlocker(task.id, { note: blockerNote.trim(), issueType: blockerType, evidenceImages: blockerPhotos }); await loadTask(); setToast({ type: 'success', message: 'Đã báo Quản lý; công việc bàn giao đang chờ phương án xử lý.' }); } catch (err) { setToast({ type: 'error', message: err.response?.data?.message || 'Không gửi được báo cáo.' }); } finally { setReportingBlocker(false); } }}>Gửi Quản lý xử lý</button>
                </div>
              </details>}

              {handover?.resolutionNote && <div className="rounded-2xl border border-[#84D8FF] bg-[#F0F9FF] p-4 flex flex-col gap-2">
                <p className="text-xs font-black text-[#0369A1]">FM đã mở lại check-in · ô {handover.resolvedUnitId || task.storageUnitId}</p>
                <p className="text-xs text-[#4B4B4B]">{handover.resolutionNote}</p>
                {handover.resolutionEvidenceImages?.length > 0 && <PhotoGrid images={handover.resolutionEvidenceImages} />}
                <p className="text-xs font-bold text-[#777777]">Staff cần cùng khách kiểm tra lại và lập biên bản mới.</p>
              </div>}

              {/* BR-131: loại hàng khách khai báo khi đặt kho — đối chiếu với mục 6 */}
              {handover?.status !== 'ACCEPTED' && <>
              <div className="rounded-2xl border-2 border-[#FFC800] bg-[#FFFBEA] px-4 py-3">
                <p className="text-[11px] font-black uppercase text-[#B78900] mb-1.5">Hàng khách khai báo</p>
                {task.goodsCategories?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {task.goodsCategories.map(name => (
                      <span key={name} className="text-[11px] font-black bg-white border border-[#FFC800] text-[#4B4B4B] px-2 py-0.5 rounded-full">{name}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-bold text-[#777777]">Đơn đặt trước 05/11/2026 — chưa khai báo loại hàng, hỏi trực tiếp khách.</p>
                )}
                {task.goodsDescription && <p className="text-xs font-bold text-[#4B4B4B] mt-1.5">Mô tả: {task.goodsDescription}</p>}
                <p className="mt-2 text-xs font-black text-[#4B4B4B]">
                  Giá trị khách khai: <span className="text-[#1CB0F6]">{formatCurrency(task.declaredGoodsValue || 0)}</span>
                </p>
                {task.goodsValueEvidenceImages?.length > 0 ? <div className="mt-2">
                  <p className="mb-1 text-[11px] font-black uppercase text-[#B78900]">Chứng từ khách tải lên</p>
                  <PhotoGrid images={task.goodsValueEvidenceImages} />
                </div> : <p className="mt-1 text-[11px] font-bold text-[#FF4B4B]">Đơn cũ chưa có chứng từ; staff phải ghi nhận giá trị thực tế.</p>}
                <p className="text-[11px] font-bold text-[#777777] mt-1.5">
                  Không bàn giao nếu hàng không khớp khai báo hoặc có chất dễ cháy nổ, hàng cấm.
                </p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className={`rounded-xl border-2 p-3 cursor-pointer ${goodsValueAssessment === 'MATCHED' ? 'border-[#58CC02] bg-[#D7FFB8]' : 'border-[#E5E5E5] bg-white'}`}>
                    <input type="radio" name="goodsValueAssessment" value="MATCHED"
                      checked={goodsValueAssessment === 'MATCHED'} disabled={Boolean(fmResolvedGoodsValue) || !Number(task.declaredGoodsValue)}
                      onChange={() => setGoodsValueAssessment('MATCHED')} className="mr-2 accent-[#58CC02]" />
                    <span className="text-xs font-black text-[#4B4B4B]">Khớp giá trị khách khai</span>
                    <span className="mt-1 block text-[10px] font-bold text-[#777777]">Xác nhận {formatCurrency(task.declaredGoodsValue || 0)}</span>
                  </label>
                  <label className={`rounded-xl border-2 p-3 cursor-pointer ${goodsValueAssessment === 'ADJUSTED' ? 'border-[#1CB0F6] bg-[#DDF4FF]' : 'border-[#E5E5E5] bg-white'}`}>
                    <input type="radio" name="goodsValueAssessment" value="ADJUSTED"
                      checked={goodsValueAssessment === 'ADJUSTED'} disabled={Boolean(fmResolvedGoodsValue)} onChange={() => setGoodsValueAssessment('ADJUSTED')}
                      className="mr-2 accent-[#1CB0F6]" />
                    <span className="text-xs font-black text-[#4B4B4B]">Đề xuất giá trị khác</span>
                    <span className="mt-1 block text-[10px] font-bold text-[#777777]">Khách sẽ xác nhận trong cùng biên bản.</span>
                  </label>
                </div>
                {goodsValueAssessment === 'ADJUSTED' && <div className="mt-2 grid grid-cols-1 gap-2">
                  {fmResolvedGoodsValue ? <div className="rounded-xl border-2 border-[#58CC02] bg-[#F1FFE8] px-3 py-2">
                    <p className="text-[10px] font-black uppercase text-[#4B8F00]">Giá trị FM đã thẩm định · không được sửa</p>
                    <p className="mt-1 text-lg font-black text-[#168A00]">{formatCurrency(fmResolvedGoodsValue)}</p>
                    <p className="mt-1 text-[11px] font-bold text-[#777777]">{fmResolvedGoodsValueNote}</p>
                  </div> : <>
                    <input type="number" min="1" max="10000000000" step="100000" value={assessedGoodsValue}
                      onChange={e => setAssessedGoodsValue(e.target.value)} placeholder="Giá trị staff đề xuất" className="duo-input" />
                    <textarea value={goodsValueAssessmentNote} onChange={e => setGoodsValueAssessmentNote(e.target.value)}
                      maxLength={1000} rows={2} placeholder="Lý do điều chỉnh (ít nhất 5 ký tự)" className="duo-input resize-none" />
                  </>}
                </div>}
              </div>

              {/* Checklist 6 mục */}
              <div className="flex flex-col gap-2">
                {CHECKIN_CHECKLIST.map(item => (
                  <div key={item.key} className="flex flex-col gap-2 rounded-2xl border-2 border-[#E5E5E5] p-3">
                  <label
                    className={`flex items-start gap-3 rounded-2xl border-2 px-4 py-3 cursor-pointer select-none transition-colors ${
                      checks[item.key] ? 'bg-[#D7FFB8] border-[#58CC02]' : 'bg-white border-[#E5E5E5] hover:bg-[#F7F7F7]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checks[item.key]}
                      onChange={e => setChecks(prev => ({ ...prev, [item.key]: e.target.checked }))}
                      className="mt-0.5 w-4 h-4 accent-[#58CC02]"
                    />
                    <span className="flex flex-col flex-1">
                      <span className="text-xs font-black text-[#4B4B4B]">{item.label}</span>
                      <span className="text-[11px] font-bold text-[#AFAFAF]">{item.hint}</span>
                    </span>
                  </label>
                  <HandoverPhotoPicker
                    images={checkInEvidence[item.key] || []}
                    onChange={images => setCheckInEvidence(prev => ({ ...prev, [item.key]: images }))}
                    label={`Ảnh minh chứng: ${item.label}`}
                    hint={item.key === 'identityVerified' ? 'Nếu chụp CCCD, che bớt số và thông tin không cần thiết.' : 'Chụp đúng mục này tại ô kho đang bàn giao.'}
                    mockLabel={`${item.label} - ô ${task.storageUnitId || ''}`}
                    maxPhotos={Math.max((checkInEvidence[item.key] || []).length, 10 - checkInPhotoCount + (checkInEvidence[item.key] || []).length)}
                  />
                  </div>
                ))}
                <p className={`text-[11px] font-black ${allCheckInChecked ? 'text-[#58A700]' : 'text-[#AFAFAF]'}`}>
                  Đã kiểm tra {CHECKIN_CHECKLIST.filter(item => checks[item.key]).length}/{CHECKIN_CHECKLIST.length} mục · Có ảnh cho {CHECKIN_CHECKLIST.filter(item => (checkInEvidence[item.key] || []).length).length}/{CHECKIN_CHECKLIST.length} mục · Tổng {checkInPhotoCount}/10 ảnh
                </p>
              </div>

              </>}

              {/* Cấp mã PIN & thẻ RFID */}
              {handover?.status === 'ACCEPTED' &&
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border-2 border-[#84D8FF] bg-[#DDF4FF]/50 p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-[#1899D6] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">pin</span>
                      Mã PIN SmartLock (6 số)
                    </span>
                    <button
                      type="button"
                      onClick={fetchPin}
                      disabled={pinLoading}
                      className="text-[11px] font-black text-[#1CB0F6] hover:underline cursor-pointer"
                    >
                      {pinLoading ? 'Đang tạo...' : 'Đổi mã'}
                    </button>
                  </div>
                  <div className="font-mono text-2xl font-black tracking-[0.25em] text-[#4B4B4B] text-center py-1">
                    {pin || '------'}
                  </div>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-black uppercase text-[#AFAFAF]">Mã thẻ từ RFID *</span>
                  <div className="duo-input flex items-center gap-1 font-mono font-bold">
                    <span className="text-[#1CB0F6] select-none">RFID-</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={rfid.startsWith('RFID-') ? rfid.slice(5) : ''}
                      onChange={e => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 5);
                        setRfid(`RFID-${digits}`);
                      }}
                      placeholder="12345"
                      maxLength={5}
                      pattern="[0-9]{5}"
                      className="min-w-0 flex-1 bg-transparent outline-none font-mono font-bold"
                      aria-label="5 chữ số mã thẻ RFID"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-[#AFAFAF]">Tiền tố RFID- được cố định, nhân viên chỉ nhập đúng 5 chữ số.</span>
                </label>
              </div>}

              {handover?.status !== 'ACCEPTED' && <>
              {/* Ghi chú */}
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black uppercase text-[#AFAFAF]">Ghi chú</span>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Tình trạng ô, đồ khách mang vào, lưu ý khác..."
                  className="duo-input resize-none"
                />
                <span className={`text-[11px] font-bold self-end ${notes.length > NOTES_MAX ? 'text-[#FF4B4B]' : 'text-[#AFAFAF]'}`}>
                  {notes.length}/{NOTES_MAX}
                </span>
              </label>

              </>}

              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={!canSubmitCheckIn}
                className="duo-btn-green px-5 py-3 text-sm gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
                {handover?.status === 'ACCEPTED' ? 'Hoàn tất bàn giao và cấp quyền truy cập' : 'Gửi biên bản cho khách xác nhận'}
              </button>
              {!canSubmitCheckIn && !submitting && (
                <p className="text-[11px] font-bold text-[#AFAFAF] text-center -mt-3">
                  {handover?.status === 'ACCEPTED'
                    ? (!/^\d{6}$/.test(pin) ? 'Cần mã PIN 6 số.' : 'Mã thẻ phải có dạng RFID-12345.')
                    : (!allCheckInChecked ? `Cần tick đủ ${CHECKIN_CHECKLIST.length} mục kiểm tra.`
                      : !allCheckInPhotos ? 'Mỗi mục kiểm tra cần một ảnh minh chứng riêng.'
                        : !goodsValueAssessmentValid ? 'Cần ghi nhận giá trị hàng hợp lệ và lý do điều chỉnh.' : 'Kiểm tra lại biên bản.')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal phóng to xem ảnh bằng chứng */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="duo-card max-w-2xl w-full p-4 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-[#4B4B4B] flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px] text-[#1CB0F6]">image</span>
                Xem ảnh bằng chứng hiện trường
              </span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="duo-btn-gray px-3 py-1 text-xs"
              >
                Đóng
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-[#F7F7F7] flex items-center justify-center max-h-[70vh]">
              <img src={previewImage} alt="Preview" className="max-w-full max-h-[70vh] object-contain" />
            </div>
          </div>
        </div>
      )}

      <TaskConfirmDialog
        open={confirmOpen}
        icon={isCheckOut ? 'fact_check' : 'how_to_reg'}
        title={isCheckOut ? 'Xác nhận hoàn tất nghiệm thu trả kho?' : handover?.status === 'ACCEPTED' ? 'Hoàn tất check-in?' : 'Gửi biên bản cho khách xác nhận?'}
        message={
          isCheckOut
            ? `Hợp đồng ${task.contractCode} sẽ chuyển sang "Đã chấm dứt", thu hồi mã PIN/RFID. ${
                conditionFailed || damageCases.length > 0
                  ? `Ghi nhận ${damageCases.length} sự cố (trừ cọc phần lỗi khách: ${formatCurrency(totalDamageCost)}${
                      facilityDamageCost > 0 ? `, cơ sở tự chịu: ${formatCurrency(facilityDamageCost)}` : ''
                    }), ô kho chuyển sang "Bảo trì" và sinh task bảo trì. `
                  : 'Ô kho nguyên vẹn sẽ chuyển sang "Trống (AVAILABLE)". '
              }Tổng tiền hoàn trả khách: ${formatCurrency(estimatedTotalRefund)}${
                estimatedEarlyRentRefund > 0
                  ? ` (Cọc: ${formatCurrency(estimatedDepositRefund)} + Hoàn trả sớm: ${formatCurrency(estimatedEarlyRentRefund)})`
                  : ''
              }${
                estimatedExcessDebt > 0 ? ` (Khách nợ vượt cọc: ${formatCurrency(estimatedExcessDebt)})` : ''
              }.`
            : handover?.status === 'ACCEPTED'
              ? `Khách đã đồng ý ô ${handover.storage_unit_id}. Hệ thống sẽ kích hoạt hợp đồng ${task.contractCode} và cấp PIN/RFID.`
              : `Khách sẽ thấy mã ô và ảnh hiện trạng để tự đồng ý hoặc từ chối. Hợp đồng ${task.contractCode} chưa kích hoạt ở bước này.`
        }
        confirmLabel="Xác nhận"
        submitting={submitting}
        onConfirm={isCheckOut ? handleCheckOutSubmit : handleCheckInSubmit}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Dialog xác nhận Hoàn tiền (Refund) */}
      <TaskConfirmDialog
        open={confirmRefundOpen}
        icon="payments"
        tone="green"
        title="Xác nhận đã chuyển tiền hoàn trả?"
        message={
          task.contractCode
            ? `Quản lý đã chuyển khoản thành công tổng số tiền hoàn (${effectiveRefundAmount > 0 ? formatCurrency(effectiveRefundAmount) : (parsedRefund?.refundAmount || '')}) cho khách ${task.customerName || ''}. Hệ thống sẽ chính thức đóng công việc hoàn tiền và cập nhật giao dịch.`
            : `Quản lý đã chuyển tiền hoàn (${parsedRefund?.refundAmount || ''}) cho khách ${task.customerName || parsedRefund?.customerName || ''}. Hệ thống sẽ đóng công việc và cập nhật giao dịch sang THÀNH CÔNG.`
        }
        confirmLabel="Xác nhận đã chuyển tiền"
        submitting={submitting}
        onConfirm={handleSubmitRefund}
        onCancel={() => setConfirmRefundOpen(false)}
      />

      {/* ==================== MODAL XÁC NHẬN LẦN 2 CHO STAFF (DOUBLE CONFIRMATION) ==================== */}
      {confirmSupportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="duo-card bg-white w-full max-w-[560px] max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 border-b-2 border-[#E5E5E5] pb-3">
              <div className="w-10 h-10 rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] text-[#58A700] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">verified</span>
              </div>
              <div>
                <h3 className="text-base font-black text-[#4B4B4B]">
                  Xác nhận lần 2: Kiểm tra kết quả xử lý hỗ trợ
                </h3>
                <p className="text-[11px] font-bold text-[#AFAFAF]">
                  Rà soát kỹ trước khi hệ thống gửi phản hồi chính thức cho khách hàng
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 rounded-2xl bg-[#F7F7F7] border border-[#E5E5E5] p-4 text-xs font-bold text-[#4B4B4B]">
              <div className="flex justify-between items-center pb-2 border-b border-[#E5E5E5]">
                <span className="text-[#777777]">Phiếu yêu cầu:</span>
                <span className="font-black text-[#1CB0F6]">#{task.ticketCode || task.supportRequestId} · Ô {task.storageUnitId}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-[#E5E5E5]">
                <span className="text-[#777777]">Loại sự cố:</span>
                <span className="font-black text-[#4B4B4B]">
                  {SUPPORT_ISSUE_LABEL[task.issueType] || task.issueType}
                  {task.subCategory ? ` — ${task.subCategory}` : ''}
                </span>
              </div>

              {task.issueType === 'SECURITY' && (
                <div className="flex justify-between items-center pb-2 border-b border-[#E5E5E5]">
                  <span className="text-[#777777]">Kết luận an ninh:</span>
                  <span className={`px-2 py-0.5 rounded-md font-black text-[11px] ${
                    securityLockStatus === 'TAMPERED'
                      ? 'bg-[#FFDFDF] text-[#FF4B4B]'
                      : 'bg-[#D7FFB8] text-[#58A700]'
                  }`}>
                    {securityLockStatus === 'TAMPERED' ? 'CÓ DẤU VẾT BẤT THƯỜNG / CẠY PHÁ' : 'Khóa & Niêm phong nguyên vẹn'}
                  </span>
                </div>
              )}

              {task.issueType === 'FACILITY_DAMAGE' && (
                <div className="flex justify-between items-center pb-2 border-b border-[#E5E5E5]">
                  <span className="text-[#777777]">Biện pháp xử lý:</span>
                  <span className="font-black text-[#E58800]">
                    {repairStatus === 'ESCALATED_MAINTENANCE'
                      ? 'Chuyển sang quy trình Bảo trì ô kho (Task MAINTENANCE)'
                      : 'Đã khắc phục / sửa chữa xong tại chỗ'}
                  </span>
                </div>
              )}

              {isClaimInspection && preliminaryCause && (
                <div className="flex justify-between items-center pb-2 border-b border-[#E5E5E5]">
                  <span className="text-[#777777]">Nguyên nhân sơ bộ:</span>
                  <span className="font-black text-[#1CB0F6]">{preliminaryCause}</span>
                </div>
              )}

              <div className="flex justify-between items-center pb-2 border-b border-[#E5E5E5]">
                <span className="text-[#777777]">Bằng chứng ảnh đính kèm:</span>
                <span className="font-black text-[#4B4B4B]">{resolvedImagesForPreview.length} hình ảnh</span>
              </div>

              {resolvedImagesForPreview.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {resolvedImagesForPreview.slice(0, 4).map((url, i) => (
                    <img key={i} src={url} alt={`Ảnh ${i + 1}`} className="w-12 h-12 rounded-lg object-cover border border-[#E5E5E5]" />
                  ))}
                  {resolvedImagesForPreview.length > 4 && (
                    <div className="w-12 h-12 rounded-lg bg-[#E5E5E5] text-[#777777] font-black flex items-center justify-center text-xs">
                      +{resolvedImagesForPreview.length - 4}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-black uppercase text-[#777777]">
                Nội dung phản hồi gửi khách hàng:
              </span>
              <div className="p-3.5 rounded-xl bg-[#F0F9FF] border border-[#BAE6FD] text-xs font-bold text-[#0369A1] whitespace-pre-line leading-relaxed max-h-36 overflow-y-auto">
                {resolutionNote.trim()}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t-2 border-[#E5E5E5]">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmSupportOpen(false)}
                className="duo-btn-gray px-4 py-2.5 text-xs flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[17px]">arrow_back</span>
                Quay lại chỉnh sửa
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleResolveSupportSubmit}
                className="duo-btn-green px-5 py-2.5 text-xs flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                {submitting ? 'Đang gửi phản hồi...' : 'Xác nhận & Gửi phản hồi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL CHỈNH SỬA PHẢN HỒI KHI TICKET ĐANG RESOLVED ==================== */}
      {editResolutionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="duo-card bg-white w-full max-w-[560px] max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-[#E5E5E5] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#1CB0F6] text-[24px]">edit_note</span>
                <h3 className="text-base font-black text-[#4B4B4B]">Chỉnh sửa nội dung phản hồi</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditResolutionOpen(false)}
                className="text-[#AFAFAF] hover:text-[#4B4B4B] font-black text-lg p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs font-bold text-[#777777]">
              Phiếu đang ở trạng thái <b>Chờ khách xác nhận (RESOLVED)</b>. Bạn có thể đính chính lại câu chữ hoặc cập nhật ảnh nếu trước đó gõ nhầm.
            </p>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-black uppercase text-[#777777]">Nội dung kết quả xử lý *</span>
              <textarea
                rows={4}
                maxLength={NOTES_MAX}
                value={editResolutionNote}
                onChange={e => setEditResolutionNote(e.target.value)}
                placeholder="Nhập nội dung đã chỉnh sửa..."
                className="duo-input resize-none text-xs"
              />
              <span className="text-[11px] font-bold text-[#AFAFAF] self-end">
                {editResolutionNote.length}/{NOTES_MAX} ký tự
              </span>
            </label>

            <HandoverPhotoPicker
              images={editResolutionImages}
              onChange={setEditResolutionImages}
              label="Ảnh bằng chứng xử lý (tùy chọn cập nhật)"
              mockLabel={`Ảnh nghiệm thu cập nhật ô ${task.storageUnitId || ''}`}
            />

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t-2 border-[#E5E5E5]">
              <button
                type="button"
                disabled={updatingResolution}
                onClick={() => setEditResolutionOpen(false)}
                className="duo-btn-gray px-4 py-2.5 text-xs"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={updatingResolution || !editResolutionNote.trim()}
                onClick={handleUpdateResolutionSubmit}
                className="duo-btn-blue px-5 py-2.5 text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[17px]">save</span>
                {updatingResolution ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL XÁC NHẬN MỞ LẠI NGUYÊN TASK CHO STAFF ==================== */}
      {reopenSupportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="duo-card bg-white w-full max-w-[500px] p-6 flex flex-col gap-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 border-b-2 border-[#E5E5E5] pb-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FFE8CC] border-2 border-[#FF9600] text-[#E58800] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">restart_alt</span>
              </div>
              <div>
                <h3 className="text-base font-black text-[#4B4B4B]">
                  Thu hồi kết quả &amp; Mở lại task hỗ trợ?
                </h3>
                <p className="text-[11px] font-bold text-[#AFAFAF]">
                  Cho phép nhân viên thao tác và phản hồi lại từ đầu
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-[#FFF8EE] border border-[#FFD8A8] p-3.5 text-xs font-bold text-[#92400E] flex flex-col gap-1.5">
              <p className="flex items-center gap-1.5 font-black text-[#D97706]">
                <span className="material-symbols-outlined text-[17px]">warning</span>
                Các thay đổi sau khi mở lại:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-[11px]">
                <li>Task #{task.id} chuyển từ HOÀN THÀNH về <b>ĐANG XỬ LÝ (IN_PROGRESS)</b>.</li>
                <li>Phiếu hỗ trợ #{task.ticketCode || ''} chuyển từ RESOLVED về <b>ĐANG XỬ LÝ</b>.</li>
                <li>Bạn có thể chọn lại kết luận an ninh/bảo trì, chụp lại ảnh hoặc cấp lại PIN.</li>
              </ul>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-black uppercase text-[#777777]">Lý do mở lại task (Tùy chọn)</span>
              <input
                type="text"
                maxLength={200}
                value={reopenSupportReason}
                onChange={e => setReopenSupportReason(e.target.value)}
                placeholder="VD: Cần bổ sung kiểm tra lại khóa, chọn nhầm kết luận..."
                className="duo-input text-xs"
              />
            </label>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t-2 border-[#E5E5E5]">
              <button
                type="button"
                disabled={reopeningSupport}
                onClick={() => setReopenSupportOpen(false)}
                className="duo-btn-gray px-4 py-2.5 text-xs"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={reopeningSupport}
                onClick={handleReopenSupportSubmit}
                className="duo-btn-orange px-5 py-2.5 text-xs flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[17px]">replay</span>
                {reopeningSupport ? 'Đang mở lại...' : 'Xác nhận mở lại task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal In biên bản xử lý sự cố chuẩn khổ A4 (Góp ý Hội đồng) */}
      <IncidentReportModal
        isOpen={incidentReportModalOpen}
        onClose={() => setIncidentReportModalOpen(false)}
        task={task}
        repairStatus={repairStatus}
        resolutionNote={editResolutionOpen ? editResolutionNote : (resolutionNote || task?.resolutionNote)}
        evidenceImages={
          editResolutionOpen
            ? editResolutionImages
            : (task?.status === 'COMPLETED'
                ? (task?.resolutionImages || [])
                : (isClaimInspection
                    ? inspectionImages
                    : task?.issueType === 'SECURITY'
                    ? securityImages
                    : task?.issueType === 'FACILITY_DAMAGE'
                    ? repairImages
                    : task?.issueType === 'CLEANING'
                    ? cleaningImages
                    : (task?.resolutionImages || [])))
        }
        onUpdateResolutionNote={(newNote) => {
          if (editResolutionOpen) {
            setEditResolutionNote(newNote);
          } else {
            setResolutionNote(newNote);
          }
        }}
        onUpdateImages={(newImages) => {
          if (editResolutionOpen) {
            setEditResolutionImages(newImages);
          } else if (isClaimInspection) {
            setInspectionImages(newImages);
          } else if (task?.issueType === 'SECURITY') {
            setSecurityImages(newImages);
          } else if (task?.issueType === 'FACILITY_DAMAGE') {
            setRepairImages(newImages);
          } else if (task?.issueType === 'CLEANING') {
            setCleaningImages(newImages);
          }
        }}
      />

      <TaskToast toast={toast} onClose={closeToast} />
    </div>
  );
}
