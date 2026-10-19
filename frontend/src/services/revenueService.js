import api from './api';

// UC-29 (BOM): Lấy tổng quan chỉ số tài chính & doanh thu theo PR-M7
export const getRevenueOverview = (params = {}) => {
  return api.get('/bom/revenue/overview', { params }).then(res => res.data);
};

// UC-29 (BOM): Lấy biểu đồ doanh thu theo chu kỳ thời gian (tháng / quý)
export const getRevenueTimeline = (params = {}) => {
  return api.get('/bom/revenue/timeline', { params }).then(res => res.data);
};

// UC-29 (BOM): Lấy cơ cấu doanh thu phân bổ theo cơ sở
export const getRevenueByFacility = (params = {}) => {
  return api.get('/bom/revenue/by-facility', { params }).then(res => res.data);
};

// UC-29 (BOM): Lấy cơ cấu doanh thu theo loại khoang lưu trữ
export const getRevenueByUnitType = (params = {}) => {
  return api.get('/bom/revenue/by-unit-type', { params }).then(res => res.data);
};

// UC-29 (BOM): Bảng đối soát giao dịch chi tiết (Reconciliation audit table - PR-M7, PR-O15)
export const getRevenueTransactions = (params = {}) => {
  return api.get('/bom/revenue/transactions', { params }).then(res => res.data);
};

// UC-29 (BOM): Báo cáo tỷ lệ lấp đầy & số lượng hợp đồng (PR-M7)
export const getOccupancyReport = (params = {}) => {
  return api.get('/bom/revenue/occupancy', { params }).then(res => res.data);
};
