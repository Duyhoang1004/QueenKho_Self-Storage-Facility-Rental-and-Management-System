import { useState, useRef, useEffect } from 'react';

export default function UserDropdown({ user, onLogout }) {
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
      {/* Avatar button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer"
      >
        <span className="material-symbols-outlined text-on-primary text-[18px]">
          person
        </span>
      </button>

      {/* Dropdown popup */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-lg z-50 overflow-hidden">
          {/* User info */}
          <div className="px-4 py-3 border-b border-outline-variant/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                <span className="text-on-primary font-semibold font-title-md text-sm">
                  {user.initials}
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-title-md text-title-md text-on-surface font-semibold truncate">
                  {user.name}
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                  {user.email}
                </span>
              </div>
            </div>
          </div>

          {/* Logout button */}
          <div className="p-2">
            <button
              onClick={() => {
                setIsOpen(false);
                onLogout?.();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-error hover:bg-error-container/40 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              <span className="font-body-md text-body-md font-medium">Đăng xuất</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
