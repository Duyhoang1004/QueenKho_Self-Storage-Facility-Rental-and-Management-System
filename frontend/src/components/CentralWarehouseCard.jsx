import { useEffect, useState } from 'react';
import { getFacilityCentralWarehouse } from '../services/catalogService';

/**
 * BR-134a (23/11/2026): kho tổng phụ trách cơ sở (cùng thành phố), hiện cạnh bản đồ cơ sở.
 * Kho tổng là địa điểm riêng, không vẽ trong sơ đồ ô — chỉ hiện tên, địa chỉ, hotline, nút chỉ đường.
 * - note: dòng giải thích dưới tiêu đề (khách / FM khác nhau)
 */
export default function CentralWarehouseCard({ facilityId, note }) {
  const [result, setResult] = useState({ forId: null, data: null });

  useEffect(() => {
    if (!facilityId) return undefined;
    let cancelled = false;
    getFacilityCentralWarehouse(facilityId)
      .then(data => { if (!cancelled) setResult({ forId: facilityId, data }); })
      .catch(() => { if (!cancelled) setResult({ forId: facilityId, data: null }); });
    return () => { cancelled = true; };
  }, [facilityId]);

  if (!facilityId || result.forId !== facilityId || !result.data) return null;
  const { warehouse, facilityCity } = result.data;

  if (!warehouse) {
    return (
      <div className="flex items-start gap-2 rounded-2xl border-2 border-dashed border-[#E5E5E5] bg-[#F7F7F7] px-3 py-2.5">
        <span className="material-symbols-outlined text-[20px] text-[#AFAFAF]">home_storage</span>
        <p className="text-[11px] font-bold text-[#777777]">
          {facilityCity ? `${facilityCity} chưa có kho tổng` : 'Cơ sở chưa có kho tổng phụ trách'} — hàng quá hạn sẽ chuyển về kho tổng gần nhất, cơ sở báo địa chỉ khi cần.
        </p>
      </div>
    );
  }

  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(warehouse.address)}`;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-[#E5E5E5] bg-white px-3 py-3">
      <div className="flex items-start gap-2">
        <div className="w-9 h-9 rounded-xl bg-[#FFF4E5] border-2 border-[#FFC800] text-[#E58800] flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[20px]">home_storage</span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-black uppercase text-[#AFAFAF]">
            Kho tổng phụ trách{facilityCity ? ` · ${facilityCity}` : ''}
          </span>
          <span className="text-sm font-black text-[#4B4B4B]">{warehouse.name}</span>
          {note && <span className="text-[11px] font-bold text-[#777777] leading-snug">{note}</span>}
        </div>
      </div>
      <div className="flex flex-col gap-1 text-xs font-bold text-[#4B4B4B] pl-11">
        <span className="flex items-start gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-[#AFAFAF]">location_on</span>
          <span>{warehouse.address}</span>
        </span>
        {warehouse.hotline && (
          <a href={`tel:${warehouse.hotline}`} className="flex items-center gap-1.5 text-[#1CB0F6] hover:underline w-fit">
            <span className="material-symbols-outlined text-[16px]">call</span>
            {warehouse.hotline}
          </a>
        )}
      </div>
      <div className="pl-11">
        <a href={mapUrl} target="_blank" rel="noopener noreferrer"
          className="duo-btn-white inline-flex items-center gap-1 px-3 py-1.5 text-[11px]">
          <span className="material-symbols-outlined text-[16px]">directions</span>
          Chỉ đường
        </a>
      </div>
    </div>
  );
}
