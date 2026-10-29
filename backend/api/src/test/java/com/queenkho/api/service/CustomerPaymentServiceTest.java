package com.queenkho.api.service;

import com.queenkho.api.dto.CustomerPaymentsResponse;
import com.queenkho.api.dto.CustomerPaymentsResponse.PaymentItem;
import com.queenkho.api.repository.RentalContractRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

// UC-20: tổng hợp đúng các nhóm tiền và nhận diện khoản nợ phí sự cố
@ExtendWith(MockitoExtension.class)
class CustomerPaymentServiceTest {

    @Mock JdbcTemplate jdbcTemplate;
    @Mock RentalContractRepository contracts;
    @Mock LateFeeService lateFeeService;

    private static PaymentItem item(int id, String type, String method, String amount, String status) {
        return new PaymentItem(id, "TX" + id, "FT" + id, type, method, new BigDecimal(amount), status, null, null,
                1, "RES-1", 2, "HD-1", "Tân Bình", "Mini M");
    }

    @Test
    @DisplayName("Tổng đã trả / đã hoàn / chờ hoàn / trừ cọc / còn nợ tính đúng, FAILED không cộng")
    void summarizesPayments() {
        List<PaymentItem> rows = List.of(
                item(1, "DEPOSIT", "VNPAY", "2787500", "SUCCESS"),
                item(2, "DEPOSIT", "VNPAY", "2787500", "FAILED"),
                item(3, "MONTHLY_RENT", "VNPAY", "750000", "SUCCESS"),
                item(4, "REFUND", "BANK_TRANSFER", "537500", "SUCCESS"),
                item(5, "REFUND", "BANK_TRANSFER", "100000", "PENDING"),
                item(6, "DAMAGE_FEE", "DEPOSIT_OFFSET", "750000", "SUCCESS"),
                item(7, "DAMAGE_FEE", "VNPAY", "250000", "PENDING"));
        when(jdbcTemplate.query(anyString(), any(RowMapper.class), eq(1), eq(1), eq(1))).thenReturn(rows);
        when(contracts.findAllByCustomerId(1)).thenReturn(List.of());

        CustomerPaymentsResponse response = new CustomerPaymentService(jdbcTemplate, contracts, lateFeeService).getMyPayments(1);

        assertEquals(0, new BigDecimal("3537500").compareTo(response.summary().totalPaid()));
        assertEquals(0, new BigDecimal("537500").compareTo(response.summary().totalRefunded()));
        assertEquals(0, new BigDecimal("100000").compareTo(response.summary().pendingRefund()));
        assertEquals(0, new BigDecimal("750000").compareTo(response.summary().depositOffset()));
        assertEquals(0, new BigDecimal("250000").compareTo(response.summary().outstandingDebt()));
        assertEquals(1, response.debts().size());
        assertEquals(7, response.debts().get(0).id());
        assertEquals(7, response.transactions().size());
    }

    @Test
    @DisplayName("Chỉ phí sự cố VNPAY còn PENDING mới là khoản nợ khách tự trả")
    void debtDetection() {
        assertTrue(CustomerPaymentService.isDebt(item(1, "DAMAGE_FEE", "VNPAY", "1", "PENDING")));
        assertFalse(CustomerPaymentService.isDebt(item(1, "DAMAGE_FEE", "VNPAY", "1", "SUCCESS")));
        assertFalse(CustomerPaymentService.isDebt(item(1, "DAMAGE_FEE", "DEPOSIT_OFFSET", "1", "PENDING")));
        assertFalse(CustomerPaymentService.isDebt(item(1, "MONTHLY_RENT", "VNPAY", "1", "PENDING")));
    }

    @Test
    @DisplayName("Thiếu khách hàng → lỗi")
    void requiresCustomer() {
        assertThrows(IllegalArgumentException.class,
                () -> new CustomerPaymentService(jdbcTemplate, contracts, lateFeeService).getMyPayments(null));
    }
}
