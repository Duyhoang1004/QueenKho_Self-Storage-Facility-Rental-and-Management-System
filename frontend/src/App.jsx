import { Routes, Route } from 'react-router-dom';
import CustomerLayout from './layouts/CustomerLayout';
import HomePage from './pages/home/HomePage';
import LoginPage from './pages/login/LoginPage';
import RegisterPage from './pages/register/RegisterPage';

// Import cho chức năng Tìm kiếm & Khám phá kho (UC-09)
import SearchLandingPage from './pages/search/SearchLandingPage';
import SearchResultsPage from './pages/search/SearchResultsPage';

// Import cho chức năng Đặt chỗ (UC-10)
import CreateReservationPage from './pages/reservation/CreateReservationPage';
import ReservationConfirmationPage from './pages/reservation/ReservationConfirmationPage';

// Import cho chức năng Lịch sử & Quản lý Đặt chỗ (UC-12, UC-13)
import MyReservationsPage from './pages/my_reservation/MyReservationsPage';
import PendingReservationsPage from './pages/my_reservation/PendingReservationsPage';
import CustomerContractPage from './pages/my_reservation/CustomerContractPage';

// Import cho chức năng Gửi yêu cầu hỗ trợ (UC-26)
import CustomerSupportPage from './pages/support/CustomerSupportPage';

// Import Manager Pages
import ManagerLayout from './layouts/ManagerLayout';
import ManagerDashboardPage from './pages/manager/ManagerDashboardPage';
import StorageManagementPage from './pages/manager/StorageManagementPage';
import CustomerContractsPage from './pages/manager/CustomerContractsPage';
import ContractDetailPage from './pages/manager/ContractDetailPage';
import ManagerTaskBoardPage from './pages/manager/ManagerTaskBoardPage';
import OverdueContractsPage from './pages/manager/OverdueContractsPage';
import ManagerStaffPage from './pages/manager/ManagerStaffPage';

// Import Staff Pages (UC-16, UC-17, UC-18, UC-27)
import StaffLayout from './layouts/StaffLayout';
import StaffTaskBoardPage from './pages/staff/StaffTaskBoardPage';
import StaffTaskDetailPage from './pages/staff/StaffTaskDetailPage';

// Import Admin Pages (UC-03, UC-08, UC-31)
import AdminLayout from './layouts/AdminLayout';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminRolesPage from './pages/admin/AdminRolesPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminLogsPage from './pages/admin/AdminLogsPage';

// Import BOM Pages (UC-04, UC-05, UC-07, UC-29)
import BomLayout from './layouts/BomLayout';
import BomFacilitiesPage from './pages/bom/BomFacilitiesPage';
import BomUnitTypesPage from './pages/bom/BomUnitTypesPage';
import BomComingSoonPage from './pages/bom/BomComingSoonPage';
import BomRevenuePage from './pages/bom/BomRevenuePage';


export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      
      {/* ========== Customer Portal ========== */}
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<HomePage />} />
        
        {/* UC-09: Tìm kiếm & Khám phá kho (Landing Page) */}
        <Route path="/tim-va-dat-kho" element={<SearchLandingPage />} />
        <Route path="/tim-va-dat-kho/ket-qua" element={<SearchResultsPage />} />

        {/* UC-10: Đặt chỗ kho */}
        <Route path="/booking" element={<CreateReservationPage />} />
        <Route path="/booking/confirmation" element={<ReservationConfirmationPage />} />

        {/* UC-12: Quản lý kho của tôi */}
        <Route path="/kho-cua-toi" element={<MyReservationsPage />} />
        <Route path="/kho-cua-toi/hop-dong/:reservationId" element={<CustomerContractPage />} />

        {/* UC-26: Gửi yêu cầu hỗ trợ */}
        <Route path="/ho-tro" element={<CustomerSupportPage />} />
      </Route>

      {/* ========== Manager Portal ========== */}
      <Route element={<ManagerLayout />}>
        <Route path="/manager" element={<ManagerDashboardPage />} />
        <Route path="/manager/storage" element={<StorageManagementPage />} />
        <Route path="/manager/pending" element={<PendingReservationsPage />} />
        <Route path="/manager/overdue" element={<OverdueContractsPage />} />
        <Route path="/manager/customers" element={<CustomerContractsPage />} />
        <Route path="/manager/contracts/:id" element={<ContractDetailPage />} />
        <Route path="/manager/tasks" element={<ManagerTaskBoardPage key="tasks" initialTypeFilter="ALL" />} />
        <Route path="/manager/tasks/:id" element={<StaffTaskDetailPage />} />
        <Route path="/manager/refunds" element={<ManagerTaskBoardPage key="refunds" initialTypeFilter="REFUND" />} />
        <Route path="/manager/refunds/:id" element={<StaffTaskDetailPage />} />
        <Route path="/manager/staff" element={<ManagerStaffPage />} />
      </Route>

      {/* ========== Staff Portal (UC-16, UC-17, UC-18, UC-27) ========== */}
      <Route element={<StaffLayout />}>
        <Route path="/staff" element={<StaffTaskBoardPage />} />
        <Route path="/staff/tasks/:id" element={<StaffTaskDetailPage />} />
      </Route>

      {/* ========== Admin Portal (UC-03, UC-08, UC-31) ========== */}
      <Route element={<AdminLayout />}>
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/roles" element={<AdminRolesPage />} />
        <Route path="/admin/logs" element={<AdminLogsPage />} />
      </Route>

      {/* ========== BOM Portal (UC-04, UC-05, UC-07, UC-29) ========== */}
      <Route element={<BomLayout />}>
        <Route path="/bom" element={<BomFacilitiesPage />} />
        <Route path="/bom/facilities" element={<BomFacilitiesPage />} />
        <Route path="/bom/unit-types" element={<BomUnitTypesPage />} />
        <Route path="/bom/policies" element={<BomComingSoonPage title="Chính sách thuê" uc="UC-07" icon="policy" />} />
        <Route path="/bom/revenue" element={<BomRevenuePage />} />
      </Route>
    </Routes>
  );
}
