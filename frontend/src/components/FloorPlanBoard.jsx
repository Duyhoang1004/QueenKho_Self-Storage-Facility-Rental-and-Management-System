import { useEffect, useMemo, useState } from 'react';
import FloorPlanCanvas from './FloorPlanCanvas';
import useElementWidth from '../utils/useElementWidth';
import { createFloor, updateFloor, deleteFloor, saveFloorPlan } from '../services/storageUnitService';
import { DISPLAY_STATES, DISPLAY_STATE_ORDER, getDisplayState } from '../utils/unitDisplayState';
import {
  FIXTURE_TYPES,
  DOOR_SIDES,
  cellsToMeters,
  metersToCells,
  rotateRect,
  findConflicts,
  findFreeSpot,
  centerOnCell,
  rectsOverlap,
  rectInside,
  sameFloor
} from '../utils/floorPlan';

const ZOOM_STEPS = [0.6, 0.8, 1, 1.25, 1.5, 2];
let fixtureSeq = 0;
const newFixtureKey = () => `new-${++fixtureSeq}`;

const unitLabel = (unit) => `${unit.zone || ''}${unit.roomNumber || unit.id}`;
const isPlaced = (unit) => unit.mapX != null && unit.mapY != null;

function unitTitle(unit) {
  const state = DISPLAY_STATES[getDisplayState(unit)];
  const lines = [
    `${unit.id} · ${state.label}`,
    `${unit.unitTypeName || '---'} · ${unit.areaSqm ?? '?'} m²`
  ];
  if (unit.currentContract) {
    lines.push(`HĐ #${unit.currentContract.contractCode}`);
    lines.push(`Khách: ${unit.currentContract.customerName || '---'}`);
    if (unit.currentContract.endDate) lines.push(`Hết hạn: ${unit.currentContract.endDate}`);
  }
  return lines.join('\n');
}

const fixturesOf = (floor) =>
  (floor?.fixtures || []).map(f => ({ key: `db-${f.id}`, type: f.type, label: f.label || '', x: f.x, y: f.y, w: f.w, h: f.h }));

/**
 * UC-06: Sơ đồ mặt bằng ô kho theo tầng.
 * - Xem: ô tô màu theo trạng thái, bấm ô → onSelectUnit (trang hiện panel chi tiết)
 * - Chỉnh sửa (FM): kéo thả ô / lối đi / cửa / thang, xoay, đổi phía cửa, đặt ô chưa có vị trí, quản lý tầng
 * Props:
 *  layout      { floors: [{ id, name, gridWidth, gridHeight, fixtures }] }
 *  units       toàn bộ ô kho của cơ sở (chưa lọc)
 *  matchedIds  Set id ô khớp bộ lọc của trang (null = không lọc) → ô không khớp bị làm mờ
 */
export default function FloorPlanBoard({
  facilityId,
  layout,
  units = [],
  matchedIds = null,
  selectedUnitId,
  onSelectUnit,
  editing,
  onEditingChange,
  onChanged,
  onNotify
}) {
  const floors = useMemo(() => layout?.floors || [], [layout]);
  const [activeFloorId, setActiveFloorId] = useState(null);
  const floor = floors.find(f => f.id === activeFloorId) || floors[0] || null;

  const [zoomIndex, setZoomIndex] = useState(2);
  const [canvasBoxRef, canvasBoxWidth] = useElementWidth();
  const cellSize = floor
    ? Math.max(5, Math.min(28, Math.floor((canvasBoxWidth - 16) / floor.gridWidth) || 10)) * ZOOM_STEPS[zoomIndex]
    : 10;

  // ---------- Bản nháp khi chỉnh sửa ----------
  const [draftUnits, setDraftUnits] = useState({});       // id → { x, y, w, h, door } | { removed: true }
  const [draftFixtures, setDraftFixtures] = useState([]);
  const [fixturesDirty, setFixturesDirty] = useState(false);
  const [editSelectedKey, setEditSelectedKey] = useState(null);
  const [placingUnitId, setPlacingUnitId] = useState(null);
  const [hoverCell, setHoverCell] = useState(null);
  const [saving, setSaving] = useState(false);
  const [floorModal, setFloorModal] = useState(null);     // { mode, name, widthM, heightM, submitting }

  const dirty = fixturesDirty || Object.keys(draftUnits).length > 0;

  const resetDraft = (targetFloor) => {
    setDraftUnits({});
    setDraftFixtures(fixturesOf(targetFloor));
    setFixturesDirty(false);
    setEditSelectedKey(null);
    setPlacingUnitId(null);
  };

  // Ô kho sau khi áp bản nháp
  const effectiveUnits = useMemo(() => {
    if (!editing) return units;
    return units.map(unit => {
      const d = draftUnits[unit.id];
      if (!d) return unit;
      if (d.removed) return { ...unit, mapX: null, mapY: null, mapW: null, mapH: null };
      return { ...unit, floor: floor?.name, mapX: d.x, mapY: d.y, mapW: d.w, mapH: d.h, mapDoor: d.door };
    });
  }, [editing, units, draftUnits, floor]);

  const floorUnits = useMemo(
    () => (floor ? effectiveUnits.filter(u => sameFloor(u.floor, floor.name) && isPlaced(u)) : []),
    [effectiveUnits, floor]
  );
  const unplacedUnits = useMemo(() => effectiveUnits.filter(u => !isPlaced(u)), [effectiveUnits]);
  const fixtures = editing ? draftFixtures : fixturesOf(floor);

  const conflicts = useMemo(() => {
    if (!editing || !floor) return { keys: new Set(), messages: [] };
    return findConflicts(
      [
        ...floorUnits.map(u => ({ key: `u:${u.id}`, kind: 'unit', name: u.id, x: u.mapX, y: u.mapY, w: u.mapW, h: u.mapH })),
        ...draftFixtures.map(f => ({ key: `f:${f.key}`, kind: 'fixture', name: f.label || FIXTURE_TYPES[f.type].label, ...f }))
      ],
      floor.gridWidth,
      floor.gridHeight
    );
  }, [editing, floor, floorUnits, draftFixtures]);

  // Mọi hình đang chiếm chỗ trên tầng (để tìm chỗ trống / kiểm tra khung xem trước)
  const occupiedRects = useMemo(() => [
    ...floorUnits.map(u => ({ id: u.id, x: u.mapX, y: u.mapY, w: u.mapW, h: u.mapH })),
    ...draftFixtures.map(f => ({ id: f.key, x: f.x, y: f.y, w: f.w, h: f.h }))
  ], [floorUnits, draftFixtures]);

  const placingUnit = placingUnitId ? unplacedUnits.find(u => u.id === placingUnitId) : null;
  const placingSize = useMemo(
    () => (placingUnit ? { w: placingUnit.defaultMapW || 4, h: placingUnit.defaultMapH || 4 } : null),
    [placingUnit]
  );

  const ghost = useMemo(() => {
    if (!placingSize || !hoverCell || !floor) return null;
    const rect = centerOnCell(floor, placingSize, hoverCell.x, hoverCell.y);
    return {
      ...rect,
      valid: rectInside(rect, floor.gridWidth, floor.gridHeight) && !occupiedRects.some(o => rectsOverlap(rect, o))
    };
  }, [placingSize, hoverCell, floor, occupiedRects]);

  // ---------- Thao tác chỉnh sửa ----------
  const unitRect = (id) => {
    const u = effectiveUnits.find(x => x.id === id);
    return { x: u.mapX, y: u.mapY, w: u.mapW, h: u.mapH, door: u.mapDoor || 'BOTTOM' };
  };

  const updateItem = (key, patch) => {
    if (key.startsWith('u:')) {
      const id = key.slice(2);
      setDraftUnits(prev => ({ ...prev, [id]: { ...unitRect(id), ...patch } }));
    } else {
      const fKey = key.slice(2);
      setDraftFixtures(prev => prev.map(f => (f.key === fKey ? { ...f, ...patch } : f)));
      setFixturesDirty(true);
    }
  };

  const placeUnitAt = (x, y) => {
    if (!placingUnit || !floor) return;
    const rect = { ...centerOnCell(floor, placingSize, x, y), door: placingUnit.mapDoor || 'BOTTOM' };
    setDraftUnits(prev => ({ ...prev, [placingUnit.id]: rect }));
    setEditSelectedKey(`u:${placingUnit.id}`);
    setPlacingUnitId(null);
  };

  const addFixture = (type) => {
    if (!floor) return;
    const { w, h } = FIXTURE_TYPES[type].defaultSize;
    const spot = findFreeSpot(w, h, occupiedRects, floor.gridWidth, floor.gridHeight);
    const fixture = { key: newFixtureKey(), type, label: FIXTURE_TYPES[type].label, ...spot, w, h };
    setDraftFixtures(prev => [...prev, fixture]);
    setFixturesDirty(true);
    setEditSelectedKey(`f:${fixture.key}`);
  };

  const selectedFixture = editSelectedKey?.startsWith('f:')
    ? draftFixtures.find(f => f.key === editSelectedKey.slice(2))
    : null;
  const selectedUnit = editSelectedKey?.startsWith('u:')
    ? floorUnits.find(u => u.id === editSelectedKey.slice(2))
    : null;

  const rotateSelected = () => {
    if (selectedUnit) updateItem(editSelectedKey, rotateRect(unitRect(selectedUnit.id)));
    if (selectedFixture) updateItem(editSelectedKey, { w: selectedFixture.h, h: selectedFixture.w });
  };

  const removeSelected = () => {
    if (selectedUnit) {
      setDraftUnits(prev => {
        const original = units.find(u => u.id === selectedUnit.id);
        // Ô vừa đặt từ danh sách chờ mà chưa lưu → chỉ bỏ nháp
        if (original && !isPlaced(original)) {
          const next = { ...prev };
          delete next[selectedUnit.id];
          return next;
        }
        return { ...prev, [selectedUnit.id]: { removed: true } };
      });
    }
    if (selectedFixture) {
      setDraftFixtures(prev => prev.filter(f => f.key !== selectedFixture.key));
      setFixturesDirty(true);
    }
    setEditSelectedKey(null);
  };

  // Phím tắt khi chỉnh sửa: mũi tên dời 0.5m (Shift = 1m), R xoay, Delete gỡ / xoá, Esc bỏ chọn
  useEffect(() => {
    if (!editing) return undefined;
    const onKey = (event) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
      if (event.key === 'Escape') {
        setPlacingUnitId(null);
        setEditSelectedKey(null);
        return;
      }
      if (!editSelectedKey || !floor) return;
      const step = event.shiftKey ? 2 : 1;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const current = selectedUnit
        ? unitRect(selectedUnit.id)
        : selectedFixture;
      if (!current) return;
      if (moves[event.key]) {
        event.preventDefault();
        const [dx, dy] = moves[event.key];
        updateItem(editSelectedKey, {
          x: Math.max(0, Math.min(current.x + dx, floor.gridWidth - current.w)),
          y: Math.max(0, Math.min(current.y + dy, floor.gridHeight - current.h))
        });
      } else if (event.key === 'r' || event.key === 'R') {
        rotateSelected();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---------- Bắt đầu / huỷ / lưu ----------
  const startEditing = () => {
    resetDraft(floor);
    onSelectUnit?.(null);
    onEditingChange(true);
  };

  const cancelEditing = () => {
    if (dirty && !window.confirm('Bỏ các thay đổi mặt bằng chưa lưu?')) return;
    resetDraft(floor);
    onEditingChange(false);
  };

  const switchFloor = (target) => {
    if (target.id === floor?.id) return;
    if (editing && dirty && !window.confirm('Tầng hiện tại còn thay đổi chưa lưu. Chuyển tầng và bỏ các thay đổi?')) return;
    setActiveFloorId(target.id);
    if (editing) resetDraft(target);
  };

  const handleSave = async () => {
    if (!floor || conflicts.messages.length > 0) return;
    setSaving(true);
    try {
      await saveFloorPlan(floor.id, {
        units: Object.entries(draftUnits).map(([unitId, d]) => (d.removed
          ? { unitId, x: null }
          : { unitId, x: d.x, y: d.y, w: d.w, h: d.h, door: d.door })),
        fixtures: draftFixtures.map(({ type, label, x, y, w, h }) => ({ type, label, x, y, w, h }))
      });
      onNotify?.({ type: 'success', message: `Đã lưu mặt bằng ${floor.name}.` });
      await onChanged?.();
      resetDraft(null);
      onEditingChange(false);
    } catch (err) {
      onNotify?.({ type: 'error', message: err.response?.data?.message || 'Không lưu được mặt bằng.' });
    } finally {
      setSaving(false);
    }
  };

  // ---------- Tầng: tạo / sửa / xoá ----------
  const openFloorModal = (mode) => {
    setFloorModal(mode === 'create'
      ? { mode, name: `Tầng ${floors.length + 1}`, widthM: 28, heightM: 20, submitting: false }
      : { mode, name: floor.name, widthM: cellsToMeters(floor.gridWidth), heightM: cellsToMeters(floor.gridHeight), submitting: false });
  };

  const submitFloorModal = async (event) => {
    event.preventDefault();
    const payload = {
      name: floorModal.name.trim(),
      gridWidth: metersToCells(floorModal.widthM),
      gridHeight: metersToCells(floorModal.heightM)
    };
    setFloorModal(prev => ({ ...prev, submitting: true }));
    try {
      const saved = floorModal.mode === 'create'
        ? await createFloor(facilityId, payload)
        : await updateFloor(floor.id, payload);
      onNotify?.({ type: 'success', message: floorModal.mode === 'create' ? `Đã tạo mặt bằng ${saved.name}.` : `Đã cập nhật ${saved.name}.` });
      setFloorModal(null);
      await onChanged?.();
      setActiveFloorId(saved.id);
      if (editing) resetDraft(saved);
    } catch (err) {
      onNotify?.({ type: 'error', message: err.response?.data?.message || 'Không lưu được thông tin tầng.' });
      setFloorModal(prev => ({ ...prev, submitting: false }));
    }
  };

  const handleDeleteFloor = async () => {
    if (!floor || !window.confirm(`Xoá mặt bằng ${floor.name}? Lối đi, cửa, thang của tầng này sẽ bị xoá.`)) return;
    try {
      await deleteFloor(floor.id);
      onNotify?.({ type: 'success', message: `Đã xoá mặt bằng ${floor.name}.` });
      setActiveFloorId(null);
      await onChanged?.();
      resetDraft(null);
    } catch (err) {
      onNotify?.({ type: 'error', message: err.response?.data?.message || 'Không xoá được mặt bằng.' });
    }
  };

  // ---------- Dữ liệu cho canvas ----------
  const canvasUnits = floorUnits.map(u => ({
    id: u.id,
    label: unitLabel(u),
    x: u.mapX,
    y: u.mapY,
    w: u.mapW,
    h: u.mapH,
    door: u.mapDoor,
    state: getDisplayState(u),
    title: unitTitle(u),
    dimmed: !editing && matchedIds != null && !matchedIds.has(u.id)
  }));

  const stateCounts = floorUnits.reduce((acc, u) => {
    const s = getDisplayState(u);
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const unitsOnActiveFloor = floor ? units.filter(u => sameFloor(u.floor, floor.name)).length : 0;

  return (
    <div className="flex flex-col">
      {/* Thanh tầng + công cụ */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <div className="flex items-center flex-wrap gap-2">
          {floors.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => switchFloor(f)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase border-2 transition-colors cursor-pointer ${
                floor?.id === f.id
                  ? 'bg-[#DDF4FF] text-[#1899D6] border-[#84D8FF]'
                  : 'bg-white text-[#AFAFAF] border-[#E5E5E5] hover:text-[#777777]'
              }`}
            >
              <span className="material-symbols-outlined text-[14px] align-[-3px] mr-1">layers</span>
              {f.name}
            </button>
          ))}
          {editing && (
            <button
              type="button"
              onClick={() => openFloorModal('create')}
              disabled={dirty}
              title={dirty ? 'Lưu hoặc huỷ thay đổi trước khi thêm tầng' : 'Thêm mặt bằng tầng mới'}
              className="px-3 py-1.5 rounded-xl text-[11px] font-black uppercase border-2 border-dashed border-[#AFAFAF] text-[#777777] hover:bg-[#F7F7F7] disabled:opacity-40 cursor-pointer"
            >
              + Tầng
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {floor && (
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F7F7F7] border-2 border-[#E5E5E5]">
              <button type="button" onClick={() => setZoomIndex(i => Math.max(0, i - 1))} disabled={zoomIndex === 0}
                className="p-0.5 text-[#777777] disabled:opacity-30 cursor-pointer" title="Thu nhỏ">
                <span className="material-symbols-outlined text-[18px]">zoom_out</span>
              </button>
              <span className="text-[10px] font-black text-[#AFAFAF] w-9 text-center">{Math.round(ZOOM_STEPS[zoomIndex] * 100)}%</span>
              <button type="button" onClick={() => setZoomIndex(i => Math.min(ZOOM_STEPS.length - 1, i + 1))}
                disabled={zoomIndex === ZOOM_STEPS.length - 1}
                className="p-0.5 text-[#777777] disabled:opacity-30 cursor-pointer" title="Phóng to">
                <span className="material-symbols-outlined text-[18px]">zoom_in</span>
              </button>
            </div>
          )}
          {!editing && (
            <button type="button" onClick={floors.length ? startEditing : () => openFloorModal('create')}
              className="duo-btn-white px-3 py-1.5 text-[11px]">
              <span className="material-symbols-outlined text-[16px] mr-1">{floors.length ? 'edit_square' : 'add'}</span>
              {floors.length ? 'Chỉnh sửa mặt bằng' : 'Tạo mặt bằng'}
            </button>
          )}
        </div>
      </div>

      {!floor ? (
        <div className="flex flex-col items-center justify-center p-16 text-center gap-3">
          <span className="material-symbols-outlined text-[48px] text-[#E5E5E5]">map</span>
          <p className="text-sm font-black text-[#777777]">Cơ sở chưa có mặt bằng tầng nào</p>
          <p className="text-xs font-bold text-[#AFAFAF]">Tạo mặt bằng rồi kéo thả ô kho, lối đi, cửa vào đúng vị trí thực tế</p>
          <button type="button" onClick={() => openFloorModal('create')} className="duo-btn-green px-4 py-2 text-xs">
            + Tạo mặt bằng tầng đầu tiên
          </button>
        </div>
      ) : (
        <div className="flex flex-col xl:flex-row">
          <div className="flex-1 min-w-0 flex flex-col gap-3 p-5">
            {/* Chú thích */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {DISPLAY_STATE_ORDER.map(state => (
                <div key={state} className="flex items-center gap-1.5 text-[11px] font-black text-[#777777]">
                  <span className={`w-3 h-3 rounded-md ${DISPLAY_STATES[state].dot}`} />
                  <span>{DISPLAY_STATES[state].label}</span>
                  <span className="text-[#AFAFAF]">({stateCounts[state] || 0})</span>
                </div>
              ))}
              <span className="text-[10px] font-bold text-[#AFAFAF]">
                {floor.name}: {cellsToMeters(floor.gridWidth)}m × {cellsToMeters(floor.gridHeight)}m · lưới 1m · vạch nhỏ trên ô = phía cửa
              </span>
            </div>

            {placingUnit && (
              <div className="rounded-xl bg-[#DDF4FF] border-2 border-[#84D8FF] px-3 py-2 text-xs font-bold text-[#1899D6] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">ads_click</span>
                Bấm vào chỗ trống trên mặt bằng để đặt {placingUnit.id} ({cellsToMeters(placingSize.w)}m × {cellsToMeters(placingSize.h)}m). Esc để huỷ.
              </div>
            )}

            <div ref={canvasBoxRef} className="overflow-auto pb-2">
              <FloorPlanCanvas
                gridWidth={floor.gridWidth}
                gridHeight={floor.gridHeight}
                cellSize={cellSize}
                units={canvasUnits}
                fixtures={fixtures}
                editable={editing && !placingUnit}
                pickMode={editing && !!placingUnit}
                selectedKey={editing ? editSelectedKey : (selectedUnitId ? `u:${selectedUnitId}` : null)}
                conflictKeys={conflicts.keys}
                onSelect={key => {
                  if (editing) setEditSelectedKey(key);
                  else onSelectUnit?.(key?.startsWith('u:') ? key.slice(2) : null);
                }}
                onItemChange={updateItem}
                onCellClick={editing && placingUnit ? placeUnitAt : undefined}
                onCellHover={editing && placingUnit ? (x, y) => setHoverCell(x == null ? null : { x, y }) : undefined}
                ghost={ghost}
              />
            </div>

            {/* Ô chưa có vị trí (chế độ xem) */}
            {!editing && unplacedUnits.length > 0 && (
              <div className="rounded-2xl border-2 border-dashed border-[#E5E5E5] p-3 flex flex-col gap-2">
                <span className="text-[11px] font-black uppercase text-[#AFAFAF]">
                  Chưa đặt trên mặt bằng ({unplacedUnits.length}) · bấm "Chỉnh sửa mặt bằng" để đặt
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {unplacedUnits.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => onSelectUnit?.(u.id)}
                      title={unitTitle(u)}
                      className={`duo-badge cursor-pointer ${DISPLAY_STATES[getDisplayState(u)].badge} ${
                        selectedUnitId === u.id ? 'ring-2 ring-[#1CB0F6]' : ''
                      }`}
                    >
                      {u.id}{u.floor ? ` · ${u.floor}` : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bảng công cụ khi chỉnh sửa */}
          {editing && (
            <aside className="xl:w-[300px] shrink-0 border-t-2 xl:border-t-0 xl:border-l-2 border-[#E5E5E5] p-4 flex flex-col gap-4 text-xs">
              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-black uppercase text-[#AFAFAF]">Tầng {floor.name}</h4>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => openFloorModal('edit')} disabled={dirty}
                      title={dirty ? 'Lưu hoặc huỷ thay đổi trước' : 'Đổi tên / kích thước tầng'}
                      className="p-1 rounded-lg text-[#777777] hover:bg-[#F7F7F7] disabled:opacity-30 cursor-pointer">
                      <span className="material-symbols-outlined text-[18px]">tune</span>
                    </button>
                    <button type="button" onClick={handleDeleteFloor} disabled={dirty || unitsOnActiveFloor > 0}
                      title={unitsOnActiveFloor > 0 ? `Còn ${unitsOnActiveFloor} ô kho thuộc tầng này` : 'Xoá mặt bằng tầng'}
                      className="p-1 rounded-lg text-[#AFAFAF] hover:text-[#FF4B4B] hover:bg-[#FFDFDF] disabled:opacity-30 cursor-pointer">
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(FIXTURE_TYPES).map(([type, cfg]) => (
                    <button key={type} type="button" onClick={() => addFixture(type)}
                      className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black cursor-pointer ${cfg.className}`}>
                      <span className="material-symbols-outlined text-[16px]">{cfg.icon}</span>
                      + {cfg.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Thuộc tính mục đang chọn */}
              {(selectedUnit || selectedFixture) && (
                <section className="flex flex-col gap-2 rounded-2xl border-2 border-[#84D8FF] bg-[#F5FBFF] p-3">
                  {selectedUnit ? (
                    <>
                      <span className="font-black font-mono text-[#1CB0F6]">{selectedUnit.id}</span>
                      <span className="font-bold text-[#777777]">
                        {selectedUnit.unitTypeName} · {cellsToMeters(selectedUnit.mapW)}m × {cellsToMeters(selectedUnit.mapH)}m
                      </span>
                      <label className="flex items-center gap-2 font-black text-[#4B4B4B]">
                        Phía cửa
                        <select
                          value={unitRect(selectedUnit.id).door}
                          onChange={e => updateItem(editSelectedKey, { door: e.target.value })}
                          className="duo-input py-1 text-xs flex-1"
                        >
                          {DOOR_SIDES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                        </select>
                      </label>
                    </>
                  ) : (
                    <>
                      <span className="font-black text-[#4B4B4B]">{FIXTURE_TYPES[selectedFixture.type].label}</span>
                      <input
                        value={selectedFixture.label}
                        maxLength={50}
                        onChange={e => updateItem(editSelectedKey, { label: e.target.value })}
                        placeholder="Tên hiển thị"
                        className="duo-input py-1.5 text-xs"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        {[['w', 'Rộng (m)'], ['h', 'Dài (m)']].map(([field, text]) => (
                          <label key={field} className="flex flex-col gap-1 font-black text-[10px] uppercase text-[#AFAFAF]">
                            {text}
                            <input
                              type="number"
                              min={0.5}
                              step={0.5}
                              value={cellsToMeters(selectedFixture[field])}
                              onChange={e => updateItem(editSelectedKey, { [field]: metersToCells(e.target.value || 0.5) })}
                              className="duo-input py-1 text-xs"
                            />
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={rotateSelected} className="duo-btn-white px-2.5 py-1 text-[11px]">
                      <span className="material-symbols-outlined text-[16px] mr-0.5">rotate_right</span>Xoay
                    </button>
                    <button type="button" onClick={removeSelected}
                      className="duo-btn-white px-2.5 py-1 text-[11px] text-[#FF4B4B] border-[#FFB2B2]">
                      <span className="material-symbols-outlined text-[16px] mr-0.5">
                        {selectedUnit ? 'move_item' : 'delete'}
                      </span>
                      {selectedUnit ? 'Gỡ khỏi mặt bằng' : 'Xoá'}
                    </button>
                  </div>
                </section>
              )}

              {/* Ô chờ đặt */}
              <section className="flex flex-col gap-2">
                <h4 className="text-[11px] font-black uppercase text-[#AFAFAF]">
                  Ô chưa đặt vị trí ({unplacedUnits.length})
                </h4>
                {unplacedUnits.length === 0 ? (
                  <p className="text-[11px] font-bold text-[#AFAFAF]">Mọi ô kho đã có vị trí.</p>
                ) : (
                  <div className="flex flex-col gap-1 max-h-[180px] overflow-y-auto pr-1">
                    {unplacedUnits.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setPlacingUnitId(prev => (prev === u.id ? null : u.id))}
                        className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border-2 text-left cursor-pointer ${
                          placingUnitId === u.id ? 'border-[#1CB0F6] bg-[#DDF4FF]' : 'border-[#E5E5E5] hover:bg-[#F7F7F7]'
                        }`}
                      >
                        <span className="font-black font-mono text-[11px] text-[#4B4B4B]">{u.id}</span>
                        <span className="text-[10px] font-bold text-[#AFAFAF] truncate">
                          {u.unitTypeName}{u.floor && !sameFloor(u.floor, floor.name) ? ` · ${u.floor}` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {conflicts.messages.length > 0 && (
                <section className="rounded-2xl border-2 border-[#FF4B4B] bg-[#FFDFDF] p-3 flex flex-col gap-1">
                  <span className="text-[11px] font-black uppercase text-[#FF4B4B]">Chưa lưu được</span>
                  {conflicts.messages.slice(0, 6).map(m => (
                    <span key={m} className="text-[11px] font-bold text-[#EA2B2B]">• {m}</span>
                  ))}
                  {conflicts.messages.length > 6 && (
                    <span className="text-[11px] font-bold text-[#EA2B2B]">… và {conflicts.messages.length - 6} lỗi khác</span>
                  )}
                </section>
              )}

              <p className="text-[10px] font-bold text-[#AFAFAF] leading-relaxed">
                Kéo để dời · mũi tên dời 0.5m (Shift: 1m) · R xoay · Delete gỡ / xoá · Esc bỏ chọn
              </p>

              <div className="flex gap-2 pt-3 border-t-2 border-[#E5E5E5] mt-auto">
                <button type="button" onClick={cancelEditing} disabled={saving} className="duo-btn-gray flex-1 py-2 text-xs">
                  Huỷ
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !dirty || conflicts.messages.length > 0}
                  className="duo-btn-green flex-1 py-2 text-xs disabled:opacity-50"
                >
                  {saving ? 'Đang lưu...' : 'Lưu mặt bằng'}
                </button>
              </div>
            </aside>
          )}
        </div>
      )}

      {/* Modal tầng */}
      {floorModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={submitFloorModal}
            className="duo-card w-full max-w-sm p-6 flex flex-col gap-4 border-4 border-[#E5E5E5] shadow-2xl">
            <h3 className="text-lg font-black text-[#4B4B4B] uppercase">
              {floorModal.mode === 'create' ? 'Tạo mặt bằng tầng' : `Sửa ${floor?.name}`}
            </h3>
            <label className="flex flex-col gap-1.5 text-xs font-black uppercase text-[#4B4B4B]">
              Tên tầng
              <input required maxLength={20} value={floorModal.name}
                onChange={e => setFloorModal(prev => ({ ...prev, name: e.target.value }))}
                className="duo-input py-2.5 text-xs normal-case" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[['widthM', 'Chiều ngang (m)'], ['heightM', 'Chiều dọc (m)']].map(([field, text]) => (
                <label key={field} className="flex flex-col gap-1.5 text-xs font-black uppercase text-[#4B4B4B]">
                  {text}
                  <input required type="number" min={5} max={100} step={0.5} value={floorModal[field]}
                    onChange={e => setFloorModal(prev => ({ ...prev, [field]: e.target.value }))}
                    className="duo-input py-2.5 text-xs" />
                </label>
              ))}
            </div>
            {floorModal.mode === 'edit' && (
              <p className="text-[11px] font-bold text-[#AFAFAF]">
                Đổi tên tầng sẽ đổi luôn tầng của các ô kho đang thuộc tầng này.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t-2 border-[#E5E5E5]">
              <button type="button" onClick={() => setFloorModal(null)} disabled={floorModal.submitting}
                className="duo-btn-gray px-4 py-2 text-xs">Huỷ</button>
              <button type="submit" disabled={floorModal.submitting} className="duo-btn-green px-4 py-2 text-xs">
                {floorModal.submitting ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
