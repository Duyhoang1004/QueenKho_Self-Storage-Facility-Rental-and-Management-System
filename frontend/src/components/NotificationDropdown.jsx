import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyNotifications, getUnreadCount, markAsRead, markAllAsRead } from '../services/notificationService';

const TYPE_CONFIG = {
  BOOKING: {
    icon: 'inventory_2',
    bg: 'bg-[#D7FFB8]',
    border: 'border-[#58CC02]',
    color: 'text-[#58A700]',
    label: 'Đặt kho'
  },
  REFUND: {
    icon: 'payments',
    bg: 'bg-[#DDF4FF]',
    border: 'border-[#84D8FF]',
    color: 'text-[#1CB0F6]',
    label: 'Hoàn tiền'
  },
  DAMAGE: {
    icon: 'warning',
    bg: 'bg-[#FFDFDF]',
    border: 'border-[#FF4B4B]',
    color: 'text-[#FF4B4B]',
    label: 'Hư hại'
  },
  LIQUIDATION: {
    icon: 'gavel',
    bg: 'bg-[#FFDFDF]',
    border: 'border-[#FF4B4B]',
    color: 'text-[#FF4B4B]',
    label: 'Thanh lý'
  },
  ASSIGNED: {
    icon: 'vpn_key',
    bg: 'bg-[#D7FFB8]',
    border: 'border-[#58CC02]',
    color: 'text-[#58A700]',
    label: 'Gán ô'
  },
  RENEWAL: {
    icon: 'schedule',
    bg: 'bg-[#FFE8CC]',
    border: 'border-[#FF9600]',
    color: 'text-[#E58800]',
    label: 'Gia hạn'
  },
  OVERDUE: {
    icon: 'lock_clock',
    bg: 'bg-[#FFDFDF]',
    border: 'border-[#FF4B4B]',
    color: 'text-[#FF4B4B]',
    label: 'Quá hạn'
  },
  TASK: {
    icon: 'assignment',
    bg: 'bg-[#DDF4FF]',
    border: 'border-[#84D8FF]',
    color: 'text-[#1CB0F6]',
    label: 'Công việc'
  },
  ADMIN_SUMMARY: {
    icon: 'query_stats',
    bg: 'bg-[#F3E8FF]',
    border: 'border-[#CE82FF]',
    color: 'text-[#A560E8]',
    label: 'Hệ thống'
  },
  STAFF_CREATED: {
    icon: 'person_add',
    bg: 'bg-[#F3E8FF]',
    border: 'border-[#CE82FF]',
    color: 'text-[#A560E8]',
    label: 'Nhân sự'
  }
};

function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;

  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Tải số lượng chưa đọc
  const fetchCount = useCallback(async () => {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch (err) {
      // Bỏ qua lỗi nếu chưa đăng nhập hoặc mạng yếu
    }
  }, []);

  // Tải danh sách thông báo
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getMyNotifications(30);
      setNotifications(list);
      const count = list.filter(n => !n.isRead).length;
      setUnreadCount(count);
    } catch (err) {
      console.error('Lỗi tải thông báo:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCount();
    // Polling định kỳ mỗi 30 giây để cập nhật số thông báo mới
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  // Click outside → đóng dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  };

  const handleItemClick = async (item) => {
    try {
      if (!item.isRead) {
        await markAsRead(item.id);
        setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, isRead: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Lỗi đánh dấu đã đọc:', err);
    }

    setIsOpen(false);

    if (item.targetUrl) {
      navigate(item.targetUrl);
    }
  };

  const handleMarkAllRead = async (e) => {
    e.stopPropagation();
    try {
      await markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Lỗi đánh dấu tất cả đã đọc:', err);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Nút Chuông: Duolingo pushable button */}
      <button
        onClick={handleToggle}
        className="w-10 h-10 rounded-2xl bg-white border-2 border-b-4 border-[#E5E5E5] active:border-b-2 active:translate-y-0.5 text-[#777777] hover:text-[#4B4B4B] hover:bg-[#F7F7F7] flex items-center justify-center transition-all cursor-pointer relative"
        title="Thông báo"
      >
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        
        {/* Số thông báo chưa đọc / Duolingo Red Dot */}
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-[#FF4B4B] border-2 border-white text-white text-[10px] font-black flex items-center justify-center shadow-sm animate-bounce">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown popup: Duolingo flat card */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-3 w-84 sm:w-96 bg-white rounded-2xl border-2 border-b-4 border-[#E5E5E5] shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-5 py-3.5 border-b-2 border-[#E5E5E5] bg-[#FAFAFA] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm text-[#4B4B4B] uppercase tracking-wider">
                Thông báo
              </h3>
              {unreadCount > 0 && (
                <span className="text-[11px] font-black text-[#FF4B4B] bg-[#FFDFDF] border border-[#FF4B4B]/30 px-2 py-0.5 rounded-full">
                  {unreadCount} mới
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-black text-[#1CB0F6] hover:text-[#0C90D6] flex items-center gap-1 cursor-pointer transition-colors"
                title="Đánh dấu tất cả đã đọc"
              >
                <span className="material-symbols-outlined text-[14px]">done_all</span>
                Đã đọc hết
              </button>
            )}
          </div>

          {/* Danh sách thông báo */}
          <div className="max-h-[380px] overflow-y-auto divide-y-2 divide-[#F0F0F0]">
            {!sessionStorage.getItem('accessToken') ? (
              <div className="p-8 flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#FFE8CC] border-2 border-b-4 border-[#FF9600] flex items-center justify-center text-[#E58800]">
                  <span className="material-symbols-outlined text-[28px]">account_circle</span>
                </div>
                <p className="text-xs font-black text-[#4B4B4B] uppercase tracking-wide">Chưa đăng nhập</p>
                <p className="text-xs font-bold text-[#777777] max-w-[240px]">Vui lòng đăng nhập để xem thông báo cập nhật về đơn đặt kho và hợp đồng của bạn.</p>
                <button
                  type="button"
                  onClick={() => { setIsOpen(false); navigate('/login'); }}
                  className="duo-btn-green px-5 py-2 text-xs mt-1"
                >
                  ĐĂNG NHẬP NGAY
                </button>
              </div>
            ) : loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#AFAFAF]">
                <div className="w-6 h-6 border-2 border-[#58CC02] border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-bold">Đang tải thông báo...</span>
              </div>
            ) : notifications.length === 0 ? (
              /* Trạng thái rỗng Duolingo style */
              <div className="px-5 py-10 flex flex-col items-center gap-3 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#DDF4FF] border-2 border-b-4 border-[#84D8FF] flex items-center justify-center text-[#1CB0F6]">
                  <span className="material-symbols-outlined text-[32px]">
                    notifications_active
                  </span>
                </div>
                <div>
                  <p className="font-black text-sm text-[#4B4B4B]">
                    Bạn đã cập nhật tất cả!
                  </p>
                  <p className="font-bold text-xs text-[#AFAFAF] mt-1">
                    Các nhắc nhở về kho và thông báo bảo mật sẽ xuất hiện ở đây.
                  </p>
                </div>
              </div>
            ) : (
              notifications.map((item) => {
                const cfg = TYPE_CONFIG[item.type] || {
                  icon: 'notifications',
                  bg: 'bg-[#F7F7F7]',
                  border: 'border-[#E5E5E5]',
                  color: 'text-[#777777]',
                  label: 'Tin nhắn'
                };

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`p-3.5 flex items-start gap-3 cursor-pointer transition-all hover:bg-[#F7F7F7] ${
                      !item.isRead ? 'bg-[#F4FAFF]' : 'bg-white'
                    }`}
                  >
                    {/* Icon loại thông báo */}
                    <div
                      className={`w-10 h-10 shrink-0 rounded-xl ${cfg.bg} border-2 border-b-4 ${cfg.border} ${cfg.color} flex items-center justify-center`}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {cfg.icon}
                      </span>
                    </div>

                    {/* Nội dung thông báo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-black text-[#4B4B4B] truncate">
                          {item.title}
                        </span>
                        <span className="text-[10px] font-extrabold text-[#AFAFAF] whitespace-nowrap">
                          {formatTimeAgo(item.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-[#777777] font-semibold mt-0.5 leading-snug line-clamp-2">
                        {item.message}
                      </p>

                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[#F0F0F0] text-[#777777]">
                          {cfg.label}
                        </span>
                        {item.targetUrl && (
                          <span className="text-[10px] font-black text-[#1CB0F6] flex items-center gap-0.5">
                            Xem ngay
                            <span className="material-symbols-outlined text-[11px]">arrow_forward</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dấu chấm xanh nếu chưa đọc */}
                    {!item.isRead && (
                      <span className="w-2.5 h-2.5 rounded-full bg-[#1CB0F6] shrink-0 mt-1.5 shadow-sm"></span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
