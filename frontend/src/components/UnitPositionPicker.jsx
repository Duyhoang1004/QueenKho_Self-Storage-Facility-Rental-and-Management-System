import { useMemo, useState } from 'react';
import FloorPlanCanvas from './FloorPlanCanvas';
import useElementWidth from '../utils/useElementWidth';
import { getDisplayState } from '../utils/unitDisplayState';
import { DOOR_SIDES, cellsToMeters, centerOnCell, clampToFloor, isPlacementValid, sameFloor } from '../utils/floorPlan';

/**
 * UC-06: Chọn chỗ cho ô kho mới trên mặt bằng tầng (dùng trong form "Thêm ô kho mới").
 * - floor:    mặt bằng tầng đã chọn { gridWidth, gridHeight, fixtures }
 * - units:    toàn bộ ô kho của cơ sở (lọc ra ô đã đặt trên tầng này)
 * - size:     { w, h } kích thước ô mới (ô lưới)
 * - value:    { x, y, door } | null; onChange(value)
 * - onRotate: xoay ô (đổi rộng / dài)
 */
export default function UnitPositionPicker({ floor, units, size, value, onChange, onRotate }) {
  const [boxRef, boxWidth] = useElementWidth();
  const [hover, setHover] = useState(null);
  const cellSize = Math.max(5, Math.min(16, Math.floor((boxWidth - 12) / floor.gridWidth) || 8));

  const placed = useMemo(
    () => units.filter(u => sameFloor(u.floor, floor.name) && u.mapX != null),
    [units, floor]
  );

  const clampRect = (x, y) => clampToFloor(floor, size, x, y);
  const isValid = (rect) => isPlacementValid(floor, units, size, rect);

  const shown = value ? clampRect(value.x, value.y) : hover ? centerOnCell(floor, size, hover.x, hover.y) : null;
  const valid = value ? isValid(value) : null;

  return (
    <div className="flex flex-col gap-2">
      <div ref={boxRef} className="overflow-auto">
        <FloorPlanCanvas
          gridWidth={floor.gridWidth}
          gridHeight={floor.gridHeight}
          cellSize={cellSize}
          pickMode
          units={placed.map(u => ({
            id: u.id,
            label: `${u.zone || ''}${u.roomNumber || ''}`,
            x: u.mapX,
            y: u.mapY,
            w: u.mapW,
            h: u.mapH,
            door: u.mapDoor,
            state: getDisplayState(u),
            title: u.id
          }))}
          fixtures={(floor.fixtures || []).map(f => ({ ...f, key: f.id }))}
          onCellClick={(x, y) => {
            const rect = centerOnCell(floor, size, x, y);
            onChange({ x: rect.x, y: rect.y, door: value?.door || 'BOTTOM' });
          }}
          onCellHover={(x, y) => setHover(x == null ? null : { x, y })}
          ghost={shown ? { ...shown, valid: isValid(shown) } : null}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
        <span className={value ? (valid ? 'text-[#58A700]' : 'text-[#FF4B4B]') : 'text-[#AFAFAF]'}>
          {value
            ? valid
              ? `Vị trí: cách trái ${cellsToMeters(clampRect(value.x, value.y).x)}m, cách trên ${cellsToMeters(clampRect(value.x, value.y).y)}m`
              : 'Chỗ này chồng lên ô khác / lối đi — chọn chỗ khác'
            : 'Bấm vào chỗ trống trên mặt bằng để đặt ô (không bắt buộc)'}
        </span>
        <span className="text-[#AFAFAF]">· {cellsToMeters(size.w)}m × {cellsToMeters(size.h)}m</span>
        <button type="button" onClick={onRotate} className="duo-btn-white px-2 py-1 text-[11px]">
          <span className="material-symbols-outlined text-[15px] mr-0.5">rotate_right</span>Xoay
        </button>
        {value && (
          <>
            <select
              value={value.door}
              onChange={e => onChange({ ...value, door: e.target.value })}
              className="duo-input py-1 text-[11px]"
              title="Phía cửa"
            >
              {DOOR_SIDES.map(d => <option key={d.id} value={d.id}>Cửa: {d.label}</option>)}
            </select>
            <button type="button" onClick={() => onChange(null)} className="text-[#AFAFAF] hover:text-[#FF4B4B] underline">
              Bỏ vị trí
            </button>
          </>
        )}
      </div>
    </div>
  );
}
