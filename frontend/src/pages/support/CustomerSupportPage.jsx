import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  cancelSupportTicket,
  confirmSupportTicket,
  createSupportTicket,
  getCustomerSupportTickets,
  getEligibleSupportContracts,
  reopenSupportTicket,
} from '../../services/supportService';
import { TaskConfirmDialog, TaskToast } from '../../components/TaskActionFeedback';

export const ISSUE_TYPE_META = {
  LOCK_ISSUE: {
    label: 'Sự cố khóa / Mã PIN',
    desc: 'Không mở được khóa SmartLock, quên mã PIN hoặc thẻ RFID lỗi',
    icon: 'lock_reset',
    urgent: true,
    cls: 'bg-[#FFDFDF] text-[#FF4B4B] border-[#FF4B4B]',
  },
  SECURITY: {
    label: 'An ninh / Cảnh báo khẩn',
    desc: 'Phát hiện dấu hiệu bất thường, xâm nhập hoặc mất an toàn tại khu kho',
    icon: 'shield_With_heart',
    iconName: 'gpp_maybe',
    urgent: true,
    cls: 'bg-[#FFDFDF] text-[#FF4B4B] border-[#FF4B4B]',
  },
  FACILITY_DAMAGE: {
    label: 'Hư hỏng cơ sở vật chất',
    desc: 'Đèn chiếu sáng, cửa cuốn, tường vách hoặc thiết bị chung gặp sự cố',
    icon: 'handyman',
    urgent: false,
    cls: 'bg-[#FFE8CC] text-[#E58800] border-[#FF9600]',
  },
  CLEANING: {
    label: 'Vệ sinh kho bãi',
    desc: 'Yêu cầu dọn vệ sinh hành lang, khu vực bốc xếp hoặc xung quanh ô kho',
    icon: 'cleaning_services',
    urgent: false,
    cls: 'bg-[#DDF4FF] text-[#1CB0F6] border-[#84D8FF]',
  },
  OTHER: {
    label: 'Yêu cầu hỗ trợ khác',
    desc: 'Các vấn đề kỹ thuật hoặc vận hành khác liên quan đến hợp đồng thuê kho',
    icon: 'support_agent',
    urgent: false,
    cls: 'bg-[#F3E8FF] text-[#A560E8] border-[#CE82FF]',
  },
};

const TICKET_STATUS_META = {
  OPEN: {
    label: 'Chờ tiếp nhận',
    icon: 'schedule',
    cls: 'bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF]',
  },
  IN_PROGRESS: {
    label: 'Đang xử lý',
    icon: 'engineering',
    cls: 'bg-[#F3E8FF] text-[#A560E8] border-2 border-[#CE82FF]',
  },
  RESOLVED: {
    label: 'Chờ bạn xác nhận',
    icon: 'mark_chat_read',
    cls: 'bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]',
  },
  CLOSED: {
    label: 'Đã đóng',
    icon: 'check_circle',
    cls: 'bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]',
  },
};

const CONTRACT_STATUS_BADGE = {
  ACTIVE: { label: 'Đang thuê', cls: 'bg-[#D7FFB8] text-[#58A700] border-[#58CC02]' },
  OVERDUE: { label: 'Quá hạn', cls: 'bg-[#FFDFDF] text-[#FF4B4B] border-[#FF4B4B]' },
  TERMINATION_PENDING: { label: 'Chờ trả kho', cls: 'bg-[#FFE8CC] text-[#E58800] border-[#FF9600]' },
};

const TABS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'OPEN', label: 'Chờ tiếp nhận' },
  { key: 'IN_PROGRESS', label: 'Đang xử lý' },
  { key: 'RESOLVED', label: 'Chờ xác nhận' },
  { key: 'CLOSED', label: 'Đã đóng' },
];

const DESC_MIN = 10;
const DESC_MAX = 1000;
const REASON_MAX = 500;

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDateTime(val) {
  if (!val) return '—';
  const d = new Date(val);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} · ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export default function CustomerSupportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialContractId = searchParams.get('contractId') ? Number(searchParams.get('contractId')) : '';
  const shouldOpenCreate = searchParams.get('create') === '1';

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);

  const customerId = currentUser.userId;

  const [tickets, setTickets] = useState([]);
  const [eligibleContracts, setEligibleContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Bộ lọc
  const [activeTab, setActiveTab] = useState('ALL');
  const [contractFilter, setContractFilter] = useState(initialContractId || '');
  const [keyword, setKeyword] = useState('');

  // Modal tạo ticket
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState('');
  const [selectedIssueType, setSelectedIssueType] = useState('LOCK_ISSUE');
  const [description, setDescription] = useState('');
  const [createError, setCreateError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modal hủy ticket (PR-S3)
  const [cancelTarget, setCancelTarget] = useState(null);

  // Modal xác nhận Đã ổn (PR-52)
  const [confirmTarget, setConfirmTarget] = useState(null);

  // Modal báo Chưa xong / Mở lại (PR-52)
  const [reopenTarget, setReopenTarget] = useState(null);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenError, setReopenError] = useState('');

  const [toast, setToast] = useState(null);

  const fetchData = useCallback(() => {
    if (!customerId) return Promise.resolve();
    setLoading(true);
    return Promise.all([
      getCustomerSupportTickets(customerId),
      getEligibleSupportContracts(customerId),
    ])
      .then(([ticketList, contractList]) => {
        setTickets(ticketList || []);
        setEligibleContracts(contractList || []);
        setError('');
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Không tải được dữ liệu yêu cầu hỗ trợ.');
      })
      .finally(() => setLoading(false));
  }, [customerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Nếu có query ?create=1 hoặc ?contractId=... thì mở modal tạo sẵn hợp đồng
  useEffect(() => {
    if (!loading && eligibleContracts.length > 0 && shouldOpenCreate) {
      const targetContract = eligibleContracts.find((c) => c.contractId === Number(initialContractId)) || eligibleContracts[0];
      if (targetContract) {
        openCreateModal(targetContract.contractId);
      }
      const next = new URLSearchParams(searchParams);
      next.delete('create');
      setSearchParams(next, { replace: true });
    }
  }, [loading, eligibleContracts, shouldOpenCreate, initialContractId, searchParams, setSearchParams]);

  const openCreateModal = (preselectContractId) => {
    const firstAvailable = eligibleContracts.find((c) => c.openTicketCount < 3) || eligibleContracts[0];
    const defaultContractId = preselectContractId || contractFilter || (firstAvailable ? firstAvailable.contractId : '');
    setSelectedContractId(defaultContractId ? Number(defaultContractId) : '');

    // Chọn loại sự cố đầu tiên chưa bị trùng trên hợp đồng đó
    const chosenContract = eligibleContracts.find((c) => c.contractId === Number(defaultContractId));
    const openTypes = chosenContract?.openIssueTypes || [];
    const firstFreeIssue = Object.keys(ISSUE_TYPE_META).find((t) => !openTypes.includes(t)) || 'LOCK_ISSUE';

    setSelectedIssueType(firstFreeIssue);
    setDescription('');
    setCreateError('');
    setShowCreateModal(true);
  };

  const selectedContractObj = useMemo(
    () => eligibleContracts.find((c) => c.contractId === Number(selectedContractId)) || null,
    [eligibleContracts, selectedContractId]
  );

  const handleContractSelectChange = (newContractId) => {
    const cid = Number(newContractId);
    setSelectedContractId(cid);
    setCreateError('');
    const found = eligibleContracts.find((c) => c.contractId === cid);
    const openTypes = found?.openIssueTypes || [];
    if (openTypes.includes(selectedIssueType)) {
      const nextFree = Object.keys(ISSUE_TYPE_META).find((t) => !openTypes.includes(t));
      if (nextFree) setSelectedIssueType(nextFree);
    }
  };

  const handleCreateSubmit = () => {
    if (!selectedContractId) {
      setCreateError('Vui lòng chọn hợp đồng cần gửi yêu cầu hỗ trợ (PR-51).');
      return;
    }
    if (selectedContractObj && selectedContractObj.openTicketCount >= 3) {
      setCreateError('Hợp đồng này đã có đủ 3/3 ticket đang mở. Vui lòng đóng bớt ticket trước khi tạo mới (PR-S2).');
      return;
    }
    if (selectedContractObj && (selectedContractObj.openIssueTypes || []).includes(selectedIssueType)) {
      setCreateError('Hợp đồng này đang có 1 yêu cầu cùng loại chưa đóng (PR-S2).');
      return;
    }
    const trimmed = description.trim();
    if (trimmed.length < DESC_MIN || trimmed.length > DESC_MAX) {
      setCreateError(`Mô tả sự cố phải từ ${DESC_MIN} đến ${DESC_MAX} ký tự (hiện tại: ${trimmed.length} ký tự).`);
      return;
    }

    setSubmitting(true);
    setCreateError('');
    createSupportTicket(customerId, {
      contractId: Number(selectedContractId),
      issueType: selectedIssueType,
      description: trimmed,
    })
      .then((created) => {
        setShowCreateModal(false);
        setToast({
          type: 'success',
          message: `Đã gửi yêu cầu hỗ trợ ${created.ticketCode} thành công! Nhân viên cơ sở đã nhận được công việc.`,
        });
        fetchData();
      })
      .catch((err) => {
        setCreateError(err.response?.data?.message || 'Không gửi được yêu cầu hỗ trợ, vui lòng thử lại.');
      })
      .finally(() => setSubmitting(false));
  };

  const handleCancelTicket = () => {
    if (!cancelTarget) return;
    setSubmitting(true);
    cancelSupportTicket(cancelTarget.id, customerId)
      .then((updated) => {
        setToast({
          type: 'success',
          message: `Đã hủy yêu cầu hỗ trợ ${updated.ticketCode} và hủy công việc liên quan.`,
        });
        setCancelTarget(null);
        fetchData();
      })
      .catch((err) => {
        setToast({
          type: 'error',
          message: err.response?.data?.message || 'Không thể hủy yêu cầu hỗ trợ.',
        });
        setCancelTarget(null);
        fetchData();
      })
      .finally(() => setSubmitting(false));
  };

  const handleConfirmTicket = () => {
    if (!confirmTarget) return;
    setSubmitting(true);
    confirmSupportTicket(confirmTarget.id, customerId)
      .then((updated) => {
        setToast({
          type: 'success',
          message: `Cảm ơn bạn! Yêu cầu ${updated.ticketCode} đã được xác nhận hoàn tất và đóng lại.`,
        });
        setConfirmTarget(null);
        fetchData();
      })
      .catch((err) => {
        setToast({
          type: 'error',
          message: err.response?.data?.message || 'Không thể xác nhận đóng ticket.',
        });
        setConfirmTarget(null);
        fetchData();
      })
      .finally(() => setSubmitting(false));
  };

  const handleReopenSubmit = () => {
    if (!reopenTarget) return;
    const trimmed = reopenReason.trim();
    if (!trimmed) {
      setReopenError('Vui lòng nhập lý do chưa ổn để nhân viên kiểm tra và xử lý lại (PR-52).');
      return;
    }
    if (trimmed.length > REASON_MAX) {
      setReopenError(`Lý do phản hồi tối đa ${REASON_MAX} ký tự.`);
      return;
    }

    setSubmitting(true);
    setReopenError('');
    reopenSupportTicket(reopenTarget.id, customerId, trimmed)
      .then((updated) => {
        setToast({
          type: 'success',
          message: `Đã mở lại yêu cầu ${updated.ticketCode} và tạo công việc hỗ trợ mới cho nhân viên cơ sở!`,
        });
        setReopenTarget(null);
        setReopenReason('');
        fetchData();
      })
      .catch((err) => {
        setReopenError(err.response?.data?.message || 'Không thể mở lại yêu cầu hỗ trợ.');
      })
      .finally(() => setSubmitting(false));
  };

  // Thống kê số lượng theo tab
  const stats = useMemo(() => {
    return {
      ALL: tickets.length,
      OPEN: tickets.filter((t) => t.status === 'OPEN').length,
      IN_PROGRESS: tickets.filter((t) => t.status === 'IN_PROGRESS').length,
      RESOLVED: tickets.filter((t) => t.status === 'RESOLVED').length,
      CLOSED: tickets.filter((t) => t.status === 'CLOSED').length,
    };
  }, [tickets]);

  const visibleTickets = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return tickets
      .filter((t) => activeTab === 'ALL' || t.status === activeTab)
      .filter((t) => !contractFilter || t.contractId === Number(contractFilter))
      .filter((t) => {
        if (!kw) return true;
        const issueLabel = ISSUE_TYPE_META[t.issueType]?.label?.toLowerCase() || '';
        return (
          t.ticketCode?.toLowerCase().includes(kw) ||
          t.contractCode?.toLowerCase().includes(kw) ||
          t.storageUnitId?.toLowerCase().includes(kw) ||
          t.facilityName?.toLowerCase().includes(kw) ||
          t.description?.toLowerCase().includes(kw) ||
          t.resolutionNote?.toLowerCase().includes(kw) ||
          issueLabel.includes(kw)
        );
      });
  }, [tickets, activeTab, contractFilter, keyword]);

  return (
    <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b-2 border-[#E5E5E5]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="duo-badge bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF]">UC-26</span>
            <h1 className="text-2xl md:text-3xl font-black text-[#4B4B4B] tracking-tight">
              Trung tâm Hỗ trợ Khách hàng
            </h1>
          </div>
          <p className="text-xs font-bold text-[#777777] mt-1">
            Gửi yêu cầu xử lý sự cố khoá, an ninh, vệ sinh hoặc cơ sở vật chất cho hợp đồng đang thuê của bạn.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchData()}
            className="duo-btn-gray px-4 py-2.5 text-xs flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Làm mới
          </button>
          <button
            type="button"
            onClick={() => openCreateModal()}
            disabled={eligibleContracts.length === 0}
            className="duo-btn-green px-5 py-2.5 text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Gửi yêu cầu hỗ trợ
          </button>
        </div>
      </div>

      {/* PR-51: Thông báo Hotline cho câu hỏi chung & quy định gắn hợp đồng */}
      <div className="duo-card bg-[#F7F9FA] border-[#E5E5E5] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#DDF4FF] border-2 border-b-4 border-[#84D8FF] text-[#1CB0F6] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">support_agent</span>
          </div>
          <div className="text-xs leading-relaxed">
            <p className="font-black text-[#4B4B4B] text-sm">
              Bạn có câu hỏi chung về bảng giá, thủ tục đặt chỗ hoặc chưa có hợp đồng?
            </p>
            <p className="font-bold text-[#777777] mt-0.5">
              Hệ thống Ticket trực tuyến dành riêng cho các hợp đồng đang hiệu lực (<span className="text-[#4B4B4B] font-black">ACTIVE / OVERDUE / Chờ trả kho</span>).
              Với câu hỏi tư vấn chung, vui lòng gọi tổng đài hỗ trợ 24/7.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 bg-white px-4 py-2.5 rounded-2xl border-2 border-[#E5E5E5]">
          <span className="material-symbols-outlined text-[#58CC02] text-[22px]">call</span>
          <div>
            <span className="text-[10px] font-black uppercase text-[#AFAFAF] block">Hotline 24/7</span>
            <span className="text-sm font-black text-[#4B4B4B] font-mono">1900 6868</span>
          </div>
        </div>
      </div>

      {/* Thống kê nhanh */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Chờ tiếp nhận',
            value: stats.OPEN,
            icon: 'schedule',
            color: 'text-[#1CB0F6]',
            bg: 'bg-[#DDF4FF]',
            border: 'border-[#84D8FF]',
          },
          {
            label: 'Nhân viên đang xử lý',
            value: stats.IN_PROGRESS,
            icon: 'engineering',
            color: 'text-[#A560E8]',
            bg: 'bg-[#F3E8FF]',
            border: 'border-[#CE82FF]',
          },
          {
            label: 'Chờ bạn xác nhận',
            value: stats.RESOLVED,
            icon: 'mark_chat_read',
            color: 'text-[#E58800]',
            bg: 'bg-[#FFE8CC]',
            border: 'border-[#FF9600]',
          },
          {
            label: 'Đã hoàn tất / Đóng',
            value: stats.CLOSED,
            icon: 'task_alt',
            color: 'text-[#58A700]',
            bg: 'bg-[#D7FFB8]',
            border: 'border-[#58CC02]',
          },
        ].map((card) => (
          <div key={card.label} className="duo-card p-4 flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl ${card.bg} border-2 border-b-4 ${card.border} flex items-center justify-center shrink-0`}>
              <span className={`material-symbols-outlined text-[24px] ${card.color}`}>{card.icon}</span>
            </div>
            <div>
              <span className="text-[11px] font-black uppercase text-[#AFAFAF] block">{card.label}</span>
              <p className="text-2xl font-black text-[#4B4B4B] mt-0.5">{loading ? '—' : card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Nếu khách chưa có hợp đồng nào đủ điều kiện */}
      {!loading && eligibleContracts.length === 0 && (
        <div className="duo-card border-[#FFE8CC] bg-[#FFFDF9] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#FF9600] text-[30px]">info</span>
            <div className="text-xs">
              <p className="font-black text-[#4B4B4B] text-sm">Bạn hiện chưa có hợp đồng thuê kho đang hoạt động</p>
              <p className="font-bold text-[#777777] mt-0.5">
                Chỉ hợp đồng ở trạng thái Đang hoạt động, Quá hạn hoặc Chờ trả kho mới có thể tạo yêu cầu hỗ trợ kỹ thuật (PR-51).
              </p>
            </div>
          </div>
          <Link to="/kho-cua-toi" className="duo-btn-blue px-4 py-2.5 text-xs shrink-0">
            Xem kho của tôi
          </Link>
        </div>
      )}

      {/* Bộ lọc Tabs + Hợp đồng + Tìm kiếm */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-2xl border-2 border-b-4 text-xs font-black uppercase tracking-wide transition-all cursor-pointer ${
                activeTab === t.key
                  ? 'bg-[#DDF4FF] border-[#84D8FF] text-[#1CB0F6]'
                  : 'bg-white border-[#E5E5E5] text-[#777777] hover:bg-[#F7F7F7]'
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-[11px] opacity-75">({stats[t.key] ?? 0})</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#AFAFAF] text-[20px]">
              search
            </span>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo mã ticket (SR-xxxxxx), mã hợp đồng, mã ô kho, nội dung..."
              className="duo-input w-full pl-11 text-xs"
            />
          </div>

          <select
            value={contractFilter}
            onChange={(e) => setContractFilter(e.target.value)}
            className="duo-input text-xs md:w-72 cursor-pointer"
          >
            <option value="">Tất cả hợp đồng</option>
            {eligibleContracts.map((c) => (
              <option key={c.contractId} value={c.contractId}>
                HĐ {c.contractCode} · Ô {c.storageUnitId} ({c.facilityName})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Danh sách Ticket */}
      {loading ? (
        <div className="duo-card flex flex-col items-center justify-center py-16 gap-3">
          <span className="material-symbols-outlined text-[#58CC02] text-[36px] animate-spin">progress_activity</span>
          <span className="text-xs font-black uppercase text-[#AFAFAF]">Đang tải danh sách yêu cầu hỗ trợ...</span>
        </div>
      ) : error ? (
        <div className="duo-card border-[#FFDFDF] bg-[#FFF5F5] p-6 flex flex-col items-center gap-2 text-center">
          <span className="material-symbols-outlined text-[#FF4B4B] text-[36px]">error</span>
          <p className="text-sm font-black text-[#FF4B4B]">{error}</p>
        </div>
      ) : visibleTickets.length === 0 ? (
        <div className="duo-card flex flex-col items-center justify-center py-16 gap-3 text-center">
          <span className="material-symbols-outlined text-[#AFAFAF] text-[48px]">inbox</span>
          <p className="text-base font-black text-[#4B4B4B]">Chưa có yêu cầu hỗ trợ nào trong mục này</p>
          <p className="text-xs font-bold text-[#777777] max-w-md">
            Khi gặp sự cố về khóa thông minh, mã PIN, vệ sinh hoặc cơ sở vật chất tại ô kho, bạn có thể bấm nút &ldquo;Gửi yêu cầu hỗ trợ&rdquo; để nhân viên cơ sở xử lý ngay.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {visibleTickets.map((ticket) => {
            const issue = ISSUE_TYPE_META[ticket.issueType] || ISSUE_TYPE_META.OTHER;
            const status = TICKET_STATUS_META[ticket.status] || TICKET_STATUS_META.OPEN;
            const isResolved = ticket.status === 'RESOLVED';
            const isOpen = ticket.status === 'OPEN';

            return (
              <div
                key={ticket.id}
                className={`duo-card p-5 md:p-6 flex flex-col gap-4 transition-all ${
                  isResolved
                    ? 'border-[#FF9600] bg-[#FFFDF9]'
                    : ticket.urgent && ticket.status !== 'CLOSED'
                    ? 'border-[#FF4B4B]'
                    : ''
                }`}
              >
                {/* Dòng trên: Mã ticket, loại sự cố, nhãn khẩn & trạng thái */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl border-2 border-b-4 flex items-center justify-center shrink-0 ${issue.cls}`}>
                      <span className="material-symbols-outlined text-[24px]">{issue.iconName || issue.icon}</span>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-black text-[#1CB0F6]">{ticket.ticketCode}</span>
                        <span className="text-base font-black text-[#4B4B4B]">{issue.label}</span>
                        {ticket.urgent && (
                          <span className="duo-badge bg-[#FF4B4B] text-white border-2 border-[#D93838] flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">priority_high</span>
                            KHẨN CẤP
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-[#777777] mt-0.5">
                        Hợp đồng <span className="font-mono font-black text-[#4B4B4B]">{ticket.contractCode}</span>
                        {' · '}Ô kho <span className="font-mono font-black text-[#4B4B4B]">{ticket.storageUnitId || '—'}</span>
                        {ticket.unitTypeName ? ` (${ticket.unitTypeName})` : ''}
                        {ticket.facilityName ? ` · ${ticket.facilityName}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className={`duo-badge flex items-center gap-1 ${status.cls}`}>
                      <span className="material-symbols-outlined text-[14px]">{status.icon}</span>
                      {status.label}
                    </span>
                    <span className="text-[11px] font-bold text-[#AFAFAF]">
                      Tạo lúc: {formatDateTime(ticket.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Mô tả sự cố của khách hàng */}
                <div className="rounded-2xl bg-[#F7F7F7] border-2 border-[#E5E5E5] p-4">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#AFAFAF] block mb-1">
                    Nội dung yêu cầu của bạn
                  </span>
                  <p className="text-xs md:text-sm font-bold text-[#4B4B4B] whitespace-pre-line leading-relaxed">
                    {ticket.description}
                  </p>
                </div>

                {/* Thông tin nhân viên phụ trách & Kết quả xử lý */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#777777] font-bold">
                  <div className="flex flex-wrap items-center gap-4">
                    <span>
                      Nhân viên phụ trách:{' '}
                      <strong className="text-[#4B4B4B]">
                        {ticket.assignedStaffName || 'Đang chờ nhân viên cơ sở tiếp nhận'}
                      </strong>
                    </span>
                    {ticket.latestTaskDueAt && ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED' && (
                      <span>
                        Hạn xử lý ca trực:{' '}
                        <strong className="text-[#1CB0F6]">{formatDateTime(ticket.latestTaskDueAt)}</strong>
                      </span>
                    )}
                    {ticket.closedAt && (
                      <span>
                        Đóng lúc: <strong className="text-[#58A700]">{formatDateTime(ticket.closedAt)}</strong>
                      </span>
                    )}
                  </div>

                  {/* PR-S3: Nút hủy khi ticket còn OPEN */}
                  {isOpen && (
                    <button
                      type="button"
                      onClick={() => setCancelTarget(ticket)}
                      className="duo-btn-red px-4 py-2 text-xs flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">cancel</span>
                      Hủy yêu cầu
                    </button>
                  )}
                </div>

                {/* Hiển thị Kết quả xử lý từ Nhân viên (khi RESOLVED hoặc CLOSED có resolutionNote) */}
                {ticket.resolutionNote && (
                  <div className="rounded-2xl bg-[#D7FFB8]/40 border-2 border-[#58CC02] p-4 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-[#58A700] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">verified</span>
                        Kết quả xử lý từ nhân viên cơ sở
                      </span>
                      {ticket.resolvedAt && (
                        <span className="text-[11px] font-bold text-[#58A700]">
                          Hoàn tất lúc: {formatDateTime(ticket.resolvedAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs md:text-sm font-black text-[#4B4B4B] whitespace-pre-line">
                      {ticket.resolutionNote}
                    </p>
                  </div>
                )}

                {/* PR-52: Khối phản hồi của khách khi ticket ở trạng thái RESOLVED */}
                {isResolved && (
                  <div className="rounded-2xl bg-[#FFF5E6] border-2 border-b-4 border-[#FF9600] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="text-xs">
                      <p className="font-black text-[#E58800] text-sm flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[18px]">help</span>
                        Nhân viên đã báo hoàn tất xử lý — Vấn đề của bạn đã được giải quyết ổn thỏa chưa?
                      </p>
                      <p className="font-bold text-[#777777] mt-0.5">
                        Nếu sau 3 ngày bạn không phản hồi, hệ thống sẽ tự động chuyển yêu cầu sang trạng thái Đã đóng (PR-52).
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setReopenTarget(ticket);
                          setReopenReason('');
                          setReopenError('');
                        }}
                        className="duo-btn-red px-4 py-2.5 text-xs flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[18px]">replay</span>
                        Chưa xong (Yêu cầu xử lý lại)
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmTarget(ticket)}
                        className="duo-btn-green px-5 py-2.5 text-xs flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[18px]">thumb_up</span>
                        Đã ổn (Đóng yêu cầu)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ==================== MODAL TẠO TICKET MỚI (PR-51, PR-S1, PR-S2) ==================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="duo-card bg-white w-full max-w-[640px] max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-5 shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-[#E5E5E5] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#58CC02] border-b-4 border-[#58A700] text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">add_comment</span>
                </div>
                <div>
                  <h2 className="text-lg font-black text-[#4B4B4B]">Gửi yêu cầu hỗ trợ mới</h2>
                  <p className="text-xs font-bold text-[#AFAFAF]">
                    Tự động chuyển tới bảng công việc của nhân viên cơ sở (PR-34)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-[#AFAFAF] hover:text-[#4B4B4B] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>

            {/* 1. Chọn hợp đồng (PR-51, PR-S2) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-[#4B4B4B]">
                1. Chọn hợp đồng cần hỗ trợ <span className="text-[#FF4B4B]">*</span>
              </label>
              <select
                value={selectedContractId}
                onChange={(e) => handleContractSelectChange(e.target.value)}
                className="duo-input text-xs w-full cursor-pointer"
              >
                <option value="">-- Chọn hợp đồng --</option>
                {eligibleContracts.map((c) => {
                  const statusLabel = CONTRACT_STATUS_BADGE[c.status]?.label || c.status;
                  return (
                    <option key={c.contractId} value={c.contractId}>
                      HĐ {c.contractCode} · Ô {c.storageUnitId} ({c.facilityName}) — [{statusLabel}] · Đang mở {c.openTicketCount}/3 ticket
                    </option>
                  );
                })}
              </select>

              {selectedContractObj && (
                <div className="flex items-center justify-between text-[11px] font-bold text-[#777777] px-1">
                  <span>
                    Cơ sở: <strong className="text-[#4B4B4B]">{selectedContractObj.facilityName}</strong> · Loại ô:{' '}
                    <strong className="text-[#4B4B4B]">{selectedContractObj.unitTypeName}</strong>
                  </span>
                  <span className={selectedContractObj.openTicketCount >= 3 ? 'text-[#FF4B4B] font-black' : 'text-[#58A700] font-black'}>
                    Ticket đang mở: {selectedContractObj.openTicketCount}/3 (Tối đa 3 - PR-S2)
                  </span>
                </div>
              )}
            </div>

            {/* 2. Chọn loại sự cố (PR-S1, PR-S2) */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-black uppercase tracking-wider text-[#4B4B4B]">
                2. Loại sự cố cần hỗ trợ <span className="text-[#FF4B4B]">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {Object.entries(ISSUE_TYPE_META).map(([key, meta]) => {
                  const alreadyOpen = (selectedContractObj?.openIssueTypes || []).includes(key);
                  const isSelected = selectedIssueType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={alreadyOpen}
                      onClick={() => {
                        setSelectedIssueType(key);
                        setCreateError('');
                      }}
                      className={`p-3 rounded-2xl border-2 border-b-4 text-left transition-all flex items-start gap-2.5 ${
                        alreadyOpen
                          ? 'bg-[#F7F7F7] border-[#E5E5E5] opacity-55 cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#DDF4FF] border-[#1CB0F6] cursor-pointer'
                          : 'bg-white border-[#E5E5E5] hover:bg-[#F7F7F7] cursor-pointer'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[22px] text-[#4B4B4B] mt-0.5">
                        {meta.iconName || meta.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-[#4B4B4B]">{meta.label}</span>
                          {meta.urgent && (
                            <span className="px-1.5 py-0.5 rounded-md bg-[#FF4B4B] text-white text-[9px] font-black uppercase">
                              Khẩn
                            </span>
                          )}
                          {alreadyOpen && (
                            <span className="px-1.5 py-0.5 rounded-md bg-[#FFE8CC] text-[#E58800] text-[9px] font-black uppercase">
                              Đang mở
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-bold text-[#777777] mt-0.5 line-clamp-2">{meta.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Mô tả chi tiết (10 - 1000 ký tự, PR-S1) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-[#4B4B4B]">
                  3. Mô tả chi tiết vấn đề <span className="text-[#FF4B4B]">*</span>
                </label>
                <span
                  className={`text-xs font-black ${
                    description.trim().length < DESC_MIN || description.trim().length > DESC_MAX
                      ? 'text-[#FF4B4B]'
                      : 'text-[#58A700]'
                  }`}
                >
                  {description.trim().length}/{DESC_MAX} ký tự (tối thiểu {DESC_MIN})
                </span>
              </div>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setCreateError('');
                }}
                placeholder="Mô tả rõ tình trạng bạn đang gặp phải tại ô kho (tối thiểu 10 ký tự)..."
                className="duo-input w-full text-xs resize-none"
              />
            </div>

            {createError && (
              <div className="rounded-2xl border-2 border-[#FF4B4B] bg-[#FFF5F5] px-4 py-3 text-xs font-black text-[#FF4B4B] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{createError}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t-2 border-[#E5E5E5]">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowCreateModal(false)}
                className="duo-btn-gray px-5 py-2.5 text-xs"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={submitting || (selectedContractObj && selectedContractObj.openTicketCount >= 3)}
                onClick={handleCreateSubmit}
                className="duo-btn-green px-6 py-2.5 text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {submitting && (
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                )}
                Gửi yêu cầu hỗ trợ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL BÁO CHƯA XONG / MỞ LẠI TICKET (PR-52) ==================== */}
      {reopenTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="duo-card bg-white w-full max-w-[520px] p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#FF9600] border-b-4 border-[#E58800] text-white flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">replay</span>
              </div>
              <div>
                <h2 className="text-lg font-black text-[#4B4B4B]">
                  Báo chưa xong — {reopenTarget.ticketCode}
                </h2>
                <p className="text-xs font-bold text-[#777777]">
                  Yêu cầu sẽ mở lại (OPEN) và tạo công việc hỗ trợ mới cho nhân viên (PR-52)
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase text-[#4B4B4B]">
                  Lý do chưa ổn / Nội dung cần xử lý tiếp <span className="text-[#FF4B4B]">*</span>
                </label>
                <span className="text-xs font-black text-[#AFAFAF]">
                  {reopenReason.trim().length}/{REASON_MAX}
                </span>
              </div>
              <textarea
                rows={4}
                autoFocus
                value={reopenReason}
                onChange={(e) => {
                  setReopenReason(e.target.value);
                  setReopenError('');
                }}
                placeholder="Ví dụ: Mã PIN mới vẫn chưa mở được chốt khóa, nhờ nhân viên kiểm tra lại nguồn điện..."
                className="duo-input w-full text-xs resize-none"
              />
            </div>

            {reopenError && (
              <div className="rounded-2xl border-2 border-[#FF4B4B] bg-[#FFF5F5] px-4 py-3 text-xs font-black text-[#FF4B4B] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{reopenError}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setReopenTarget(null)}
                className="duo-btn-gray px-5 py-2.5 text-xs"
              >
                Quay lại
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleReopenSubmit}
                className="duo-btn-red px-5 py-2.5 text-xs flex items-center gap-1.5"
              >
                {submitting && (
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                )}
                Gửi yêu cầu xử lý lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog xác nhận Hủy ticket (PR-S3) */}
      <TaskConfirmDialog
        open={Boolean(cancelTarget)}
        icon="cancel"
        title={`Hủy yêu cầu ${cancelTarget?.ticketCode || ''}?`}
        message="Yêu cầu hỗ trợ sẽ chuyển sang trạng thái Đã đóng (CLOSED) và công việc tương ứng tại cơ sở sẽ bị hủy (PR-S3)."
        confirmLabel="Xác nhận hủy"
        submitting={submitting}
        onConfirm={handleCancelTicket}
        onCancel={() => setCancelTarget(null)}
      />

      {/* Dialog xác nhận Đã ổn (PR-52) */}
      <TaskConfirmDialog
        open={Boolean(confirmTarget)}
        icon="thumb_up"
        title={`Xác nhận đã ổn (${confirmTarget?.ticketCode || ''})?`}
        message="Bạn xác nhận sự cố đã được nhân viên giải quyết thỏa đáng. Ticket sẽ được đóng lại (CLOSED)."
        confirmLabel="Đã ổn, đóng yêu cầu"
        submitting={submitting}
        onConfirm={handleConfirmTicket}
        onCancel={() => setConfirmTarget(null)}
      />

      <TaskToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
