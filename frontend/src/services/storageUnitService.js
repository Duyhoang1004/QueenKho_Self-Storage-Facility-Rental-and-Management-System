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

