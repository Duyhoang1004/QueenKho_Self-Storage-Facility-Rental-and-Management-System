package com.queenkho.api.service;

import com.queenkho.api.dto.CustomerPaymentsResponse;
import com.queenkho.api.dto.CustomerPaymentsResponse.PaymentItem;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.repository.RentalContractRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit matrix for the customer's debt/payment screen.  The matrix deliberately
 * covers accounting classification only: no database, gateway or controller.
 */
@ExtendWith(MockitoExtension.class)
class CustomerPaymentDebtMatrixTest {
    @Mock JdbcTemplate jdbc;
    @Mock RentalContractRepository contracts;
    @Mock LateFeeService lateFees;

    private CustomerPaymentService service;

    @BeforeEach
    void setUp() {
        service = new CustomerPaymentService(jdbc, contracts, lateFees);
    }

    private static PaymentItem item(String type, String method, String amount, String status, Integer renewalMonths) {
        return new PaymentItem(1, "TX-1", "FT-1", type, method,
                amount == null ? null : new BigDecimal(amount), status, null, renewalMonths,
                20, "RES-20", 30, "HD-30", "Tân Bình", "Mini M");
    }

    private CustomerPaymentsResponse summary(PaymentItem... rows) {
        when(jdbc.query(anyString(), any(RowMapper.class), eq(42), eq(42), eq(42))).thenReturn(List.of(rows));
        when(contracts.findAllByCustomerId(42)).thenReturn(List.<RentalContract>of());
        return service.getMyPayments(42);
    }

    @ParameterizedTest(name = "{0}/{1}/{2} renewal={3} => debt {4}")
    @CsvSource({
            "DAMAGE_FEE,VNPAY,PENDING,,true",
            "OVERSTAY_FEE,VNPAY,PENDING,,true",
            "DAMAGE_FEE,VNPAY,SUCCESS,,false",
            "DAMAGE_FEE,VNPAY,FAILED,,false",
            "DAMAGE_FEE,CASH,PENDING,,false",
            "DAMAGE_FEE,DEPOSIT_OFFSET,PENDING,,false",
            "OVERSTAY_FEE,VNPAY,SUCCESS,,false",
            "MONTHLY_RENT,VNPAY,PENDING,,false",
            "REFUND,VNPAY,PENDING,,false",
            "COMPENSATION,VNPAY,PENDING,,false",
            "DAMAGE_FEE,VNPAY,PENDING,1,false",
            "OVERSTAY_FEE,VNPAY,PENDING,12,false"
    })
    void debtClassificationMatrix(String type, String method, String status, Integer renewalMonths, boolean expected) {
        assertEquals(expected, CustomerPaymentService.isDebt(item(type, method, "100", status, renewalMonths)));
    }

    @Test
    void successfulNormalCustomerPaymentsAreAddedToPaidTotal() {
        CustomerPaymentsResponse response = summary(
                item("DEPOSIT", "VNPAY", "1000000", "SUCCESS", null),
                item("MONTHLY_RENT", "VNPAY", "2000000", "SUCCESS", null),
                item("LATE_FEE", "VNPAY", "300000", "SUCCESS", null));

        assertEquals(0, new BigDecimal("3300000").compareTo(response.summary().totalPaid()));
        assertEquals(BigDecimal.ZERO, response.summary().outstandingDebt());
    }

    @Test
    void failedOrPendingNonDebtPaymentsDoNotIncreasePaidTotal() {
        CustomerPaymentsResponse response = summary(
                item("DEPOSIT", "VNPAY", "1000000", "FAILED", null),
                item("MONTHLY_RENT", "VNPAY", "2000000", "PENDING", null),
                item("LATE_FEE", "VNPAY", "300000", "CANCELLED", null));

        assertEquals(BigDecimal.ZERO, response.summary().totalPaid());
        assertTrue(response.debts().isEmpty());
    }

    @Test
    void completedRefundAndCompensationAreNotReportedAsCustomerPayments() {
        CustomerPaymentsResponse response = summary(
                item("REFUND", "BANK_TRANSFER", "700000", "SUCCESS", null),
                item("COMPENSATION", "BANK_TRANSFER", "200000", "SUCCESS", null));

        assertEquals(BigDecimal.ZERO, response.summary().totalPaid());
        assertEquals(0, new BigDecimal("900000").compareTo(response.summary().totalRefunded()));
    }

    @Test
    void pendingRefundAndCompensationStaySeparateFromCompletedRefund() {
        CustomerPaymentsResponse response = summary(
                item("REFUND", "BANK_TRANSFER", "700000", "PENDING", null),
                item("COMPENSATION", "BANK_TRANSFER", "200000", "PENDING", null),
                item("REFUND", "BANK_TRANSFER", "50000", "FAILED", null));

        assertEquals(BigDecimal.ZERO, response.summary().totalRefunded());
        assertEquals(0, new BigDecimal("900000").compareTo(response.summary().pendingRefund()));
    }

    @Test
    void successfulDepositOffsetIsTrackedWithoutPretendingCustomerPaidOnline() {
        CustomerPaymentsResponse response = summary(
                item("DAMAGE_FEE", "DEPOSIT_OFFSET", "450000", "SUCCESS", null),
                item("OVERSTAY_FEE", "DEPOSIT_OFFSET", "50000", "SUCCESS", null));

        assertEquals(BigDecimal.ZERO, response.summary().totalPaid());
        assertEquals(0, new BigDecimal("500000").compareTo(response.summary().depositOffset()));
    }

    @Test
    void pendingDebtIsBothInOutstandingAmountAndActionableDebtList() {
        CustomerPaymentsResponse response = summary(
                item("DAMAGE_FEE", "VNPAY", "450000", "PENDING", null),
                item("OVERSTAY_FEE", "VNPAY", "50000", "PENDING", null));

        assertEquals(0, new BigDecimal("500000").compareTo(response.summary().outstandingDebt()));
        assertEquals(2, response.debts().size());
    }

    @Test
    void nullAmountIsTreatedAsZeroInsteadOfCrashingPaymentScreen() {
        CustomerPaymentsResponse response = summary(item("DEPOSIT", "VNPAY", null, "SUCCESS", null));

        assertEquals(BigDecimal.ZERO, response.summary().totalPaid());
        assertEquals(1, response.transactions().size());
    }

    @Test
    void emptyPaymentHistoryReturnsAllZeroSummaryAndNoDebt() {
        CustomerPaymentsResponse response = summary();

        assertAll(
                () -> assertEquals(BigDecimal.ZERO, response.summary().totalPaid()),
                () -> assertEquals(BigDecimal.ZERO, response.summary().totalRefunded()),
                () -> assertEquals(BigDecimal.ZERO, response.summary().pendingRefund()),
                () -> assertEquals(BigDecimal.ZERO, response.summary().outstandingDebt()),
                () -> assertEquals(BigDecimal.ZERO, response.summary().depositOffset()),
                () -> assertTrue(response.debts().isEmpty()));
    }
}
