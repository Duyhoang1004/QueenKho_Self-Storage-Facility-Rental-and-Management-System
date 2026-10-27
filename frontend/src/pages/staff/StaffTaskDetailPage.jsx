import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import { TaskConfirmDialog, TaskToast } from '../../components/TaskActionFeedback';
import {
  checkInStaffTask,
  checkOutStaffTask,
  completeMaintenanceTask,
  completeRefundTask,
  extendSupportTask,
  getStaffTaskDetail,
  resetSupportContractPin,
  resolveSupportTask,
  suggestAccessPin,
  uploadImageFile,
} from '../../services/staffTaskService';
import SimulationButton from '../../components/SimulationButton';
import { simulateArriveToday, simulateCheckoutToday, simulateNoShow, simulateOverdue } from '../../services/simulationService';

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
  OVERDUE:     { label: 'Quá hạn',    cls: 'bg-[#FFDFDF] text-[#FF4B4B] border-2 border-[#FF4B4B]' },
  COMPLETED:   { label: 'Hoàn thành', cls: 'bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]' },
  CANCELLED:   { label: 'Đã huỷ',     cls: 'bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]' },
};

const CONTRACT_STATUS_LABEL = {
  PENDING_CHECK_IN: 'Chờ check-in',
  ACTIVE: 'Đang hoạt động',
  OVERDUE: 'Quá hạn thanh toán',
  TERMINATION_PENDING: 'Chờ trả kho',
  TERMINATED: 'Đã chấm dứt',
  LIQUIDATED: 'Đã thanh lý',
};

const UNIT_STATUS_LABEL = {
  AVAILABLE: 'Trống (Sẵn sàng)',
  OCCUPIED: 'Đang thuê',
  MAINTENANCE: 'Đang bảo trì',
  RESERVED: 'Đã giữ chỗ',
};

// 5 mục kiểm tra của biên bản Check-in (UC-18) — cả 5 mục phải đạt
const CHECKIN_CHECKLIST = [
  { key: 'identityVerified',           label: 'Đã xác minh CCCD của khách',     hint: 'Đối chiếu CCCD với thông tin đặt chỗ' },
  { key: 'unitEmpty',                  label: 'Ô kho trống',                    hint: 'Không còn đồ của người thuê trước' },
  { key: 'unitClean',                  label: 'Ô kho sạch sẽ',                  hint: 'Sàn, tường, cửa đã vệ sinh' },
  { key: 'lockIntact',                 label: 'Khoá SmartLock nguyên vẹn',      hint: 'Khoá hoạt động, không trầy xước' },
  { key: 'customerSignatureConfirmed', label: 'Khách đã ký biên bản bàn giao',  hint: 'Khách ký xác nhận trên biên bản giấy' },
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

function formatDate(value) {
  if (!value) return '—';
  const [y, m, d] = String(value).split('-');
  return `${d}/${m}/${y}`;
}

function formatCurrency(amount) {
  const num = Number(amount || 0);
  return num.toLocaleString('vi-VN') + ' đ';
}

// Nén file ảnh sang base64 JPEG nhẹ (tối đa 800px) để lưu DB nhanh và xem trực tiếp không cần server ngoài
function compressImageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được file ảnh'));
    reader.onload = e => {
      const img = new Image();
      img.onerror = () => reject(new Error('Định dạng ảnh không hợp lệ'));
      img.onload = () => {
        const MAX_DIM = 800;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Tạo 1 ảnh bằng chứng mẫu dạng SVG Data URI khi bấm "Giả lập sự cố" (phục vụ demo nhanh)
function createMockEvidenceDataUrl(label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">
    <rect width="480" height="320" fill="#FFF5E6" rx="16"/>
    <rect x="16" y="16" width="448" height="288" fill="none" stroke="#FF9600" stroke-width="4" stroke-dasharray="10,6" rx="12"/>
    <circle cx="240" cy="120" r="42" fill="#FFE8CC"/>
    <text x="240" y="132" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#E58800" text-anchor="middle">!</text>
    <text x="240" y="195" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#4B4B4B" text-anchor="middle">ẢNH BẰNG CHỨNG HIỆN TRƯỜNG</text>
    <text x="240" y="225" font-family="Arial, sans-serif" font-size="14" fill="#777777" text-anchor="middle">${label}</text>
    <text x="240" y="265" font-family=" monospace" font-size="12" fill="#AFAFAF" text-anchor="middle">QueenKho Inspection Evidence</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
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
    if (task.status === 'CANCELLED') return 'Yêu cầu hỗ trợ đã bị huỷ hoặc đã đóng.';
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
    case 'CANCELLED': return 'Task đã bị huỷ (khách không đến hoặc đã huỷ yêu cầu).';
    case 'COMPLETED': return null;
    default:
      if (task.staffId !== userId) return `Task đang do ${task.staffName || 'nhân viên khác'} phụ trách.`;
      if (new Date(task.dueAt) <= new Date()) return 'Task đã quá hạn 21:00 ngày hẹn nên không thể lập biên bản.';
      return null;
  }
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

  // PR-Q10: dọn kho sau thanh lý → biên bản kiểm kê hàng của khách, lập hồ sơ lưu giữ 60 ngày
  const [noGoodsLeft, setNoGoodsLeft] = useState(false);
  const [inventoryNote, setInventoryNote] = useState('');
  const [witnessNote, setWitnessNote] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [inventoryImages, setInventoryImages] = useState([]);

  // Task cũ chưa có maintenanceReason: suy ra từ hợp đồng
  const isLiquidation = task.maintenanceReason === 'LIQUIDATION'
    || (!task.maintenanceReason && task.contractStatus === 'LIQUIDATED');
  const doneLabel = isLiquidation ? 'Dọn xong' : 'Sửa xong';
  const blocked = maintenanceBlockedReason(task, userId, isManager);
  const noteValid = note.trim().length >= MAINTENANCE_NOTE_MIN && note.trim().length <= NOTES_MAX;
  const inventoryError = !isLiquidation || noGoodsLeft ? null
    : inventoryNote.trim().length < 10 ? 'Liệt kê hàng kiểm kê (tối thiểu 10 ký tự).'
    : !witnessNote.trim() ? 'Ghi rõ người mở kho / chứng kiến.'
    : !storageLocation.trim() ? 'Ghi rõ khu lưu giữ hàng.'
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
      setNote('Đã cùng Quản lý mở kho, kiểm kê, chụp ảnh, niêm phong hàng và chuyển sang khu lưu giữ. Ô đã dọn sạch.');
      setNoGoodsLeft(false);
      setInventoryNote('12 thùng carton đồ gia dụng (đã niêm phong), 1 tủ lạnh mini, 2 xe đạp, 1 túi quần áo.');
      setWitnessNote('Nhân viên kho + Quản lý cơ sở, có đại diện tổ dân phố chứng kiến');
      setStorageLocation('Khu lưu giữ K2 - kệ 3');
      setInventoryImages([
        createMockEvidenceDataUrl('Kiểm kê hàng ô ' + (task.storageUnitId || '') + ' (1)'),
        createMockEvidenceDataUrl('Kiểm kê hàng ô ' + (task.storageUnitId || '') + ' (2)'),
      ]);
    } else {
      setNote('Đã thay vách tôn mới, sửa khung, xử lý chống thấm trần và vệ sinh ô. Khoá SmartLock hoạt động bình thường.');
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
        : { inventoryNote: inventoryNote.trim(), witnessNote: witnessNote.trim(), storageLocation: storageLocation.trim(), inventoryImages });
    }
    completeMaintenanceTask(task.id, payload)
      .then(data => {
        onCompleted(data);
        onToast({
          type: 'success',
          message: data.heldGoodsId
            ? `Đã dọn xong ô ${data.storageUnitId}. Lập hồ sơ lưu giữ hàng #${data.heldGoodsId} đến ${formatDate(data.heldGoodsHoldUntil)}.`
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
            Ô {task.storageUnitId} · HĐ {task.contractCode} — xong việc thì ô quay về "Sẵn sàng cho thuê".
          </p>
        </div>
        <span className={`duo-badge whitespace-nowrap border ${isLiquidation
          ? 'bg-[#F3E8FF] text-[#9333EA] border-[#C084FC]'
          : 'bg-[#FFE8CC] text-[#E58800] border-[#FF9600]'}`}>
          {isLiquidation ? 'Dọn kho sau thanh lý' : 'Sửa chữa sau trả kho'}
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
            'Niêm phong, chuyển hàng sang khu lưu giữ — lưu 60 ngày trước khi bán thanh lý.',
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

      {task.status === 'COMPLETED' ? (
        <div className="rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] p-4 flex flex-col gap-2">
          <p className="text-sm font-black text-[#58A700] flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px]">verified</span>
            Đã hoàn tất lúc {formatDateTime(task.completedAt)} — ô kho đã sẵn sàng cho thuê
          </p>
          {task.heldGoodsId && (
            <p className="text-xs font-bold text-[#4B4B4B]">
              Hàng của khách: hồ sơ lưu giữ #{task.heldGoodsId}, lưu đến hết ngày {formatDate(task.heldGoodsHoldUntil)}.
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
              placeholder={isLiquidation ? 'VD: Kiểm kê 12 thùng hàng, chuyển sang khu lưu giữ K2, dọn sạch ô...' : 'VD: Thay vách ngăn, sửa khoá, vệ sinh ô...'}
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
                      <span className="text-[11px] font-black uppercase text-[#777777]">Khu lưu giữ *</span>
                      <input type="text" maxLength={100} value={storageLocation} onChange={e => setStorageLocation(e.target.value)}
                        placeholder="VD: Khu K2 - kệ 3" className="duo-input text-xs" />
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
                    Hoàn tất → lập hồ sơ lưu giữ 60 ngày ở trang "Hàng đang lưu giữ" của Quản lý cơ sở.
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
            {doneLabel} — mở lại ô cho thuê
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
        message={`Task bảo trì #${task.id} sẽ đóng và ô ${task.storageUnitId} chuyển sang "Sẵn sàng cho thuê" (AVAILABLE).`}
        confirmLabel={doneLabel}
        submitting={submitting}
        onConfirm={handleSubmit}
        onCancel={() => setConfirmOpen(false)}
      />
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // State cho Check-in (UC-18)
  const [checks, setChecks] = useState(EMPTY_CHECKIN_CHECKS);
  const [pin, setPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [rfid, setRfid] = useState('');
  const [notes, setNotes] = useState('');

  // State cho Check-out & Damage Cases (UC-23 & UC-24)
  const [coChecks, setCoChecks] = useState(INITIAL_CHECKOUT_CHECKS);
  const [damageCases, setDamageCases] = useState([]);
  const [coNotes, setCoNotes] = useState('');
  const [previewImage, setPreviewImage] = useState(null);

  // State cho Refund (UC-25)
  const [evidenceImageUrl, setEvidenceImageUrl] = useState('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [refundNotes, setRefundNotes] = useState('');
  const [copiedField, setCopiedField] = useState(null);

  // State cho Support (UC-27)
  const [resolutionNote, setResolutionNote] = useState('');
  const [confirmSupportOpen, setConfirmSupportOpen] = useState(false);
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
      .then(data => {
        setTask(data);
        setLoadError('');
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
  const canSubmitCheckIn =
    allCheckInChecked && /^\d{6}$/.test(pin) && rfid.trim() !== '' && notes.length <= NOTES_MAX && !submitting;

  const handleCheckInSubmit = () => {
    setSubmitting(true);
    checkInStaffTask(task.id, userId, { ...checks, accessPinCode: pin, rfidCardCode: rfid.trim(), notes })
      .then(data => {
        setTask(data);
        setJustCompleted(true);
        setToast({ type: 'success', message: `Check-in thành công. Hợp đồng ${data.contractCode} đã kích hoạt.` });
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
  const blockingPassed =
    coChecks.identityVerified && coChecks.unitEmpty && coChecks.customerSignatureConfirmed;
  const conditionFailed = !coChecks.unitClean || !coChecks.lockIntact;
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

  // PR-O14 & PR-Q3: Phí ân hạn & trễ hạn
  let estimatedGraceFee = 0;
  let estimatedLateFee = 0;
  let daysPast = 0;

  if (isOverdueOrGrace) {
    const eDate = new Date(endDateStr);
    const nDate = new Date(todayStr);
    const diffTime = Math.abs(nDate - eDate);
    daysPast = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysPast === 1) {
      estimatedGraceFee = 0; // PR-O14: Ngày end_date + 1 miễn phí
    } else if (daysPast >= 2 && daysPast <= 5) {
      estimatedGraceFee = Math.round((basePrice / 30) * (daysPast - 1));
    } else {
      estimatedLateFee = Math.round(depositHeld * Math.min(daysPast, 5) * 0.10);
    }
  }

  const totalDepositDeductions = totalDamageCost + estimatedGraceFee + estimatedLateFee;
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

  const canSubmitCheckOut =
    blockingPassed && !damageValidationError && coNotes.length <= NOTES_MAX && !submitting;

  const handleCheckOutSubmit = () => {
    setSubmitting(true);
    const payload = {
      ...coChecks,
      notes: coNotes,
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
          message: `Nghiệm thu trả kho thành công! Hợp đồng ${data.contractCode} đã chấm dứt.`,
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
    if (!parsedRefund?.isCash && !evidenceImageUrl.trim()) {
      setToast({ type: 'error', message: 'Vui lòng tải lên ảnh chụp biên lai chuyển tiền trước khi xác nhận hoàn tiền.' });
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
  const canSubmitSupport =
    resolutionNote.trim().length >= 1 && resolutionNote.trim().length <= NOTES_MAX && !submitting;

  const handleResolveSupportSubmit = () => {
    setSubmitting(true);
    resolveSupportTask(task.id, userId, { resolutionNote: resolutionNote.trim() })
      .then(data => {
        setTask(data);
        setJustCompleted(true);
        setToast({
          type: 'success',
          message: `Đã xử lý xong yêu cầu hỗ trợ ${data.ticketCode || ''}. Trạng thái phiếu chuyển sang Chờ khách xác nhận (RESOLVED).`,
        });
      })
      .catch(err => {
        setToast({
          type: 'error',
          message: err.response?.data?.message || 'Không thể hoàn tất xử lý yêu cầu hỗ trợ.',
        });
        loadTask();
      })
      .finally(() => {
        setSubmitting(false);
        setConfirmSupportOpen(false);
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

  const handleExtendSupportSubmit = () => {
    if (!extendDueDate || !extendReason.trim()) return;
    setExtendingSupport(true);
    extendSupportTask(task.id, userId, {
      newDueDate: extendDueDate,
      reason: extendReason.trim(),
    })
      .then(data => {
        setTask(data);
        setExtendReason('');
        setToast({
          type: 'success',
          message: `Đã gia hạn task hỗ trợ #${data.id} đến 21:00 ngày ${formatDate(extendDueDate)}.`,
        });
      })
      .catch(err => {
        setToast({
          type: 'error',
          message: err.response?.data?.message || 'Không thể gia hạn task hỗ trợ.',
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

  const type = TYPE_META[task.taskType] || { label: task.taskType, icon: 'task', cls: 'bg-[#F7F7F7] text-[#777777] border-[#E5E5E5]' };
  const status = isRefund && task.status === 'OPEN'
    ? { label: 'Chờ xử lý', cls: 'bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF]' }
    : (STATUS_META[task.status] || { label: task.status, cls: 'bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]' });
  const reason = blockedReason(task, userId);
  const record = task.handoverRecord;
  const isCheckOut = task.taskType === 'CHECK_OUT';

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
              description="Hết 5 ngày ân hạn mà khách không tới: hợp đồng chuyển QUÁ HẠN 31 ngày (phí trễ chạm trần 50% cọc), huỷ task nghiệm thu. Sau đó vào màn Hợp đồng quá hạn để liên hệ và thanh lý."
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

          {task.contractCode ? (
            <InfoCard icon="description" title="Hợp đồng">
              <InfoRow label="Mã hợp đồng" value={task.contractCode} mono />
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
              <InfoRow label="Loại việc" value="Hoàn tiền đơn đặt chỗ (Hủy đơn)" />
              <InfoRow label="Mã đơn đặt" value={task.reservationCode || parsedRefund?.orderCode} mono />
              {task.unitTypeName && <InfoRow label="Loại khoang" value={task.unitTypeName} />}
              <InfoRow label="Cơ sở" value={task.facilityName || 'Cơ sở hiện tại'} />
            </InfoCard>
          )}

          {task.taskType === 'REFUND' ? (
            <InfoCard icon="notes" title="Lý do hoàn tiền & Ghi chú">
              <div className="flex flex-col gap-3">
                <div className="rounded-xl bg-[#F7F7F7] p-3.5 border border-[#E5E5E5] text-xs font-bold text-[#4B4B4B] leading-relaxed">
                  <span className="text-[11px] font-black uppercase text-[#AFAFAF] block mb-1">Lý do từ khách hàng</span>
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
                        {parsedRefund?.lateFeeNum > 0 && (
                          <div className="flex justify-between items-center py-0.5">
                            <span className="font-bold text-[#718096]">
                              Khấu trừ phí trễ hạn {parsedRefund.overdueDays ? `(${parsedRefund.overdueDays} ngày):` : ':'}
                            </span>
                            <span className="font-black text-[#E53E3E]">
                              - {parsedRefund.lateFee}
                            </span>
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
                        {!parsedRefund?.penaltyAmountNum && !parsedRefund?.lateFeeNum && !(Number(task.totalDamageCost) > 0) && (
                          <div className="flex justify-between items-center py-0.5">
                            <span className="font-bold text-[#718096]">Chính sách áp dụng:</span>
                            <span className="font-black text-[#2F855A]">
                              {parsedRefund?.policyApplied || (task.contractCode || parsedRefund?.isCheckout ? 'Khoang bàn giao nguyên vẹn (Hoàn 100% cọc)' : 'Khách hủy đơn sớm trước 24h so với thời điểm nhận kho (hoàn 100%)')}
                            </span>
                          </div>
                        )}
                      </>
                    )}

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
                        Đã tất toán
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
                        Ảnh biên lai chuyển khoản / Chứng từ (Tuỳ chọn)
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

                  {!parsedRefund?.isCash && !evidenceImageUrl.trim() && (
                    <p className="text-[11px] font-bold text-[#FF4B4B]">
                      * Bắt buộc tải lên ảnh biên lai chuyển tiền trước khi xác nhận
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!parsedRefund?.isCash && !evidenceImageUrl.trim()) {
                        setToast({ type: 'error', message: 'Vui lòng tải lên ảnh chụp biên lai chuyển tiền trước khi xác nhận hoàn tiền.' });
                        return;
                      }
                      setConfirmRefundOpen(true);
                    }}
                    disabled={submitting || (!parsedRefund?.isCash && !evidenceImageUrl.trim())}
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
                  <div className="flex justify-between sm:justify-start sm:gap-2">
                    <span className="font-bold text-[#92400E]">Phân loại sự cố:</span>
                    <span className="font-black text-[#4B4B4B]">
                      {SUPPORT_ISSUE_LABEL[task.issueType] || task.issueType || 'Hỗ trợ khách hàng'}
                    </span>
                  </div>
                  {task.ticketCreatedAt && (
                    <div className="flex justify-between sm:justify-end sm:gap-2">
                      <span className="font-bold text-[#92400E]">Thời điểm gửi:</span>
                      <span className="font-black text-[#4B4B4B]">{formatDateTime(task.ticketCreatedAt)}</span>
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-white p-3.5 border border-[#FDE68A] text-xs">
                  <span className="text-[11px] font-black uppercase text-[#B45309] block mb-1">
                    Nội dung phản ánh từ khách hàng:
                  </span>
                  <p className="font-bold text-[#4B4B4B] whitespace-pre-line leading-relaxed">
                    {task.ticketDescription || task.note || 'Khách hàng yêu cầu kiểm tra và hỗ trợ tại ô kho.'}
                  </p>
                </div>

                {task.resolutionNote && (
                  <div className="rounded-xl bg-[#D7FFB8]/60 p-3.5 border border-[#58CC02] text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-black uppercase text-[#58A700] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">check_circle</span>
                        Kết quả xử lý đã phản hồi cho khách (PR-S5):
                      </span>
                      {task.ticketResolvedAt && (
                        <span className="text-[10px] font-bold text-[#58A700]">
                          {formatDateTime(task.ticketResolvedAt)}
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-[#2B5300] whitespace-pre-line leading-relaxed">
                      {task.resolutionNote}
                    </p>
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

                  {task.issueType === 'LOCK_ISSUE' && task.accessPinCode && (
                    <CodeBox icon="pin" label="Mã PIN SmartLock hiện tại của hợp đồng" value={task.accessPinCode} big />
                  )}

                  <Link
                    to={isManager ? '/manager/tasks' : '/staff'}
                    className="duo-btn-gray px-5 py-2.5 text-xs self-end"
                  >
                    Về bảng công việc
                  </Link>
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
                      <input
                        type="date"
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
                  {/* Công cụ Cấp lại mã PIN 6 số cho sự cố LOCK_ISSUE (PR-S6 & PR-Q5) */}
                  {task.issueType === 'LOCK_ISSUE' && (
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
                  )}

                  {/* Form nhập kết quả xử lý (PR-S5) */}
                  <div className="flex flex-col gap-3">
                    <div>
                      <h3 className="text-base font-black text-[#4B4B4B]">
                        Báo cáo kết quả xử lý hỗ trợ (PR-S5)
                      </h3>
                      <p className="text-xs font-bold text-[#AFAFAF]">
                        Nhập nội dung đã kiểm tra / khắc phục tại hiện trường (1–1000 ký tự) để gửi phản hồi cho khách hàng xác nhận.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase text-[#AFAFAF] mr-1">Mẫu phản hồi nhanh:</span>
                      {SUPPORT_RESOLUTION_PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setResolutionNote(preset)}
                          className="px-2.5 py-1 rounded-xl bg-[#F7F7F7] border border-[#E5E5E5] hover:border-[#1CB0F6] text-[11px] font-bold text-[#4B4B4B] cursor-pointer transition-colors text-left"
                        >
                          + Mẫu #{idx + 1}: {preset.slice(0, 42)}...
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
                      <p className="text-sm font-black text-[#58A700]">Đã hoàn tất nghiệm thu trả kho!</p>
                      <p className="text-xs font-bold text-[#58A700]">
                        Hợp đồng đã chấm dứt, mã PIN/RFID đã bị thu hồi.
                        {effectiveRefundAmount > 0
                          ? ` Đã tự động tạo task hoàn tiền (${formatCurrency(effectiveRefundAmount)}) cho Quản lý cơ sở.`
                          : ''}
                      </p>
                    </div>
                  </div>
                )}

                {/* Tóm tắt quyết toán tài chính hoàn tiền (PR-O2, PR-O11) */}
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
                  {((Number(task.graceFee) || 0) + (Number(task.lateFee) || 0)) > 0 && (
                    <div className="flex justify-between text-xs font-bold text-[#4B4B4B]">
                      <span>Khấu trừ phí ân hạn / trễ hạn:</span>
                      <span className="font-black text-[#FF4B4B]">- {formatCurrency((Number(task.graceFee) || 0) + (Number(task.lateFee) || 0))}</span>
                    </div>
                  )}
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
                        {CHECKIN_CHECKLIST.map(item => (
                          <li key={item.key} className="flex items-center gap-2 text-xs font-bold text-[#4B4B4B]">
                            <span className={`material-symbols-outlined text-[20px] ${record[item.key] ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}`}>
                              {record[item.key] ? 'check_circle' : 'cancel'}
                            </span>
                            {item.label}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-4 rounded-2xl bg-[#F7F7F7] px-4 py-3 text-xs">
                        <p><span className="font-black text-[#AFAFAF] uppercase mr-1">Người lập:</span><span className="font-black text-[#4B4B4B]">{record.staffName}</span></p>
                        <p className="mt-1 whitespace-pre-line"><span className="font-black text-[#AFAFAF] uppercase mr-1">Ghi chú:</span><span className="font-bold text-[#777777]">{record.notes || 'Không có'}</span></p>
                      </div>
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
            </div>
          ) : isCheckOut ? (
            /* ================== FORM NGHIỆM THU TRẢ KHO & SỰ CỐ (UC-23 & UC-24) ================== */
            <div className="duo-card p-6 flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-[#4B4B4B]">Biên bản nghiệm thu trả kho</h2>
                  <p className="text-xs font-bold text-[#AFAFAF]">
                    Kiểm tra hiện trạng ô kho, thu hồi quyền truy cập và lập biên bản sự cố nếu có hư hại.
                  </p>
                </div>
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
                    }}
                    className="duo-btn-white px-3.5 py-2 text-xs gap-1.5"
                    title="Điền nhanh sự cố do cơ sở: ô vẫn vào bảo trì nhưng khách được hoàn cọc đầy đủ"
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#1CB0F6]">roofing</span>
                    Giả lập lỗi cơ sở
                  </button>
                </div>
              </div>

              {/* Bước 1: Điều kiện bắt buộc (Blocking) */}
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

              {/* Bước 2: Kiểm tra tình trạng vệ sinh & khoá (Non-blocking -> Kích hoạt UC-24) */}
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
                {(estimatedGraceFee + estimatedLateFee) > 0 && (
                  <div className="flex justify-between text-xs font-bold text-[#4B4B4B]">
                    <span>Khấu trừ phí {estimatedGraceFee > 0 ? `ân hạn dọn đồ (${daysPast - 1} ngày)` : 'trễ hạn'}:</span>
                    <span className="font-black text-[#FF4B4B]">- {formatCurrency(estimatedGraceFee + estimatedLateFee)}</span>
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
                      Hệ thống sẽ ghi nhận công nợ DAMAGE_FEE (PENDING). Khách cần thanh toán khoản này ở mục Thanh toán.
                    </span>
                  </div>
                ) : (
                  <span className="text-[11px] font-bold text-[#1899D6]">
                    {estimatedTotalRefund > 0
                      ? 'Sau khi xác nhận, hệ thống tự động tạo task REFUND để Quản lý cơ sở chuyển khoản / tất toán hoàn tiền cho khách.'
                      : 'Hồ sơ trả kho sẽ được Quản lý đóng lại sau khi đối soát xong.'}
                  </span>
                )}
              </div>

              {/* Ghi chú biên bản */}
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black uppercase text-[#AFAFAF]">Ghi chú biên bản nghiệm thu</span>
                <textarea
                  value={coNotes}
                  onChange={e => setCoNotes(e.target.value)}
                  rows={2}
                  placeholder="Ghi chú thêm về quá trình trả kho, bàn giao chìa khoá/thẻ từ..."
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
                Xác nhận hoàn tất nghiệm thu trả kho
              </button>
              {!canSubmitCheckOut && !submitting && (
                <p className="text-[11px] font-bold text-[#FF4B4B] text-center -mt-3">
                  {!blockingPassed
                    ? 'Vui lòng hoàn thành đủ 3 mục Điều kiện bắt buộc (CCCD, Ô trống, Chữ ký khách).'
                    : damageValidationError || 'Vui lòng kiểm tra lại thông tin biên bản.'}
                </p>
              )}
            </div>
          ) : (
            /* ================== FORM CHECK-IN (UC-18) ================== */
            <div className="duo-card p-6 flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-[#4B4B4B]">Biên bản bàn giao</h2>
                  <p className="text-xs font-bold text-[#AFAFAF]">Kiểm tra đủ 5 mục, cấp mã PIN + thẻ RFID rồi xác nhận.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setChecks(CHECKIN_CHECKLIST.reduce((acc, item) => ({ ...acc, [item.key]: true }), {}))}
                  className="duo-btn-white px-4 py-2 text-xs gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>
                  Giả lập hoàn thiện
                </button>
              </div>

              {/* Checklist 5 mục */}
              <div className="flex flex-col gap-2">
                {CHECKIN_CHECKLIST.map(item => (
                  <label
                    key={item.key}
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
                ))}
                <p className={`text-[11px] font-black ${allCheckInChecked ? 'text-[#58A700]' : 'text-[#AFAFAF]'}`}>
                  Đã kiểm tra {CHECKIN_CHECKLIST.filter(item => checks[item.key]).length}/{CHECKIN_CHECKLIST.length} mục
                </p>
              </div>

              {/* Cấp mã PIN & thẻ RFID */}
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
                  <input
                    type="text"
                    value={rfid}
                    onChange={e => setRfid(e.target.value)}
                    placeholder="VD: RFID-001234"
                    className="duo-input font-mono font-bold"
                  />
                  <span className="text-[10px] font-bold text-[#AFAFAF]">Quẹt thẻ lên đầu đọc hoặc nhập mã in trên thẻ.</span>
                </label>
              </div>

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

              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={!canSubmitCheckIn}
                className="duo-btn-green px-5 py-3 text-sm gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
                Xác nhận bàn giao
              </button>
              {!canSubmitCheckIn && !submitting && (
                <p className="text-[11px] font-bold text-[#AFAFAF] text-center -mt-3">
                  {!allCheckInChecked ? 'Cần tick đủ 5 mục kiểm tra.' : rfid.trim() === '' ? 'Cần nhập mã thẻ RFID.' : 'Đang chờ mã PIN...'}
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
        title={isCheckOut ? 'Xác nhận hoàn tất nghiệm thu trả kho?' : 'Xác nhận bàn giao ô kho?'}
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
            : `Hợp đồng ${task.contractCode} sẽ chuyển sang "Đang hoạt động" và khách nhận mã PIN ${pin}, thẻ RFID ${rfid.trim()}. Biên bản đã lưu không thể sửa.`
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

      {/* Dialog xác nhận hoàn tất xử lý Hỗ trợ KH (UC-27) */}
      <TaskConfirmDialog
        open={confirmSupportOpen}
        icon="support_agent"
        tone="green"
        title="Xác nhận đã xử lý xong yêu cầu hỗ trợ?"
        message={`Task hỗ trợ #${task.id} sẽ chuyển sang HOÀN THÀNH và phiếu #${task.ticketCode || ''} sẽ chuyển sang trạng thái Chờ khách xác nhận (RESOLVED). Khách hàng sẽ nhận được phản hồi: "${resolutionNote.trim()}".`}
        confirmLabel="Xác nhận hoàn tất"
        submitting={submitting}
        onConfirm={handleResolveSupportSubmit}
        onCancel={() => setConfirmSupportOpen(false)}
      />

      <TaskToast toast={toast} onClose={closeToast} />
    </div>
  );
}
