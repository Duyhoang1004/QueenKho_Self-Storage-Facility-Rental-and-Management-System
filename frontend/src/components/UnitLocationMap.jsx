import { useEffect, useState } from 'react';
import FloorPlanCanvas from './FloorPlanCanvas';
import useElementWidth from '../utils/useElementWidth';
import { getUnitLocation } from '../services/contractService';
import { cellsToMeters } from '../utils/floorPlan';

const MINE_TILE = 'bg-[#1CB0F6] border-[#1899D6] text-white animate-pulse';
const OTHER_TILE = 'bg-[#F0F0F0] border-[#E5E5E5] text-[#CFCFCF]';

/**
 * UC-06: Bản đồ CHỈ XEM vị trí ô của 1 hợp đồng (trang hợp đồng của khách, chi tiết task của Staff / FM).
 * Ô khác chỉ là khối xám, không mã / trạng thái. Hợp đồng đã kết thúc (409) thì không hiện gì.
 * - viewer: 'customer' → "Ô của bạn"; 'staff' → "Ô cần tới"
 */
export default function UnitLocationMap({ contractId, viewer = 'customer' }) {
  const [result, setResult] = useState({ forId: null, data: null, error: '' });
  const [boxRef, boxWidth] = useElementWidth();

  useEffect(() => {
    if (!contractId) return undefined;
    let cancelled = false;
    getUnitLocation(contractId)
      .then(data => { if (!cancelled) setResult({ forId: contractId, data, error: '' }); })
      .catch(err => {
        if (cancelled) return;
        // 409 CONTRACT_NOT_ACTIVE: hợp đồng đã kết thúc → ẩn bản đồ, không báo lỗi
        const hidden = err.response?.status === 409;
        setResult({ forId: contractId, data: null, error: hidden ? '' : (err.response?.data?.message || 'Không tải được vị trí ô kho.') });
      });
    return () => { cancelled = true; };
  }, [contractId]);

  if (!contractId) return null;
  const loading = result.forId !== contractId;
  if (loading) {
    return <p className="text-xs font-bold text-[#AFAFAF]">Đang tải vị trí ô kho...</p>;
  }
  if (result.error) {
    return <p className="text-xs font-bold text-[#FF4B4B]">{result.error}</p>;
  }
  const location = result.data;
  if (!location) return null;

  const mineLabel = viewer === 'staff' ? 'Ô cần tới' : 'Ô của bạn';
  const plan = location.floorPlan;
  const cellSize = plan
    ? Math.max(4, Math.min(14, Math.floor((boxWidth - 8) / plan.gridWidth) || 6))
    : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2 rounded-2xl bg-[#DDF4FF] border-2 border-[#84D8FF] px-3 py-2.5">
        <span className="material-symbols-outlined text-[20px] text-[#1CB0F6]">location_on</span>
        <div className="flex flex-col">
          <span className="text-sm font-black text-[#1899D6]">{location.locationHint || location.unitId}</span>
          {!location.placed && (
            <span className="text-[11px] font-bold text-[#777777]">
              Cơ sở chưa cập nhật sơ đồ cho ô này — hỏi lễ tân để được chỉ đường.
            </span>
          )}
        </div>
      </div>

      {location.placed && plan && (
        <>
          <div ref={boxRef} className="overflow-x-auto">
            <FloorPlanCanvas
              gridWidth={plan.gridWidth}
              gridHeight={plan.gridHeight}
              cellSize={cellSize}
              fixtures={(plan.fixtures || []).map(f => ({ ...f, key: f.id }))}
              units={[
                ...(plan.otherUnits || []).map((r, i) => ({
                  id: `other-${i}`,
                  label: '',
                  ...r,
                  tileClass: OTHER_TILE,
                  icon: null,
                  inert: true,
                  ariaLabel: 'Ô kho khác'
                })),
                {
                  id: location.unitId,
                  label: `${location.zone || ''}${location.roomNumber || ''}`,
                  ...location.unit,
                  door: location.door,
                  tileClass: MINE_TILE,
                  icon: 'location_on',
                  inert: true,
                  ariaLabel: `${mineLabel}: ${location.unitId}`,
                  title: `${mineLabel}: ${location.unitId}`
                }
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-black text-[#777777]">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-[#1CB0F6]" />{mineLabel}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-[#F0F0F0] border border-[#E5E5E5]" />Ô khác</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-[#D7FFB8] border border-[#58CC02]" />Cửa vào</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-[#F7F7F7] border border-dashed border-[#D0D0D0]" />Lối đi</span>
            <span className="text-[10px] font-bold text-[#AFAFAF]">
              {plan.name}: {cellsToMeters(plan.gridWidth)}m × {cellsToMeters(plan.gridHeight)}m · lưới 1m
            </span>
          </div>
        </>
      )}
    </div>
  );
}
