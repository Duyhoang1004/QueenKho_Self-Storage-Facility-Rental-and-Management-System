import api from './api';

// UC-09: Lấy danh sách loại kho đang hoạt động (ACTIVE) cho khách hàng xem và đặt chỗ
export const getAllUnitTypes = () => {
    return api.get('/unit-types').then(res => res.data);
};

// UC-05 (BOM): Lấy danh sách tất cả loại kho kèm thống kê ô kho & bộ lọc
export const getBomUnitTypes = (params = {}) => {
    return api.get('/unit-types/bom', { params }).then(res => res.data);
};

// UC-05 (BOM): Lấy chi tiết 1 loại kho
export const getBomUnitTypeDetail = (id) => {
    return api.get(`/unit-types/bom/${id}`).then(res => res.data);
};

// UC-05 (BOM): Tạo mới loại kho (PR-M3)
export const createUnitType = (data, actorUserId) => {
    return api.post('/unit-types/bom', data, { params: { actorUserId } }).then(res => res.data);
};

// UC-05 (BOM): Cập nhật thông tin loại kho & giá niêm yết (PR-M3, PR-12)
export const updateUnitType = (id, data, actorUserId) => {
    return api.put(`/unit-types/bom/${id}`, data, { params: { actorUserId } }).then(res => res.data);
};

// UC-05 (BOM): Đổi trạng thái ACTIVE / INACTIVE (PR-M4)
export const updateUnitTypeStatus = (id, status, actorUserId) => {
    return api.patch(`/unit-types/bom/${id}/status`, { status }, { params: { actorUserId } }).then(res => res.data);
};

// UC-05 (BOM): Xóa loại kho (PR-M4: chỉ khi chưa từng có ô kho)
export const deleteUnitType = (id, actorUserId) => {
    return api.delete(`/unit-types/bom/${id}`, { params: { actorUserId } }).then(res => res.data);
};
