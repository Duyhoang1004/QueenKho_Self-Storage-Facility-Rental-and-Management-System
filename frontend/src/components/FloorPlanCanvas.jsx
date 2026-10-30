import { useRef } from 'react';
import { DISPLAY_STATES } from '../utils/unitDisplayState';
import { FIXTURE_TYPES } from '../utils/floorPlan';

// Vạch cửa ô kho theo phía cửa
const DOOR_CLASS = {
  TOP: 'top-[2px] left-1/4 right-1/4 h-[3px]',
  BOTTOM: 'bottom-[2px] left-1/4 right-1/4 h-[3px]',
  LEFT: 'left-[2px] top-1/4 bottom-1/4 w-[3px]',
  RIGHT: 'right-[2px] top-1/4 bottom-1/4 w-[3px]'
};

/**
 * UC-06: Vẽ mặt bằng 1 tầng theo lưới (1 ô = 0.5m).
 * - units:    [{ id, label, x, y, w, h, door, state, title, dimmed }]  (state = trạng thái hiển thị)
 * - fixtures: [{ key, type, label, x, y, w, h }]
 * - editable: kéo thả ô / vật cố định, kéo góc để đổi kích thước vật cố định
 * - pickMode: mọi thứ chỉ để xem, bấm bất kỳ đâu → onCellClick(x, y) (dùng khi chọn chỗ cho ô mới)
 * - ghost:    { x, y, w, h, valid } khung xem trước vị trí
 */
export default function FloorPlanCanvas({
  gridWidth,
  gridHeight,
  cellSize,
  units = [],
  fixtures = [],
  editable = false,
  pickMode = false,
  selectedKey = null,
  conflictKeys,
  onSelect,
  onItemChange,
  onCellClick,
  onCellHover,
  ghost = null
}) {
  const canvasRef = useRef(null);
  const dragRef = useRef(null);

  // Toạ độ chuột → ô lưới (tính từ mép trong của viền khung)
  const cellAt = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const left = rect.left + canvas.clientLeft;
    const top = rect.top + canvas.clientTop;
    return {
      x: Math.min(gridWidth - 1, Math.max(0, Math.floor((event.clientX - left) / cellSize))),
      y: Math.min(gridHeight - 1, Math.max(0, Math.floor((event.clientY - top) / cellSize)))
    };
  };

  const startDrag = (event, key, item, mode) => {
    if (!editable || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect?.(key);
    dragRef.current = { key, mode, startX: event.clientX, startY: event.clientY, orig: { ...item } };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = Math.round((event.clientX - drag.startX) / cellSize);
    const dy = Math.round((event.clientY - drag.startY) / cellSize);
    const { orig } = drag;
    if (drag.mode === 'move') {
      const x = Math.min(Math.max(0, orig.x + dx), Math.max(0, gridWidth - orig.w));
      const y = Math.min(Math.max(0, orig.y + dy), Math.max(0, gridHeight - orig.h));
      if (x !== drag.lastX || y !== drag.lastY) {
        drag.lastX = x;
        drag.lastY = y;
        onItemChange?.(drag.key, { x, y });
      }
    } else {
      const w = Math.min(Math.max(1, orig.w + dx), gridWidth - orig.x);
      const h = Math.min(Math.max(1, orig.h + dy), gridHeight - orig.y);
      if (w !== drag.lastW || h !== drag.lastH) {
        drag.lastW = w;
        drag.lastH = h;
        onItemChange?.(drag.key, { w, h });
      }
    }
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const box = (item) => ({
    left: item.x * cellSize,
    top: item.y * cellSize,
    width: item.w * cellSize,
    height: item.h * cellSize
  });

  const ringClass = (key) => {
    if (conflictKeys?.has(key)) return 'ring-2 ring-[#FF4B4B] ring-offset-1 z-30';
    if (selectedKey === key) return 'ring-4 ring-[#1CB0F6]/70 z-20';
    return '';
  };

  return (
    <div
      ref={canvasRef}
      className={`relative shrink-0 bg-white border-4 border-[#4B4B4B] rounded-md select-none box-content ${
        pickMode ? 'cursor-crosshair' : ''
      }`}
      style={{
        width: gridWidth * cellSize,
        height: gridHeight * cellSize,
        // Lưới mờ mỗi 1m (2 ô)
        backgroundImage:
          'linear-gradient(to right, #F0F0F0 1px, transparent 1px), linear-gradient(to bottom, #F0F0F0 1px, transparent 1px)',
        backgroundSize: `${cellSize * 2}px ${cellSize * 2}px`,
        touchAction: editable ? 'none' : 'auto'
      }}
      onPointerDown={(event) => {
        if (pickMode) {
          const { x, y } = cellAt(event);
          onCellClick?.(x, y);
        } else if (event.target === canvasRef.current) {
          onSelect?.(null);
          const { x, y } = cellAt(event);
          onCellClick?.(x, y);
        }
      }}
      onPointerMove={(event) => {
        if (onCellHover) {
          const { x, y } = cellAt(event);
          onCellHover(x, y);
        }
      }}
      onPointerLeave={() => onCellHover?.(null, null)}
    >
      {/* Vật cố định: lối đi, cửa, thang, văn phòng */}
      {fixtures.map(fixture => {
        const key = `f:${fixture.key}`;
        const style = FIXTURE_TYPES[fixture.type] || FIXTURE_TYPES.AISLE;
        const pixelW = fixture.w * cellSize;
        const pixelH = fixture.h * cellSize;
        return (
          <div
            key={key}
            title={`${fixture.label || style.label} · ${fixture.w / 2}m × ${fixture.h / 2}m`}
            onPointerDown={editable ? (e) => startDrag(e, key, fixture, 'move') : undefined}
            onPointerMove={editable ? moveDrag : undefined}
            onPointerUp={editable ? endDrag : undefined}
            className={`absolute rounded-sm flex items-center justify-center gap-1 overflow-hidden ${style.className} ${
              editable ? 'cursor-move' : ''
            } ${pickMode ? 'pointer-events-none' : ''} ${ringClass(key)}`}
            style={box(fixture)}
          >
            {pixelW >= 18 && pixelH >= 18 && (
              <span className="material-symbols-outlined text-[14px] leading-none">{style.icon}</span>
            )}
            {pixelW >= 56 && pixelH >= 14 && (
              <span className="text-[9px] font-black uppercase tracking-wide truncate">
                {fixture.label || style.label}
              </span>
            )}
            {editable && selectedKey === key && (
              <span
                onPointerDown={(e) => startDrag(e, key, fixture, 'resize')}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                className="absolute right-0 bottom-0 w-3 h-3 bg-[#1CB0F6] rounded-tl cursor-nwse-resize"
                title="Kéo để đổi kích thước"
              />
            )}
          </div>
        );
      })}

      {/* Ô kho (tileClass / icon / inert: dùng cho bản đồ chỉ xem của khách, Staff) */}
      {units.map(unit => {
        const key = `u:${unit.id}`;
        const style = DISPLAY_STATES[unit.state] || DISPLAY_STATES.UNKNOWN;
        const tileClass = unit.tileClass || style.tile;
        const icon = unit.icon === undefined ? style.icon : unit.icon;
        const pixelW = unit.w * cellSize;
        const pixelH = unit.h * cellSize;
        return (
          <button
            key={key}
            type="button"
            title={unit.title}
            tabIndex={unit.inert ? -1 : undefined}
            aria-label={unit.ariaLabel || `${unit.id}: ${style.label}`}
            aria-pressed={selectedKey === key}
            onClick={!editable && !pickMode ? () => onSelect?.(selectedKey === key ? null : key) : undefined}
            onPointerDown={editable ? (e) => startDrag(e, key, unit, 'move') : undefined}
            onPointerMove={editable ? moveDrag : undefined}
            onPointerUp={editable ? endDrag : undefined}
            className={`absolute rounded-sm border-2 flex flex-col items-center justify-center overflow-hidden transition-[box-shadow,opacity] ${tileClass} ${
              editable ? 'cursor-move' : 'cursor-pointer hover:brightness-95'
            } ${pickMode || unit.inert ? 'pointer-events-none' : ''} ${unit.dimmed ? 'opacity-25' : ''} ${ringClass(key)}`}
            style={box(unit)}
          >
            {icon && pixelW >= 30 && pixelH >= 34 && (
              <span className="material-symbols-outlined text-[14px] leading-none">{icon}</span>
            )}
            <span
              className={`font-black font-mono leading-none ${pixelW >= 40 ? 'text-[10px]' : 'text-[8px]'} ${
                pixelW < 26 ? '[writing-mode:vertical-rl]' : ''
              }`}
            >
              {unit.label}
            </span>
            {unit.door && (
              <span className={`absolute rounded-full bg-current opacity-60 ${DOOR_CLASS[unit.door] || ''}`} />
            )}
          </button>
        );
      })}

      {/* Khung xem trước vị trí */}
      {ghost && (
        <div
          className={`absolute pointer-events-none rounded-sm border-2 border-dashed z-40 ${
            ghost.valid ? 'bg-[#58CC02]/25 border-[#58CC02]' : 'bg-[#FF4B4B]/25 border-[#FF4B4B]'
          }`}
          style={box(ghost)}
        />
      )}
    </div>
  );
}
