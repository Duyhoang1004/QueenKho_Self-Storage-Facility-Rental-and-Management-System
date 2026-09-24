import { Routes, Route } from 'react-router-dom';
import CustomerLayout from './layouts/CustomerLayout';
import HomePage from './pages/home/HomePage';
<<<<<<< HEAD
=======
import LoginPage from './pages/login/LoginPage';
>>>>>>> cbd37b4b42b2b2f66d51022cd1d31d8ff4ecc369

export default function App() {
  return (
    <Routes>
<<<<<<< HEAD
      {/* ========== Customer Portal ========== */}
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<HomePage />} />

=======
      <Route path="/login" element={<LoginPage />} />
      {/* ========== Customer Portal ========== */}
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<HomePage />} />
>>>>>>> cbd37b4b42b2b2f66d51022cd1d31d8ff4ecc369
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