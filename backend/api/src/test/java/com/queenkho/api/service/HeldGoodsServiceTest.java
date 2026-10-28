package com.queenkho.api.service;

import com.queenkho.api.dto.ResolveHeldGoodsRequest;
import com.queenkho.api.entity.HeldGoods;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.Reservation;
import com.queenkho.api.entity.Role;
import com.queenkho.api.entity.StaffTask;
import com.queenkho.api.entity.StorageUnit;
import com.queenkho.api.entity.UnitType;
import com.queenkho.api.entity.User;
import com.queenkho.api.exception.HeldGoodsException;
import com.queenkho.api.repository.HeldGoodsRepository;
import com.queenkho.api.repository.StaffTaskRepository;
import com.queenkho.api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

// PR-Q10: xử lý hàng của khách lưu giữ sau thanh lý — đúng điều kiện điều khoản, tiền bán trừ nợ rồi hoàn khách
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class HeldGoodsServiceTest {

    @Mock HeldGoodsRepository heldGoodsRepository;
    @Mock StaffTaskRepository staffTaskRepository;
    @Mock UserRepository userRepository;
    @Mock ActivityLogService activityLogService;
    @Mock JdbcTemplate jdbcTemplate;

    @InjectMocks HeldGoodsService service;

    User manager;
    HeldGoods goods;
    Reservation reservation;
    RentalContract contract;

    @BeforeEach
    void setUp() {
        Role role = new Role();
        role.setName("FACILITY_MANAGER");
        manager = new User();
        manager.setId(6);
        manager.setRole(role);
        manager.setFacilityId(1);
        manager.setFullName("FM Tân Bình");

        User customer = new User();
        customer.setId(2);
        customer.setFullName("Khách 1");
        reservation = new Reservation();
        reservation.setTermsVersion("v1");
        contract = new RentalContract();
        contract.setId(9);
        contract.setContractCode("HD-1");
        contract.setCustomer(customer);
        contract.setReservation(reservation);
        contract.setDepositHeldAmount(new BigDecimal("1000000"));

        goods = new HeldGoods();
        goods.setId(5);
        goods.setFacilityId(1);
        goods.setContract(contract);
        goods.setStatus("HOLDING");
        goods.setHoldUntil(LocalDate.now().minusDays(1)); // đã hết hạn lưu giữ

        when(userRepository.findById(6)).thenReturn(Optional.of(manager));
        when(heldGoodsRepository.findDetailById(5)).thenReturn(Optional.of(goods));
        when(heldGoodsRepository.resolve(eq(5), anyString(), anyString(), any(), any(), any(), any(), any())).thenReturn(1);
        debt("0");
    }

    private void debt(String amount) {
        when(jdbcTemplate.queryForObject(contains("SUM(amount)"), eq(BigDecimal.class), any(), any()))
                .thenReturn(new BigDecimal(amount));
    }

    private static ResolveHeldGoodsRequest req(String outcome, String proceeds) {
        ResolveHeldGoodsRequest r = new ResolveHeldGoodsRequest();
        r.setOutcome(outcome);
        r.setNote("Biên bản xử lý hàng lưu giữ số 01");
        r.setProceedsAmount(proceeds == null ? null : new BigDecimal(proceeds));
        return r;
    }

    private String code(ResolveHeldGoodsRequest r) {
        return assertThrows(HeldGoodsException.class, () -> service.resolve(5, 6, r)).getCode();
    }

    @Test
    @DisplayName("Bán thanh lý: tiền bán 2.000.000 trừ nợ 500.000, dư 1.500.000 + cọc còn giữ 1.000.000 → task REFUND 2.500.000")
    void sellOffsetsDebtThenRefunds() {
        debt("500000");
        when(jdbcTemplate.queryForObject(contains("task_type = 'REFUND'"), eq(Integer.class), any())).thenReturn(0);
        when(jdbcTemplate.queryForList(contains("status = 'PENDING'"), (Object) any(), (Object) any()))
                .thenReturn(List.of(Map.of("id", 70, "amount", new BigDecimal("500000"), "user_id", 2, "contract_id", 3)));

        service.resolve(5, 6, req("SOLD", "2000000"));

        verify(heldGoodsRepository).resolve(eq(5), eq("SOLD"), anyString(), eq(manager),
                eq(new BigDecimal("2000000")), eq(new BigDecimal("500000")), eq(new BigDecimal("2500000")), isNull());
        verify(jdbcTemplate).update(contains("payment_method = 'GOODS_SALE'"), eq(70));
        ArgumentCaptor<StaffTask> task = ArgumentCaptor.forClass(StaffTask.class);
        verify(staffTaskRepository).save(task.capture());
        assertEquals("REFUND", task.getValue().getTaskType());
        assertTrue(task.getValue().getNote().contains("THỰC HOÀN 2.500.000đ"));
        verify(jdbcTemplate).update(contains("'REFUND', 'BANK_TRANSFER'"), startsWith("REF-SALE-9-"), eq(2), eq(9), eq(new BigDecimal("2500000")));
    }

    @Test
    @DisplayName("Bán thanh lý khi FM đã tạo yêu cầu hoàn cọc riêng → chỉ hoàn phần dư tiền bán")
    void sellDoesNotRefundDepositTwice() {
        when(jdbcTemplate.queryForObject(contains("task_type = 'REFUND'"), eq(Integer.class), any())).thenReturn(1);

        service.resolve(5, 6, req("SOLD", "800000"));

        verify(heldGoodsRepository).resolve(eq(5), eq("SOLD"), anyString(), eq(manager),
                eq(new BigDecimal("800000")), eq(BigDecimal.ZERO), eq(new BigDecimal("800000")), isNull());
    }

    @Test
    @DisplayName("Bán thanh lý: chưa hết 60 ngày → 409 HOLD_NOT_EXPIRED; khách chưa đồng ý điều khoản → 409 TERMS_NOT_ACCEPTED; thiếu tiền bán → 400")
    void sellGuards() {
        goods.setHoldUntil(LocalDate.now().plusDays(10));
        assertEquals("HOLD_NOT_EXPIRED", code(req("SOLD", "100000")));

        goods.setHoldUntil(LocalDate.now().minusDays(1));
        reservation.setTermsVersion(null);
        assertEquals("TERMS_NOT_ACCEPTED", code(req("SOLD", "100000")));

        reservation.setTermsVersion("v1");
        assertEquals("INVALID_INPUT", code(req("SOLD", null)));
        verify(heldGoodsRepository, never()).resolve(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Khách nhận lại khi còn nợ → 409 CUSTOMER_HAS_DEBT; hết nợ → được (kể cả chưa hết hạn)")
    void returnRequiresNoDebt() {
        debt("300000");
        assertEquals("CUSTOMER_HAS_DEBT", code(req("RETURNED", null)));

        debt("0");
        goods.setHoldUntil(LocalDate.now().plusDays(30));
        service.resolve(5, 6, req("RETURNED", null));
        verify(heldGoodsRepository).resolve(eq(5), eq("RETURNED"), anyString(), eq(manager), isNull(), isNull(), isNull(), isNull());
    }

    @Test
    @DisplayName("Tiêu huỷ phải chờ hết hạn; giao cơ quan chức năng làm ngay được")
    void destroyWaitsHandOverDoesNot() {
        goods.setHoldUntil(LocalDate.now().plusDays(30));
        assertEquals("HOLD_NOT_EXPIRED", code(req("DESTROYED", null)));

        service.resolve(5, 6, req("HANDED_TO_AUTHORITY", null));
        verify(heldGoodsRepository).resolve(eq(5), eq("HANDED_TO_AUTHORITY"), anyString(), eq(manager), isNull(), isNull(), isNull(), isNull());
    }

    @Test
    @DisplayName("Đã xử lý rồi / 2 người bấm cùng lúc → 409; FM cơ sở khác → 403; cách xử lý lạ → 400")
    void guards() {
        assertEquals("INVALID_INPUT", code(req("BURN", null)));

        when(heldGoodsRepository.resolve(eq(5), anyString(), anyString(), any(), any(), any(), any(), any())).thenReturn(0);
        assertEquals("HELD_GOODS_ALREADY_RESOLVED", code(req("HANDED_TO_AUTHORITY", null)));

        goods.setStatus("SOLD");
        assertEquals("HELD_GOODS_ALREADY_RESOLVED", code(req("HANDED_TO_AUTHORITY", null)));

        goods.setFacilityId(2);
        assertEquals("FORBIDDEN_FACILITY", code(req("HANDED_TO_AUTHORITY", null)));
    }

    // PR-Q15: ô giá 3.000.000đ/tháng → 100.000đ/ngày; phí lưu giữ 20% → 20.000đ mỗi ngày lưu giữ
    private void agreedTermsV2() {
        reservation.setTermsVersion("v2");
        UnitType unitType = new UnitType();
        unitType.setBasePriceMonthly(new BigDecimal("3000000"));
        StorageUnit unit = new StorageUnit();
        unit.setUnitType(unitType);
        contract.setStorageUnit(unit);
    }

    @Test
    @DisplayName("PR-Q15 bán thanh lý: lưu đủ 60 ngày → phí lưu giữ 1.200.000 trừ vào tiền bán, hoàn 800.000 + cọc 1.000.000")
    void sellChargesStorageFeeFromProceeds() {
        agreedTermsV2();
        when(jdbcTemplate.queryForObject(contains("task_type = 'REFUND'"), eq(Integer.class), any())).thenReturn(0);

        service.resolve(5, 6, req("SOLD", "2000000"));

        verify(heldGoodsRepository).resolve(eq(5), eq("SOLD"), anyString(), eq(manager), eq(new BigDecimal("2000000")),
                eq(BigDecimal.ZERO), eq(new BigDecimal("1800000")), eq(new BigDecimal("1200000")));
        verify(jdbcTemplate).update(contains("'OVERSTAY_FEE'"), startsWith("HG-G-9-"), eq(2), isNull(), eq(9),
                eq("GOODS_SALE"), eq(new BigDecimal("1200000")));
    }

    @Test
    @DisplayName("PR-Q15 khách nhận lại sau 30 ngày: phí 600.000, cọc còn 200.000 → thiếu 400.000 phải thu tại quầy")
    void returnRequiresStorageFeeAtCounter() {
        agreedTermsV2();
        contract.setDepositHeldAmount(new BigDecimal("200000"));
        goods.setHoldUntil(LocalDate.now().plusDays(30)); // đã lưu 30 ngày
        when(jdbcTemplate.queryForObject(contains("task_type = 'REFUND'"), eq(Integer.class), any())).thenReturn(0);

        assertEquals("STORAGE_FEE_UNPAID", code(req("RETURNED", null)));

        ResolveHeldGoodsRequest paid = req("RETURNED", null);
        paid.setStorageFeeCollected(true);
        service.resolve(5, 6, paid);

        verify(heldGoodsRepository).resolve(eq(5), eq("RETURNED"), anyString(), eq(manager), isNull(), isNull(), isNull(),
                eq(new BigDecimal("600000")));
        verify(jdbcTemplate).update(contains("UPDATE rental_contracts SET deposit_held_amount"), eq(new BigDecimal("200000")), eq(9));
        verify(jdbcTemplate).update(contains("'OVERSTAY_FEE'"), startsWith("HG-C-9-"), eq(2), isNull(), eq(9),
                eq("CASH"), eq(new BigDecimal("400000")));
    }

    @Test
    @DisplayName("PR-Q15 đơn điều khoản v1 không tính phí lưu giữ; giao cơ quan chức năng cũng không tính")
    void noStorageFeeForOldTermsOrAuthority() {
        UnitType unitType = new UnitType();
        unitType.setBasePriceMonthly(new BigDecimal("3000000"));
        StorageUnit unit = new StorageUnit();
        unit.setUnitType(unitType);
        contract.setStorageUnit(unit);

        assertEquals(0, service.storageFee(goods, LocalDate.now()).compareTo(BigDecimal.ZERO));

        reservation.setTermsVersion("v2");
        service.resolve(5, 6, req("HANDED_TO_AUTHORITY", null));
        verify(heldGoodsRepository).resolve(eq(5), eq("HANDED_TO_AUTHORITY"), anyString(), eq(manager),
                isNull(), isNull(), isNull(), isNull());
    }
}
