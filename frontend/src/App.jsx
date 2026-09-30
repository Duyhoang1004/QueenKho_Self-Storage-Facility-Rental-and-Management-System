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

// Import Manager Pages
import ManagerLayout from './layouts/ManagerLayout';
import ManagerDashboardPage from './pages/manager/ManagerDashboardPage';
import StorageManagementPage from './pages/manager/StorageManagementPage';
import CustomerContractsPage from './pages/manager/CustomerContractsPage';
import ContractDetailPage from './pages/manager/ContractDetailPage';


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
      </Route>

      {/* ========== UC-13: FM Pending Reservations (tạm standalone) ========== */}
      

      {/* ========== Manager Portal ========== */}
      <Route element={<ManagerLayout />}>
        <Route path="/manager" element={<ManagerDashboardPage />} />
        <Route path="/manager/storage" element={<StorageManagementPage />} />
        <Route path="/manager/pending" element={<PendingReservationsPage />} />
        <Route path="/manager/customers" element={<CustomerContractsPage />} />
        <Route path="/manager/contracts/:id" element={<ContractDetailPage />} />
      </Route>
    </Routes>
  );
}
