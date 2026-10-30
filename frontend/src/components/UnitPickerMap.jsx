import { useMemo, useState } from 'react';
import FloorPlanCanvas from './FloorPlanCanvas';
import useElementWidth from '../utils/useElementWidth';
import { getDisplayState } from '../utils/unitDisplayState';
import { cellsToMeters, sameFloor } from '../utils/floorPlan';

/**
 * UC-14: Chọn ô để gán trên mặt bằng (modal "Gán ô kho" của FM).
 * - layout:        { floors: [{ id, name, gridWidth, gridHeight, fixtures }] }
 * - units:         mọi ô của cơ sở (GET /storage-units)
 * - selectableIds: Set mã ô gán được (ô trống đúng loại khách đặt)
 * - selectedId / onSelect(id)
 * Ô gán được tô xanh và bấm được; ô khác giữ màu trạng thái nhưng mờ, không bấm được.
 */
export default function UnitPickerMap({ layout, units = [], selectableIds, selectedId, onSelect }) {
  const floors = useMemo(() => layout?.floors || [], [layout]);
  const [boxRef, boxWidth] = useElementWidth();
  // Tầng FM tự bấm chỉ có hiệu lực tới khi đổi ô đang chọn (chọn ô ở tầng khác → tự chuyển tầng)
  const [manualFloor, setManualFloor] = useState({ id: null, forSelected: null });
  const manualFloorId = manualFloor.forSelected === selectedId ? manualFloor.id : null;

  const isPlaced = (u) => u.mapX != null && u.mapY != null;
  const selectedUnit = units.find(u => u.id === selectedId);

  // Số ô gán được trên từng tầng (để mở sẵn tầng có ô gán được)
  const selectableCount = (floor) =>
    units.filter(u => selectableIds.has(u.id) && isPlaced(u) && sameFloor(u.floor, floor.name)).length;

  // Tầng đang xem: tầng FM tự chọn → tầng của ô đang chọn → tầng đầu tiên có ô gán được
  const floor = floors.find(f => f.id === manualFloorId)
    || (selectedUnit && isPlaced(selectedUnit) && floors.find(f => sameFloor(f.name, selectedUnit.floor)))
    || floors.find(f => selectableCount(f) > 0)
    || floors[0];

  if (!floor) return null;

  const cellSize = Math.max(5, Math.min(16, Math.floor((boxWidth - 12) / floor.gridWidth) || 8));
  const unplacedSelectable = units.filter(u => selectableIds.has(u.id) && !isPlaced(u));

  const canvasUnits = units
    .filter(u => isPlaced(u) && sameFloor(u.floor, floor.name))
    .map(u => {
      const selectable = selectableIds.has(u.id);
      return {
        id: u.id,
        label: `${u.zone || ''}${u.roomNumber || ''}`,
        x: u.mapX,
        y: u.mapY,
        w: u.mapW,
        h: u.mapH,
        door: u.mapDoor,
        state: getDisplayState(u),
        title: `${u.id} · ${u.unitTypeName} · bấm để chọn gán`,
        dimmed: !selectable,
        inert: !selectable
      };
    });

  return (
    <div className="flex flex-col gap-2">
      {floors.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {floors.map(f => {
            const count = selectableCount(f);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setManualFloor({ id: f.id, forSelected: selectedId })}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black border-2 cursor-pointer ${
                  f.id === floor.id
                    ? 'bg-[#DDF4FF] text-[#1899D6] border-[#84D8FF]'
                    : 'bg-white text-[#AFAFAF] border-[#E5E5E5] hover:text-[#777777]'
                }`}
              >
                {f.name}{count > 0 ? ` · ${count} ô` : ''}
              </button>
            );
          })}
        </div>
      )}

      <div ref={boxRef} className="overflow-auto">
        <FloorPlanCanvas
          gridWidth={floor.gridWidth}
          gridHeight={floor.gridHeight}
          cellSize={cellSize}
          units={canvasUnits}
          fixtures={(floor.fixtures || []).map(f => ({ ...f, key: f.id }))}
          selectedKey={selectedId ? `u:${selectedId}` : null}
          onSelect={key => {
            // Bấm lại ô đang chọn thì giữ nguyên (modal luôn cần 1 ô được chọn)
            if (key?.startsWith('u:')) onSelect(key.slice(2));
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-black text-[#777777]">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-[#58CC02]" />Gán được (bấm để chọn)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-[#AFAFAF] opacity-40" />Ô khác loại / đang dùng</span>
        <span className="text-[10px] font-bold text-[#AFAFAF]">
          {floor.name}: {cellsToMeters(floor.gridWidth)}m × {cellsToMeters(floor.gridHeight)}m
        </span>
      </div>

      {unplacedSelectable.length > 0 && (
        <p className="text-[11px] font-bold text-[#AFAFAF]">
          {unplacedSelectable.length} ô gán được chưa có vị trí trên mặt bằng ({unplacedSelectable.map(u => u.id).join(', ')}) — chọn trong danh sách bên cạnh.
        </p>
      )}
    </div>
  );
}
