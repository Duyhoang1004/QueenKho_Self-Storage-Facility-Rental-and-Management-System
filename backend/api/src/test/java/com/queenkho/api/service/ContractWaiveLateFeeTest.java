package com.queenkho.api.service;

import com.queenkho.api.dto.LateFeeCalculationResult;
import com.queenkho.api.entity.Facility;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.RentalPolicy;
import com.queenkho.api.entity.Role;
import com.queenkho.api.entity.StorageUnit;
import com.queenkho.api.entity.User;
import com.queenkho.api.exception.ContractException;
import com.queenkho.api.repository.RentalContractRepository;
import com.queenkho.api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

// Flow 4 / 6: FM miễn phí trễ — chỉ khi BOM cho phép, chỉ HĐ quá hạn của cơ sở mình, bắt buộc lý do
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ContractWaiveLateFeeTest {

    @Mock RentalContractRepository rentalContractRepository;
    @Mock UserRepository userRepository;
    @Mock JdbcTemplate jdbcTemplate;
    @Mock LateFeeService lateFeeService;
    @Mock PricingService pricingService;

    @InjectMocks ContractService service;

    RentalContract contract;
    RentalPolicy policy;

    @BeforeEach
    void setUp() {
        Role fmRole = new Role();
        fmRole.setName("FACILITY_MANAGER");
        User manager = new User();
        manager.setId(6);
        manager.setRole(fmRole);
        manager.setFacilityId(1);
        manager.setFullName("FM Tân Bình");
        when(userRepository.findById(6)).thenReturn(Optional.of(manager));

        Facility facility = new Facility();
        facility.setId(1);
        StorageUnit unit = new StorageUnit();
        unit.setFacility(facility);
        contract = new RentalContract();
        contract.setId(9);
        contract.setContractCode("HD-100001");
        contract.setStatus("OVERDUE");
        contract.setStorageUnit(unit);
        when(rentalContractRepository.findDetailById(9)).thenReturn(Optional.of(contract));

        policy = new RentalPolicy();
        policy.setAllowLateFeeWaiver(true);
        when(pricingService.activePolicy(1)).thenReturn(policy);
        when(lateFeeService.calculateLateFee(contract)).thenReturn(
                LateFeeCalculationResult.builder().overdueDays(3).lateFeeAmount(new BigDecimal("225000")).build());
    }

    @Test
    @DisplayName("Miễn thành công: bật cờ, lưu lý do, huỷ link gia hạn đã chốt phí trễ cũ, ghi log [FEE_WAIVE]")
    void waiveSuccess() {
        Map<String, Object> result = service.waiveLateFee(9, 6, "Khách nằm viện, hứa gia hạn hôm nay");

        assertTrue(contract.getLateFeeWaived());
        assertTrue(contract.getLateFeeWaiverNote().contains("Khách nằm viện"));
        assertEquals(0, new BigDecimal("225000").compareTo((BigDecimal) result.get("waivedAmount")));
        verify(rentalContractRepository).save(contract);
        verify(jdbcTemplate).update(contains("SET status = 'FAILED'"), eq(9));
        verify(jdbcTemplate).update(contains("INSERT INTO activity_logs"), eq(6), startsWith("[FEE_WAIVE]"), eq("9"));
    }

    @Test
    @DisplayName("BOM tắt quyền miễn phí trễ trong chính sách → 403 WAIVER_NOT_ALLOWED")
    void policyDisallowsWaiver() {
        policy.setAllowLateFeeWaiver(false);
        ContractException ex = assertThrows(ContractException.class, () -> service.waiveLateFee(9, 6, "Lý do đủ dài"));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        assertEquals("WAIVER_NOT_ALLOWED", ex.getCode());
        assertNotEquals(Boolean.TRUE, contract.getLateFeeWaived());
    }

    @Test
    @DisplayName("HĐ không quá hạn → 409 CONTRACT_NOT_OVERDUE")
    void onlyOverdueContracts() {
        contract.setStatus("ACTIVE");
        ContractException ex = assertThrows(ContractException.class, () -> service.waiveLateFee(9, 6, "Lý do đủ dài"));
        assertEquals("CONTRACT_NOT_OVERDUE", ex.getCode());
    }

    @Test
    @DisplayName("Miễn lần 2 cho cùng đợt quá hạn → 409 LATE_FEE_ALREADY_WAIVED")
    void cannotWaiveTwice() {
        contract.setLateFeeWaived(true);
        ContractException ex = assertThrows(ContractException.class, () -> service.waiveLateFee(9, 6, "Lý do đủ dài"));
        assertEquals("LATE_FEE_ALREADY_WAIVED", ex.getCode());
    }

    @Test
    @DisplayName("Lý do ngắn hơn 5 ký tự → 400")
    void reasonRequired() {
        ContractException ex = assertThrows(ContractException.class, () -> service.waiveLateFee(9, 6, " ok "));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    @DisplayName("HĐ thuộc cơ sở khác → 403 FORBIDDEN_FACILITY")
    void otherFacilityRejected() {
        contract.getStorageUnit().getFacility().setId(2);
        ContractException ex = assertThrows(ContractException.class, () -> service.waiveLateFee(9, 6, "Lý do đủ dài"));
        assertEquals("FORBIDDEN_FACILITY", ex.getCode());
    }
}
