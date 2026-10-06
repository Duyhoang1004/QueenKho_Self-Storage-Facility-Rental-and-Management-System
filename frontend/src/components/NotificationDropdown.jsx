import { useState, useRef, useEffect } from 'react';

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button: Duolingo pushable button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-2xl bg-white border-2 border-b-4 border-[#E5E5E5] active:border-b-2 active:translate-y-0.5 text-[#777777] hover:text-[#4B4B4B] hover:bg-[#F7F7F7] flex items-center justify-center transition-all cursor-pointer relative"
      >
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        {/* Playful Duolingo Red Dot */}
        <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#FF4B4B] border-2 border-white"></span>
      </button>

      {/* Dropdown popup: Duolingo flat card */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-3 w-80 bg-white rounded-2xl border-2 border-b-4 border-[#E5E5E5] shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b-2 border-[#E5E5E5] bg-[#FAFAFA] flex items-center justify-between">
            <h3 className="font-black text-sm text-[#4B4B4B] uppercase tracking-wider">
              Thông báo
            </h3>
            <span className="text-[11px] font-black uppercase text-[#1CB0F6] bg-[#DDF4FF] px-2 py-0.5 rounded-full">
              Mới nhất
            </span>
          </div>

          {/* Empty state with playful Duolingo style */}
          <div className="px-5 py-8 flex flex-col items-center gap-3 text-center">
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
        </div>
      )}
    </div>
  );
}
