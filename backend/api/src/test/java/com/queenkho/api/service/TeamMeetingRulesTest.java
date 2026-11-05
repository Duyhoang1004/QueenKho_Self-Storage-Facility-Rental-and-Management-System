package com.queenkho.api.service;

import com.queenkho.api.entity.GoodsCategory;
import com.queenkho.api.entity.UnitType;
import com.queenkho.api.entity.Voucher;
import com.queenkho.api.exception.ReservationException;
import com.queenkho.api.exception.UnitTypeException;
import com.queenkho.api.repository.CentralWarehouseRepository;
import com.queenkho.api.repository.GoodsCategoryRepository;
import com.queenkho.api.repository.UnitTypeRepository;
import com.queenkho.api.repository.VoucherRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

// Họp nhóm 05/11/2026: BR-131 loại hàng khi đặt kho, BR-133 voucher theo loại kho, loại kho thường / lạnh / đông
class TeamMeetingRulesTest {

    GoodsCategoryRepository goodsRepo = mock(GoodsCategoryRepository.class);
    OperationsCatalogService catalog = new OperationsCatalogService(goodsRepo, mock(CentralWarehouseRepository.class),
            mock(ActivityLogService.class));

    UnitType normal = unitType("NORMAL");
    UnitType cold = unitType("COLD");

    @BeforeEach
    void setUp() {
        List<GoodsCategory> active = Arrays.asList(
                category("HOUSEHOLD", "Gia dụng", false, false),
                category("FOOD", "Thực phẩm", true, false),
                category("OTHER", "Khác", false, true));
        when(goodsRepo.findByStatusOrderBySortOrderAscIdAsc("ACTIVE")).thenReturn(active);
        when(goodsRepo.findAll()).thenReturn(active);
    }

    private static UnitType unitType(String temperature) {
        UnitType u = new UnitType();
        u.setId("NORMAL".equals(temperature) ? 1 : 2);
        u.setTemperatureClass(temperature);
        return u;
    }

    private static GoodsCategory category(String code, String name, boolean cold, boolean note) {
        GoodsCategory c = new GoodsCategory();
        c.setCode(code);
        c.setName(name);
        c.setRequiresColdStorage(cold);
        c.setRequiresNote(note);
        return c;
    }

    private String goodsError(List<String> codes, String description, UnitType unitType) {
        return assertThrows(ReservationException.class,
                () -> catalog.validateBookingGoods(codes, description, unitType)).getCode();
    }

    @Test
    @DisplayName("BR-131: chọn loại hàng hợp lệ → lưu mã viết hoa, bỏ trùng; chưa chọn → GOODS_CATEGORY_REQUIRED")
    void goodsCategoryRequiredAndNormalized() {
        assertEquals("HOUSEHOLD", catalog.validateBookingGoods(List.of("household", "HOUSEHOLD "), null, normal));
        assertEquals("GOODS_CATEGORY_REQUIRED", goodsError(List.of(), null, normal));
        assertEquals("GOODS_CATEGORY_REQUIRED", goodsError(null, null, normal));
        assertEquals("INVALID_GOODS_CATEGORY", goodsError(List.of("WEAPON"), null, normal));
    }

    @Test
    @DisplayName("BR-131: thực phẩm chỉ gửi kho lạnh / kho đông — kho thường → GOODS_REQUIRES_COLD_STORAGE")
    void foodNeedsColdStorage() {
        assertEquals("GOODS_REQUIRES_COLD_STORAGE", goodsError(List.of("FOOD"), null, normal));
        assertEquals("FOOD,HOUSEHOLD", catalog.validateBookingGoods(List.of("FOOD", "HOUSEHOLD"), null, cold));
    }

    @Test
    @DisplayName("BR-131: chọn \"Khác\" phải mô tả hàng; tên hiển thị đọc theo danh mục")
    void otherNeedsDescription() {
        assertEquals("GOODS_DESCRIPTION_REQUIRED", goodsError(List.of("OTHER"), " ", normal));
        assertEquals("OTHER", catalog.validateBookingGoods(List.of("OTHER"), "Đồ câu cá", normal));
        assertEquals(List.of("Gia dụng", "Khác", "XYZ"), catalog.goodsLabels("HOUSEHOLD,OTHER,XYZ"));
    }

    @Test
    @DisplayName("Loại kho NORMAL / COLD / FROZEN; để trống = NORMAL; giá trị lạ → 400")
    void temperatureClass() {
        assertEquals("NORMAL", UnitTypeService.normalizeTemperature(null));
        assertEquals("FROZEN", UnitTypeService.normalizeTemperature(" frozen "));
        assertEquals("INVALID_INPUT", assertThrows(UnitTypeException.class,
                () -> UnitTypeService.normalizeTemperature("HOT")).getCode());
    }

    @Test
    @DisplayName("BR-133: voucher gắn 1 loại kho chỉ áp cho loại kho đó; không gắn → áp mọi loại kho")
    void voucherPerUnitType() {
        VoucherService vouchers = new VoucherService(mock(VoucherRepository.class), mock(UnitTypeRepository.class),
                mock(PricingService.class), mock(JdbcTemplate.class));
        Voucher v = new Voucher();
        v.setStatus("ACTIVE");
        v.setUnitTypeId(2);

        assertEquals("Mã voucher không áp dụng cho loại kho này", vouchers.validationError(v, 7, 1, 1, 3));
        assertNull(vouchers.validationError(v, 7, 1, 2, 3));

        v.setUnitTypeId(null);
        assertNull(vouchers.validationError(v, 7, 1, 1, 3));
    }
}
