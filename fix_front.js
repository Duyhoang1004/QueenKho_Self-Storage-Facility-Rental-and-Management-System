const fs = require('fs');

let appContent = fs.readFileSync('frontend/src/App.jsx', 'utf8');
appContent = appContent.replace("import AssignmentPage from './pages/manager/AssignmentPage';", "");
appContent = appContent.replace('<Route path="/manager/assign" element={<AssignmentPage />} />', '<Route path="/manager/pending" element={<PendingReservationsPage />} />');
appContent = appContent.replace('<Route path="/fm/pending-reservations" element={<PendingReservationsPage />} />', "");
fs.writeFileSync('frontend/src/App.jsx', appContent, 'utf8');

let layoutContent = fs.readFileSync('frontend/src/layouts/ManagerLayout.jsx', 'utf8');
layoutContent = layoutContent.replace("['FACILITY_MANAGER', 'MANAGER', 'ADMIN']", "['FACILITY_MANAGER']");
layoutContent = layoutContent.replace(/{ path: '\/manager\/assign', icon: 'assignment_turned_in', label: 'Duyệt & Gán ô kho', badge: '3 đơn mới' },\r?\n/, "");
layoutContent = layoutContent.replace(/Cơ sở Tân Bình/g, 'Cơ sở quản lý');
fs.writeFileSync('frontend/src/layouts/ManagerLayout.jsx', layoutContent, 'utf8');
