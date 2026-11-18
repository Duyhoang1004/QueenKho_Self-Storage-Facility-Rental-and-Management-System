import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function UserDropdown({ user, onLogout, profilePath = '/ho-so' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

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
      {/* Avatar button with 2.5D push effect */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-2xl bg-[#58CC02] border-b-4 border-[#58A700] active:border-b-0 active:translate-y-1 flex items-center justify-center text-white transition-all cursor-pointer shadow-xs"
      >
        <span className="material-symbols-outlined text-[22px]">
          person
        </span>
      </button>

      {/* Dropdown popup: Duolingo Flat Card */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-3 w-64 bg-white rounded-2xl border-2 border-b-4 border-[#E5E5E5] shadow-xl z-50 overflow-hidden">
          {/* User info (click để vào trang cá nhân) */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              navigate(profilePath);
            }}
            title="Xem & chỉnh sửa hồ sơ cá nhân"
            className="w-full px-4 py-4 border-b-2 border-[#E5E5E5] bg-[#FAFAFA] hover:bg-[#F0FAFF] transition-colors text-left cursor-pointer group"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-[#1CB0F6] border-b-2 border-[#1899D6] group-hover:bg-[#1899D6] text-white flex items-center justify-center shrink-0 font-black text-sm transition-colors">
                  {user.initials || 'QK'}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-black text-[#4B4B4B] group-hover:text-[#1CB0F6] truncate transition-colors">
                    {user.name}
                  </span>
                  <span className="text-xs font-bold text-[#AFAFAF] truncate">
                    {user.email}
                  </span>
                </div>
              </div>
              <span className="material-symbols-outlined text-[18px] text-[#AFAFAF] group-hover:text-[#1CB0F6] shrink-0 transition-colors">
                chevron_right
              </span>
            </div>
          </button>

          {/* Logout button */}
          <div className="p-3">
            <button
              onClick={() => {
                setIsOpen(false);
                onLogout?.();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-b-4 border-[#FFDFDF] bg-[#FFF5F5] hover:bg-[#FFDFDF] text-[#FF4B4B] font-black text-xs uppercase tracking-wider transition-all cursor-pointer active:border-b-2 active:translate-y-0.5"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
