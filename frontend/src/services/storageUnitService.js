import api from './api';

/**
 * UC-06: Lấy danh sách ô kho và số liệu KPI theo cơ sở
 * @param {Object} params { facilityId, status, floor, unitTypeId, keyword }
 */
export const getStorageUnits = async (params = {}) => {
  const response = await api.get('/storage-units', { params });
  return response.data;
};

/**
 * Chi tiết 1 ô kho
 */
export const getStorageUnitDetail = async (id) => {
  const response = await api.get(`/storage-units/${id}`);
  return response.data;
};

/**
 * UC-06: Tạo ô kho mới
 * @param {Object} data { unitTypeId, floor, zone, roomNumber }
 * @param {Number} facilityId
 * @param {Number} actorUserId
 */
export const createStorageUnit = async (data, facilityId, actorUserId) => {
  const response = await api.post('/storage-units', data, {
    params: { facilityId, actorUserId }
  });
  return response.data;
};

/**
 * UC-06: Cập nhật thông tin cấu hình vật lý ô kho
 * @param {String} id
 * @param {Object} data { unitTypeId, floor, zone, roomNumber }
 * @param {Number} actorUserId
 */
export const updateStorageUnit = async (id, data, actorUserId) => {
  const response = await api.put(`/storage-units/${id}`, data, {
    params: { actorUserId }
  });
  return response.data;
};

/**
 * UC-06: Đổi trạng thái ô kho (AVAILABLE ⇄ MAINTENANCE)
 * @param {String} id
 * @param {String} status 'AVAILABLE' | 'MAINTENANCE'
 * @param {String} note
 * @param {Number} actorUserId
 */
export const updateStorageUnitStatus = async (id, status, note = '', actorUserId) => {
  const response = await api.patch(`/storage-units/${id}/status`, { status, note }, {
    params: { actorUserId }
  });
  return response.data;
};

/**
 * UC-06: Xóa ô kho
 * @param {String} id
 * @param {Number} actorUserId
 */
export const deleteStorageUnit = async (id, actorUserId) => {
  const response = await api.delete(`/storage-units/${id}`, {
    params: { actorUserId }
  });
  return response.data;
};

/**
 * UC-06 mặt bằng: tất cả tầng + vật cố định của cơ sở (vị trí ô kho nằm trong getStorageUnits)
 * @returns {Promise<{ facilityId, cellMeters, floors: [{ id, name, gridWidth, gridHeight, sortOrder, fixtures }] }>}
 */
export const getFacilityLayout = async (facilityId) => {
  const response = await api.get('/storage-units/layout', { params: { facilityId } });
  return response.data;
};

/**
 * UC-06: Tạo mặt bằng tầng mới
 * @param {Object} data { name, gridWidth, gridHeight } — kích thước theo ô lưới 0.5m
 */
export const createFloor = async (facilityId, data) => {
  const response = await api.post('/storage-units/layout/floors', data, { params: { facilityId } });
  return response.data;
};

/**
 * UC-06: Đổi tên / kích thước tầng
 * @param {Object} data { name, gridWidth, gridHeight }
 */
export const updateFloor = async (floorId, data) => {
  const response = await api.put(`/storage-units/layout/floors/${floorId}`, data);
  return response.data;
};

/**
 * UC-06: Xoá tầng (chỉ khi tầng không còn ô kho)
 */
export const deleteFloor = async (floorId) => {
  const response = await api.delete(`/storage-units/layout/floors/${floorId}`);
  return response.data;
};

/**
 * UC-06: Lưu mặt bằng 1 tầng
 * @param {Object} data { units: [{ unitId, x, y, w, h, door }], fixtures: [{ type, label, x, y, w, h }] }
 *   units: ô cần đặt / dời (x = null → gỡ khỏi mặt bằng); fixtures: danh sách mới, thay toàn bộ
 */
export const saveFloorPlan = async (floorId, data) => {
  const response = await api.put(`/storage-units/layout/floors/${floorId}/plan`, data);
  return response.data;
};

