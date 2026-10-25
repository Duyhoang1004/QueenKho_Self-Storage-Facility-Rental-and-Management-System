package com.queenkho.api.service;

import com.queenkho.api.dto.bom.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;


@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BomRevenueServiceTest {

    @Mock
    private JdbcTemplate jdbc;

    @InjectMocks
    private BomRevenueService bomRevenueService;

    @BeforeEach
    void setUp() {
    }

    @Test
    @DisplayName("UC-29.1: getOverview tính đúng Doanh thu ròng = Tiền thuê + Phí phạt - Hoàn tiền")
    void testGetOverview_CalculatesNetRevenueCorrectly() {
        // gia lap
        // rentalRevenue = 15.000.000 (DEPOSIT + MONTHLY_RENT)
        // feesRevenue   = 1.200.000 (LATE_FEE + DAMAGE_FEE)
        // refundDisbursed = 2.000.000 (REFUND)
        // depositsHeld  = 5.000.000 (Ký quỹ đang giữ)
        when(jdbc.queryForObject(contains("IN ('DEPOSIT','MONTHLY_RENT')"), eq(BigDecimal.class)))
                .thenReturn(new BigDecimal("15000000.00"));
        when(jdbc.queryForObject(contains("IN ('LATE_FEE','DAMAGE_FEE')"), eq(BigDecimal.class)))
                .thenReturn(new BigDecimal("1200000.00"));
        when(jdbc.queryForObject(contains("= 'REFUND'"), eq(BigDecimal.class)))
                .thenReturn(new BigDecimal("2000000.00"));
        when(jdbc.queryForObject(contains("deposit_held_amount"), eq(BigDecimal.class)))
                .thenReturn(new BigDecimal("5000000.00"));

        when(jdbc.queryForObject(contains("COUNT(*)"), eq(Long.class)))
                .thenReturn(10L, 2L); 

        when(jdbc.queryForObject(contains("status='SUCCESS'"), eq(BigDecimal.class)))
                .thenReturn(BigDecimal.ZERO);

        RevenueOverviewResponse response = bomRevenueService.getOverview(null, "YEAR", 2026, null, null);

        assertNotNull(response);
        assertEquals(new BigDecimal("15000000.00"), response.getRentalRevenue());
        assertEquals(new BigDecimal("1200000.00"), response.getFeesRevenue());
        assertEquals(new BigDecimal("2000000.00"), response.getRefundDisbursed());
        assertEquals(new BigDecimal("5000000.00"), response.getDepositsHeld());

        BigDecimal expectedNet = new BigDecimal("14200000.00");
        assertEquals(0, expectedNet.compareTo(response.getNetRevenue()),
                "Doanh thu ròng phải bằng Thuê + Phí phạt - Hoàn tiền theo PR-M7");
        assertEquals(10L, response.getRentalCount());
        assertEquals(2L, response.getRefundCount());
    }

    @Test
    @DisplayName("UC-29.2: getOccupancy tính đúng tỷ lệ tái ký khi có cả hợp đồng gia hạn và kết thúc")
    void testGetOccupancy_RetentionRate_NormalCase() {
        when(jdbc.queryForObject(eq("SELECT COUNT(*) FROM storage_units su"), eq(Integer.class)))
                .thenReturn(100);
        when(jdbc.queryForObject(contains("rc.status IN ('ACTIVE','OVERDUE')"), eq(Integer.class)))
                .thenReturn(80);
        when(jdbc.queryForObject(eq("SELECT COUNT(*) FROM storage_units su WHERE su.status = 'MAINTENANCE'"), eq(Integer.class)))
                .thenReturn(10);

        when(jdbc.queryForObject(contains("YEAR(rc.start_date) = ?"), eq(Integer.class), any(), any()))
                .thenReturn(15);
        when(jdbc.queryForObject(contains("status IN ('TERMINATED','LIQUIDATED')"), eq(Integer.class), any(), any()))
                .thenReturn(4);
        when(jdbc.queryForObject(contains("activity_logs"), eq(Integer.class), any(), any()))
                .thenReturn(16);

        OccupancyReportResponse response = bomRevenueService.getOccupancy(null);

        assertNotNull(response);
        assertEquals(100, response.getTotalUnits());
        assertEquals(80, response.getOccupiedUnits());
        assertEquals(10, response.getMaintenanceUnits());
        assertEquals(10, response.getAvailableUnits()); // 100 - 80 - 10 = 10

        assertEquals(88.9, response.getOccupancyRate(), 0.1);

        assertEquals(80.0, response.getRetentionRate(), 0.01,
                "Tỷ lệ tái ký phải chia cho tổng số quyết định (renewed + terminated)");
    }

    @Test
    @DisplayName("UC-29.3: getOccupancy chặn chia cho 0 khi không có hợp đồng nào kết thúc (terminated = 0)")
    void testGetOccupancy_RetentionRate_ZeroTerminatedContracts() {
        when(jdbc.queryForObject(eq("SELECT COUNT(*) FROM storage_units su"), eq(Integer.class)))
                .thenReturn(50);
        when(jdbc.queryForObject(contains("rc.status IN ('ACTIVE','OVERDUE')"), eq(Integer.class)))
                .thenReturn(40);
        when(jdbc.queryForObject(contains("su.status = 'MAINTENANCE'"), eq(Integer.class)))
                .thenReturn(0);

        when(jdbc.queryForObject(contains("YEAR(rc.start_date) = ?"), eq(Integer.class), any(), any()))
                .thenReturn(5);
        when(jdbc.queryForObject(contains("status IN ('TERMINATED','LIQUIDATED')"), eq(Integer.class), any(), any()))
                .thenReturn(0);
        when(jdbc.queryForObject(contains("activity_logs"), eq(Integer.class), any(), any()))
                .thenReturn(10);

        OccupancyReportResponse response = bomRevenueService.getOccupancy(null);

        assertNotNull(response);
        assertEquals(0, response.getTerminatedContracts());
        // 10 renewed / (10 + 0) = 100.0%
        assertEquals(100.0, response.getRetentionRate(), 0.01,
                "Khi 0 ai dọn đi và 10 người gia hạn, tỷ lệ tái ký phải đạt 100.0%");
    }

    @Test
    @DisplayName("UC-29.4: getOccupancy trả về 0.0% khi không có phát sinh gia hạn lẫn kết thúc")
    void testGetOccupancy_RetentionRate_BothZero_ReturnsZero() {
        when(jdbc.queryForObject(anyString(), eq(Integer.class))).thenReturn(20);
        when(jdbc.queryForObject(contains("YEAR(rc.start_date) = ?"), eq(Integer.class), any(), any()))
                .thenReturn(0);
        when(jdbc.queryForObject(contains("status IN ('TERMINATED','LIQUIDATED')"), eq(Integer.class), any(), any()))
                .thenReturn(0);
        when(jdbc.queryForObject(contains("activity_logs"), eq(Integer.class), any(), any()))
                .thenReturn(0);

        OccupancyReportResponse response = bomRevenueService.getOccupancy(null);

        assertNotNull(response);
        assertEquals(0.0, response.getRetentionRate(),
                "Khi không có dữ liệu phát sinh, tỷ lệ tái ký an toàn phải là 0.0%");
    }

    @Test
    @DisplayName("UC-29.5: getByUnitType tính đúng tỷ lệ % đóng góp doanh thu của từng loại kho")
    void testGetByUnitType_CalculatesRevenueAndPercentages() {
        List<Map<String, Object>> mockRows = new ArrayList<>();

        Map<String, Object> row1 = new HashMap<>();
        row1.put("tid", 1);
        row1.put("tname", "Kho Mini (3.5m²)");
        row1.put("revenue", new BigDecimal("60000000.00")); 
        row1.put("totalRented", 20);
        mockRows.add(row1);

        Map<String, Object> row2 = new HashMap<>();
        row2.put("tid", 2);
        row2.put("tname", "Kho Tiêu Chuẩn (6m²)");
        row2.put("revenue", new BigDecimal("40000000.00")); 
        row2.put("totalRented", 10);
        mockRows.add(row2);

        when(jdbc.queryForList(contains("FROM unit_types ut"))).thenReturn(mockRows);

        List<UnitTypeRevenueResponse> result = bomRevenueService.getByUnitType(null);

        assertNotNull(result);
        assertEquals(2, result.size());

        assertEquals(1, result.get(0).getTypeId());
        assertEquals("Kho Mini (3.5m²)", result.get(0).getTypeName());
        assertEquals(new BigDecimal("60000000.00"), result.get(0).getRevenue());
        assertEquals(60.0, result.get(0).getPercentage(), 0.01);
        assertEquals(20, result.get(0).getTotalRented());

        assertEquals(2, result.get(1).getTypeId());
        assertEquals(40.0, result.get(1).getPercentage(), 0.01);
    }

    @Test
    @DisplayName("UC-29.6: getTimeline luôn trả đủ 12 tháng kể cả khi chưa có dữ liệu giao dịch")
    void testGetTimeline_AlwaysReturns12Months() {
        List<Map<String, Object>> mockRows = new ArrayList<>();

        Map<String, Object> t1 = new HashMap<>();
        t1.put("m", 1);
        t1.put("rent", new BigDecimal("10000000.00"));
        t1.put("fees", new BigDecimal("500000.00"));
        t1.put("refund", BigDecimal.ZERO);
        mockRows.add(t1);

        when(jdbc.queryForList(contains("GROUP BY MONTH(p.paid_at)"))).thenReturn(mockRows);

        List<RevenueTimelineResponse> timeline = bomRevenueService.getTimeline(null, 2026);

        assertNotNull(timeline);
        assertEquals(12, timeline.size(), "Biểu đồ timeline bắt buộc phải hiển thị đủ 12 tháng từ T1 đến T12");

        assertEquals("T1", timeline.get(0).getLabel());
        assertEquals(new BigDecimal("10000000.00"), timeline.get(0).getRent());

        assertEquals(BigDecimal.ZERO, timeline.get(2).getRent());
        assertEquals(BigDecimal.ZERO, timeline.get(2).getFees());
        assertEquals(BigDecimal.ZERO, timeline.get(2).getRefund());
    }

    @Test
    @DisplayName("UC-29.7: getTransactions trả về danh sách đối soát kèm thông tin ngân hàng và mã FT")
    void testGetTransactions_MapsCorrectly() {
        List<Map<String, Object>> mockRows = new ArrayList<>();
        Map<String, Object> tx = new HashMap<>();
        tx.put("id", 101);
        tx.put("transaction_code", "VNP14298101");
        tx.put("paid_at", java.sql.Timestamp.valueOf("2026-10-25 14:30:00"));
        tx.put("customerName", "Nguyễn Văn A");
        tx.put("customerPhone", "0901234567");
        tx.put("facilityName", "QueenKho Tân Bình");
        tx.put("contract_code", "HD-2026-001");
        tx.put("payment_type", "DEPOSIT");
        tx.put("payment_method", "VNPAY");
        tx.put("bank_transaction_code", "FT2629288192");
        tx.put("amount", new BigDecimal("3500000.00"));
        tx.put("status", "SUCCESS");
        tx.put("evidence_image_url", "https://img.queenkho.com/ft1.png");
        tx.put("note", "Cọc phòng kho tiêu chuẩn");
        mockRows.add(tx);

        when(jdbc.queryForList(contains("FROM payment_transactions p"), any(Object[].class)))
                .thenReturn(mockRows);

        List<RevenueTransactionResponse> result = bomRevenueService.getTransactions(1, "DEPOSIT");

        assertNotNull(result);
        assertEquals(1, result.size());
        RevenueTransactionResponse r = result.get(0);
        assertEquals("VNP14298101", r.getTxnRef());
        assertEquals("Nguyễn Văn A", r.getCustomerName());
        assertEquals("QueenKho Tân Bình", r.getFacilityName());
        assertEquals("FT2629288192", r.getBankTxnCode());
        assertEquals(new BigDecimal("3500000.00"), r.getAmount());
        assertEquals("SUCCESS", r.getStatus());
    }
}
