import api from './api';

// UC-32: Quản lý nhân viên chi nhánh cơ sở (Facility Staff Management)

// 1. Lấy danh sách nhân viên cơ sở kèm thống kê task
export const getFacilityStaff = (facilityId) => {
  return api.get('/manager/staff', { params: { facilityId } }).then(res => res.data);
};

// 2. Tạo tài khoản nhân viên mới tại cơ sở
export const createFacilityStaff = (payload, actorUserId, facilityId) => {
  return api.post('/manager/staff', payload, {
    params: { actorUserId, facilityId }
  }).then(res => res.data);
};

// 3. Khóa / Mở khóa tài khoản nhân viên (PR-06)
export const updateFacilityStaffStatus = (staffId, status, reason, actorUserId, facilityId) => {
  return api.patch(`/manager/staff/${staffId}/status`, { status, reason }, {
    params: { actorUserId, facilityId }
  }).then(res => res.data);
};

// 4. Đặt lại mật khẩu nhân viên
export const resetFacilityStaffPassword = (staffId, newPassword, actorUserId, facilityId) => {
  return api.put(`/manager/staff/${staffId}/password`, { newPassword }, {
    params: { actorUserId, facilityId }
  }).then(res => res.data);
};

