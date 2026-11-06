package com.queenkho.api.service;

import com.queenkho.api.dto.TransferUnitRequest;
import com.queenkho.api.entity.Facility;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.Reservation;
import com.queenkho.api.entity.Role;
import com.queenkho.api.entity.StorageUnit;
import com.queenkho.api.entity.UnitType;
import com.queenkho.api.entity.User;
import com.queenkho.api.exception.ContractException;
import com.queenkho.api.repository.RentalContractRepository;
import com.queenkho.api.repository.ReservationRepository;
import com.queenkho.api.repository.StorageUnitRepository;
import com.queenkho.api.repository.UnitTransferRepository;
import com.queenkho.api.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

// Góp ý giảng viên 04/11/2026: BR-121 ảnh biên bản, BR-122 chuyển ô, BR-123 ưu tiên khách cũ / gói dài,
// PR-Q16 phí dọn & di dời hàng (BR-124 check-in online đã bỏ 06/11/2026 — D-16)
class LecturerFeedbackRulesTest {

    // ---------- helpers ----------

    private static User user(int id, String role, Integer facilityId) {
        Role r = new Role();
        r.setName(role);
        User u = new User();
        u.setId(id);
        u.setRole(r);
        u.setFacilityId(facilityId);
        u.setFullName(role + " " + id);
        return u;
    }

    private static StorageUnit unit(String id, int facilityId, int typeId, String status) {
        Facility f = new Facility();
        f.setId(facilityId);
        UnitType t = new UnitType();
        t.setId(typeId);
        t.setName("Loại " + typeId);
        t.setBasePriceMonthly(new BigDecimal("1850000"));
        StorageUnit su = new StorageUnit();
        su.setId(id);
        su.setFacility(f);
        su.setUnitType(t);
        su.setStatus(status);
        return su;
    }

    private static RentalContract contract(String status, StorageUnit su, User customer, String terms) {
        Reservation r = new Reservation();
        r.setId(100);
        r.setTermsVersion(terms);
        r.setStartDate(LocalDate.now());
        RentalContract c = new RentalContract();
        c.setId(9);
        c.setContractCode("HD-000009");
        c.setStatus(status);
        c.setStorageUnit(su);
        c.setCustomer(customer);
        c.setReservation(r);
        c.setStartDate(LocalDate.now());
        c.setEndDate(LocalDate.now().plusMonths(3));
        return c;
    }

    // ---------- BR-123 ----------

    @Test
    @DisplayName("BR-123: khách thân thiết gói 12T xếp trên khách mới gói 1T")
    void priorityScoreFavoursLoyalLongContracts() {
        assertEquals(0, ReservationService.priorityScore(1, 0));
        assertEquals(1, ReservationService.priorityScore(3, 0));
        assertEquals(4, ReservationService.priorityScore(6, 1));
        assertEquals(6, ReservationService.priorityScore(12, 3));
        assertTrue(ReservationService.priorityScore(1, 1) > ReservationService.priorityScore(3, 0),
                "khách cũ gói ngắn vẫn được ưu tiên hơn khách mới gói 3 tháng");
        assertNull(ReservationService.priorityLabel(3, 0));
        assertEquals("Khách thân thiết (4 HĐ) · Gói 12 tháng", ReservationService.priorityLabel(12, 4));
    }

    // ---------- PR-Q16 ----------

    @Test
    @DisplayName("PR-Q16: phí dọn & di dời hàng = 30% giá tháng, chỉ áp dụng điều khoản v3")
    void goodsMovingFeeOnlyForV3Terms() {
        LateFeeService lateFeeService = new LateFeeService();
        StorageUnit su = unit("KV-TB-A101", 1, 2, "OCCUPIED");

        assertEquals(0, new BigDecimal("555000").compareTo(
                lateFeeService.goodsMovingFee(contract("OVERDUE", su, null, "v3"))));
        assertEquals(0, BigDecimal.ZERO.compareTo(
                lateFeeService.goodsMovingFee(contract("OVERDUE", su, null, "v2"))));
        assertFalse(LateFeeService.acceptsMovingFeeTerms(null));
    }

    // ---------- BR-122 ----------

    private UnitTransferService transferService(RentalContract c, StorageUnit target, User manager,
                                                StorageUnitRepository units, ReservationRepository reservations) {
        RentalContractRepository contracts = mock(RentalContractRepository.class);
        UserRepository users = mock(UserRepository.class);
        when(contracts.findDetailById(9)).thenReturn(Optional.of(c));
        when(units.findById(target.getId())).thenReturn(Optional.of(target));
        when(users.findById(manager.getId())).thenReturn(Optional.of(manager));
        return new UnitTransferService(contracts, units, reservations, mock(UnitTransferRepository.class), users,
                mock(ActivityLogService.class), mock(NotificationService.class), mock(JdbcTemplate.class));
    }

    @Test
    @DisplayName("BR-122: chuyển sang ô khác loại → 400 UNIT_TYPE_MISMATCH (giữ nguyên giá thuê)")
    void transferRejectsDifferentUnitType() {
        StorageUnit current = unit("KV-TB-A101", 1, 2, "OCCUPIED");
        StorageUnit other = unit("KV-TB-B201", 1, 3, "AVAILABLE");
        User fm = user(6, "FACILITY_MANAGER", 1);
        UnitTransferService service = transferService(contract("ACTIVE", current, user(5, "CUSTOMER", null), "v3"),
                other, fm, mock(StorageUnitRepository.class), mock(ReservationRepository.class));

        TransferUnitRequest req = new TransferUnitRequest();
        req.setToUnitId("KV-TB-B201");
        req.setReasonType("CUSTOMER_REQUEST");
        req.setReason("Khách muốn ô gần cửa ra vào hơn");

        ContractException ex = assertThrows(ContractException.class, () -> service.transferUnit(9, 6, req));
        assertEquals("UNIT_TYPE_MISMATCH", ex.getCode());
    }

    @Test
    @DisplayName("BR-122: ô cũ lỗi do cơ sở phải vào bảo trì — hết suất trống thì 409 SLOT_IN_USE, chưa chiếm ô mới")
    void facilityIssueTransferChecksSlots() {
        StorageUnit current = unit("KV-TB-A101", 1, 2, "OCCUPIED");
        StorageUnit target = unit("KV-TB-A102", 1, 2, "AVAILABLE");
        User fm = user(6, "FACILITY_MANAGER", 1);
        StorageUnitRepository units = mock(StorageUnitRepository.class);
        ReservationRepository reservations = mock(ReservationRepository.class);
        when(units.countByFacility_IdAndUnitType_IdAndStatus(1, 2, "AVAILABLE")).thenReturn(1);
        when(reservations.countByFacility_IdAndUnitType_IdAndStatusInAndStorageUnitIdIsNull(eq(1), eq(2), anyList()))
                .thenReturn(1);
        UnitTransferService service = transferService(contract("ACTIVE", current, user(5, "CUSTOMER", null), "v3"),
                target, fm, units, reservations);

        TransferUnitRequest req = new TransferUnitRequest();
        req.setToUnitId("KV-TB-A102");
        req.setReasonType("FACILITY_ISSUE");
        req.setReason("Trần ô A101 bị thấm nước");

        ContractException ex = assertThrows(ContractException.class, () -> service.transferUnit(9, 6, req));
        assertEquals("SLOT_IN_USE", ex.getCode());
        assertEquals("OCCUPIED", current.getStatus());
    }

    @Test
    @DisplayName("BR-122: hợp đồng quá hạn không chuyển ô được → 409 CONTRACT_NOT_TRANSFERABLE")
    void overdueContractNotTransferable() {
        StorageUnit current = unit("KV-TB-A101", 1, 2, "OCCUPIED");
        StorageUnit target = unit("KV-TB-A102", 1, 2, "AVAILABLE");
        User fm = user(6, "FACILITY_MANAGER", 1);
        UnitTransferService service = transferService(contract("OVERDUE", current, user(5, "CUSTOMER", null), "v3"),
                target, fm, mock(StorageUnitRepository.class), mock(ReservationRepository.class));

        TransferUnitRequest req = new TransferUnitRequest();
        req.setToUnitId("KV-TB-A102");
        req.setReasonType("REARRANGE");
        req.setReason("Sắp xếp lại khu A cho gọn");

        ContractException ex = assertThrows(ContractException.class, () -> service.transferUnit(9, 6, req));
        assertEquals("CONTRACT_NOT_TRANSFERABLE", ex.getCode());
    }
}
