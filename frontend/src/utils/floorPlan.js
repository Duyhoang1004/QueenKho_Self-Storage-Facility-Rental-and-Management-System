// UC-06: Hình học của sơ đồ mặt bằng. Lưới 1 ô = 0.5m, toạ độ (x, y) = góc trên-trái.
// Quy tắc kiểm tra giống FloorPlanService ở backend (BE vẫn là nơi chặn cuối cùng).

export const CELL_METERS = 0.5;

export const FIXTURE_TYPES = {
  AISLE: {
    label: 'Lối đi',
    icon: 'directions_walk',
    className: 'bg-[#F7F7F7] border-2 border-dashed border-[#D0D0D0] text-[#AFAFAF]',
    defaultSize: { w: 20, h: 4 }
  },
  ENTRANCE: {
    label: 'Cửa vào',
    icon: 'door_open',
    className: 'bg-[#D7FFB8] border-2 border-[#58CC02] text-[#58A700]',
    defaultSize: { w: 4, h: 2 }
  },
  STAIRS: {
    label: 'Thang bộ',
    icon: 'stairs',
    className: 'bg-[#F6E8FF] border-2 border-[#CE82FF] text-[#A560E8]',
    defaultSize: { w: 6, h: 6 }
  },
  ELEVATOR: {
    label: 'Thang máy',
    icon: 'elevator',
    className: 'bg-[#F6E8FF] border-2 border-[#CE82FF] text-[#A560E8]',
    defaultSize: { w: 5, h: 5 }
  },
  OFFICE: {
    label: 'Văn phòng',
    icon: 'support_agent',
    className: 'bg-[#FFF0DB] border-2 border-[#FFB020] text-[#CC7A00]',
    defaultSize: { w: 8, h: 6 }
  }
};

export const DOOR_SIDES = [
  { id: 'TOP', label: 'Trên' },
  { id: 'RIGHT', label: 'Phải' },
  { id: 'BOTTOM', label: 'Dưới' },
  { id: 'LEFT', label: 'Trái' }
];

export const cellsToMeters = (cells) => Number((cells * CELL_METERS).toFixed(1));
export const metersToCells = (meters) => Math.max(1, Math.round(Number(meters) / CELL_METERS));

// Kích thước mặc định theo loại kho: 2 số đầu của dimensions ("2.5m × 2.4m × 2.7m" → 5 × 5 ô)
export function defaultUnitSize(dimensions, areaSqm) {
  const numbers = String(dimensions || '').match(/\d+(?:[.,]\d+)?/g);
  if (numbers && numbers.length >= 2) {
    return {
      w: metersToCells(numbers[0].replace(',', '.')),
      h: metersToCells(numbers[1].replace(',', '.'))
    };
  }
  const side = metersToCells(Math.sqrt(Number(areaSqm) || 4));
  return { w: side, h: side };
}

// Xoay 90° theo chiều kim đồng hồ: đổi rộng/cao, cửa quay theo
export function rotateRect(rect) {
  const order = ['TOP', 'RIGHT', 'BOTTOM', 'LEFT'];
  const door = rect.door ? order[(order.indexOf(rect.door) + 1) % 4] : rect.door;
  return { ...rect, w: rect.h, h: rect.w, door };
}

// Chạm cạnh không tính là chồng
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function rectInside(rect, gridWidth, gridHeight) {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= gridWidth && rect.y + rect.h <= gridHeight;
}

export function sameFloor(a, b) {
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
}

/**
 * Lỗi trên 1 tầng: ra ngoài mặt bằng, 2 ô chồng nhau, ô đè vật cố định.
 * items: [{ key, kind: 'unit' | 'fixture', name, x, y, w, h }]
 * @returns {{ keys: Set<string>, messages: string[] }}
 */
export function findConflicts(items, gridWidth, gridHeight) {
  const keys = new Set();
  const messages = [];
  const units = items.filter(i => i.kind === 'unit');
  const fixtures = items.filter(i => i.kind === 'fixture');

  items.forEach(item => {
    if (!rectInside(item, gridWidth, gridHeight)) {
      keys.add(item.key);
      messages.push(`${item.name} nằm ngoài mặt bằng`);
    }
  });
  units.forEach((a, i) => {
    units.slice(i + 1).forEach(b => {
      if (rectsOverlap(a, b)) {
        keys.add(a.key);
        keys.add(b.key);
        messages.push(`${a.name} chồng lên ${b.name}`);
      }
    });
    fixtures.forEach(f => {
      if (rectsOverlap(a, f)) {
        keys.add(a.key);
        keys.add(f.key);
        messages.push(`${a.name} đè lên ${f.name}`);
      }
    });
  });
  return { keys, messages };
}

// Đặt hình w × h tại (x, y), kéo vào trong mặt bằng nếu lố
export function clampToFloor(floor, size, x, y) {
  return {
    x: Math.max(0, Math.min(x, floor.gridWidth - size.w)),
    y: Math.max(0, Math.min(y, floor.gridHeight - size.h)),
    ...size
  };
}

// Đặt hình w × h sao cho ô lưới được bấm nằm giữa hình
export function centerOnCell(floor, size, x, y) {
  return clampToFloor(floor, size, x - Math.floor((size.w - 1) / 2), y - Math.floor((size.h - 1) / 2));
}

// Hình chiếm chỗ trên 1 tầng: ô kho đã đặt + vật cố định
export function occupiedOnFloor(floor, units) {
  return [
    ...units.filter(u => sameFloor(u.floor, floor.name) && u.mapX != null)
      .map(u => ({ x: u.mapX, y: u.mapY, w: u.mapW, h: u.mapH })),
    ...(floor.fixtures || [])
  ];
}

// Vị trí chọn cho ô mới có hợp lệ không (không chọn vị trí = hợp lệ)
export function isPlacementValid(floor, units, size, value) {
  if (!value) return true;
  const rect = clampToFloor(floor, size, value.x, value.y);
  return rectInside(rect, floor.gridWidth, floor.gridHeight)
    && !occupiedOnFloor(floor, units).some(o => rectsOverlap(rect, o));
}

// Tìm chỗ trống đầu tiên (quét từ trên xuống, trái sang phải) cho 1 hình w × h
export function findFreeSpot(w, h, occupied, gridWidth, gridHeight) {
  for (let y = 0; y + h <= gridHeight; y++) {
    for (let x = 0; x + w <= gridWidth; x++) {
      const rect = { x, y, w, h };
      if (!occupied.some(o => rectsOverlap(rect, o))) return { x, y };
    }
  }
  return { x: 0, y: 0 };
}
