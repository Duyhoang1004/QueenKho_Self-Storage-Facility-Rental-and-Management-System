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
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded transition-colors cursor-pointer"
      >
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        {/* Badge dot - ẩn khi không có thông báo */}
        {/* <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error"></span> */}
      </button>

      {/* Dropdown popup */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-outline-variant/40">
            <h3 className="font-title-md text-title-md text-on-surface font-semibold">
              Thông báo
            </h3>
          </div>

          {/* Empty state */}
          <div className="px-4 py-8 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px] text-outline">
                notifications_off
              </span>
            </div>
            <div className="text-center">
              <p className="font-body-md text-body-md text-on-surface-variant font-medium">
                Chưa có thông báo mới
              </p>
              <p className="font-body-sm text-body-sm text-outline mt-0.5">
                Các thông báo về kho và hợp đồng sẽ hiển thị ở đây
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
