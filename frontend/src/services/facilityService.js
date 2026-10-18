import api from './api';

// UC-09: Lấy tất cả cơ sở ACTIVE
export const getAllFacilities = () => {
    return api.get('/facilities').then(res => res.data);
};

// UC-09: Tìm kiếm cơ sở theo bộ lọc
export const searchFacilities = (params = {}) => {
    return api.get('/facilities/search', { params }).then(res => res.data);
};

// UC-09: Chi tiết availability của 1 cơ sở
export const getFacilityAvailability = (facilityId) => {
    return api.get(`/facilities/${facilityId}/availability`).then(res => res.data);
};

// UC-09: Lấy danh sách thành phố (cho dropdown)
export const getCities = () => {
    return api.get('/facilities/cities').then(res => res.data);
};

// UC-09: Lấy tất cả loại kho (cho dropdown filter)
export const getAllUnitTypes = () => {
    return api.get('/unit-types').then(res => res.data);
};

// UC-04 (BOM): Quản lý danh sách cơ sở
export const getBomFacilities = (params = {}) => {
    return api.get('/facilities/bom', { params }).then(res => res.data);
};

export const getBomFacilityDetail = (id) => {
    return api.get(`/facilities/bom/${id}`).then(res => res.data);
};

export const createFacility = (data) => {
    return api.post('/facilities/bom', data).then(res => res.data);
};

export const updateFacility = (id, data) => {
    return api.put(`/facilities/bom/${id}`, data).then(res => res.data);
};

export const updateFacilityStatus = (id, status) => {
    return api.patch(`/facilities/bom/${id}/status`, { status }).then(res => res.data);
};
