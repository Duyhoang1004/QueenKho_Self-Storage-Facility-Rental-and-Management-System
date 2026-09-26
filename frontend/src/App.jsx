import { Routes, Route } from 'react-router-dom';
import CustomerLayout from './layouts/CustomerLayout';
import HomePage from './pages/home/HomePage';
import LoginPage from './pages/login/LoginPage';
import RegisterPage from './pages/register/RegisterPage';
import CreateReservationPage from './pages/reservation/CreateReservationPage';
import ReservationConfirmationPage from './pages/reservation/ReservationConfirmationPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {/* ========== Customer Portal ========== */}
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/booking" element={<CreateReservationPage />} />
        <Route path="/tim-va-dat-kho" element={<CreateReservationPage />} />
        <Route path="/booking/confirmation" element={<ReservationConfirmationPage />} />
        {/* 
          Các thành viên thêm route module của mình ở đây:
          
          <Route path="/tim-va-dat-kho" element={<SearchPage />} />
          <Route path="/kho-cua-toi" element={<MyStoragePage />} />
          <Route path="/thanh-toan" element={<PaymentPage />} />
          <Route path="/ho-tro" element={<SupportPage />} />
        */}
      </Route>

      {/* 
        ========== Các layout khác sẽ thêm sau ==========
        
        <Route element={<StaffLayout />}>
          ...
        </Route>

        <Route element={<ManagerLayout />}>
          ...
        </Route>
      */}
    </Routes>
  );
}
