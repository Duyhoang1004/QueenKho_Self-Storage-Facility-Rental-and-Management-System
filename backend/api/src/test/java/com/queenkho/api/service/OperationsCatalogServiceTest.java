package com.queenkho.api.service;

import com.queenkho.api.entity.GoodsCategory;
import com.queenkho.api.entity.UnitType;
import com.queenkho.api.exception.ReservationException;
import com.queenkho.api.repository.CentralWarehouseRepository;
import com.queenkho.api.repository.GoodsCategoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;

import java.util.List;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OperationsCatalogServiceTest {
    @Mock GoodsCategoryRepository categories;
    @Mock CentralWarehouseRepository warehouses;
    @Mock ActivityLogService activity;
    OperationsCatalogService service;

    @BeforeEach void setup() { service = new OperationsCatalogService(categories, warehouses, activity); }

    private GoodsCategory category(String code, String name, boolean cold, boolean note) {
        GoodsCategory c = new GoodsCategory(); c.setId(1); c.setCode(code); c.setName(name);
        c.setRequiresColdStorage(cold); c.setRequiresNote(note); c.setStatus("ACTIVE"); return c;
    }

    private UnitType unit(String temperature) { UnitType u = new UnitType(); u.setTemperatureClass(temperature); return u; }

    @Test void normalizesCodesRemovesBlanksAndDuplicates() {
        when(categories.findByStatusOrderBySortOrderAscIdAsc("ACTIVE")).thenReturn(List.of(category("BOOK", "Sách", false, false)));
        assertEquals("BOOK", service.validateBookingGoods(List.of(" book ", "", "BOOK"), null, unit("NORMAL")));
    }

    @Test void coldGoodsCannotBeBookedIntoNormalUnit() {
        when(categories.findByStatusOrderBySortOrderAscIdAsc("ACTIVE")).thenReturn(List.of(category("FOOD", "Thực phẩm", true, false)));
        ReservationException ex = assertThrows(ReservationException.class,
                () -> service.validateBookingGoods(List.of("FOOD"), null, unit("NORMAL")));
        assertEquals("GOODS_REQUIRES_COLD_STORAGE", ex.getCode());
    }

    @ParameterizedTest @ValueSource(strings = {"COLD", "FROZEN"})
    void coldGoodsAreAllowedInColdAndFrozenUnit(String temperature) {
        when(categories.findByStatusOrderBySortOrderAscIdAsc("ACTIVE")).thenReturn(List.of(category("FOOD", "Thực phẩm", true, false)));
        assertEquals("FOOD", service.validateBookingGoods(List.of("food"), null, unit(temperature)));
    }

    @ParameterizedTest @ValueSource(strings = {"", " ", "a", "ab"})
    void requiredDescriptionRejectsShortText(String note) {
        when(categories.findByStatusOrderBySortOrderAscIdAsc("ACTIVE")).thenReturn(List.of(category("OTHER", "Khác", false, true)));
        assertEquals("GOODS_DESCRIPTION_REQUIRED", assertThrows(ReservationException.class,
                () -> service.validateBookingGoods(List.of("OTHER"), note, unit("NORMAL"))).getCode());
    }

    @Test void requiredDescriptionIsTrimmedBeforeValidation() {
        when(categories.findByStatusOrderBySortOrderAscIdAsc("ACTIVE")).thenReturn(List.of(category("OTHER", "Khác", false, true)));
        assertEquals("OTHER", service.validateBookingGoods(List.of("OTHER"), "  đồ gia dụng  ", unit("NORMAL")));
    }

    @Test void unknownOrInactiveCodeIsRejected() {
        when(categories.findByStatusOrderBySortOrderAscIdAsc("ACTIVE")).thenReturn(List.of(category("BOOK", "Sách", false, false)));
        assertEquals("INVALID_GOODS_CATEGORY", assertThrows(ReservationException.class,
                () -> service.validateBookingGoods(List.of("OLD"), null, unit("NORMAL"))).getCode());
    }

    @Test void noGoodsCodeNeverFallsBackToAllCategories() {
        assertEquals("GOODS_CATEGORY_REQUIRED", assertThrows(ReservationException.class,
                () -> service.validateBookingGoods(Arrays.asList(" ", null), null, unit("NORMAL"))).getCode());
        verifyNoInteractions(categories);
    }

    @Test void categoryLimitIsEnforcedBeforeRepositoryLookup() {
        assertEquals("INVALID_INPUT", assertThrows(ReservationException.class,
                () -> service.validateBookingGoods(List.of("A1","A2","A3","A4","A5","A6","A7","A8"), null, unit("NORMAL"))).getCode());
        verifyNoInteractions(categories);
    }

    @Test void legacyNullUnitUsesNormalTemperatureAndProtectsColdGoods() {
        when(categories.findByStatusOrderBySortOrderAscIdAsc("ACTIVE")).thenReturn(List.of(category("FOOD", "Thực phẩm", true, false)));
        assertEquals("GOODS_REQUIRES_COLD_STORAGE", assertThrows(ReservationException.class,
                () -> service.validateBookingGoods(List.of("FOOD"), null, null)).getCode());
    }

    @Test void labelsKeepUnknownLegacyCodeVisible() {
        when(categories.findAll()).thenReturn(List.of(category("BOOK", "Sách", false, false)));
        assertEquals(List.of("Sách", "DELETED"), service.goodsLabels(" BOOK, DELETED "));
    }

    @Test void blankLabelsDoNotQueryRepository() {
        assertTrue(service.goodsLabels("  ").isEmpty());
        verifyNoInteractions(categories);
    }

    @Test void createCategoryTrimsNormalizesAndAudits() {
        GoodsCategory input = category(" food_box ", "  Thực phẩm đóng gói  ", false, false);
        when(categories.existsByCode("FOOD_BOX")).thenReturn(false);
        when(categories.save(any())).thenAnswer(i -> i.getArgument(0));
        GoodsCategory result = service.saveGoodsCategory(null, input, 9);
        assertAll(() -> assertEquals("FOOD_BOX", result.getCode()), () -> assertEquals("Thực phẩm đóng gói", result.getName()));
        verify(activity).log(eq(9), contains("GOODS_CATEGORY_CREATE"), eq("goods_categories"), any());
    }

    @ParameterizedTest @ValueSource(strings = {"", "a", "1FOOD", "FOOD-1", "FOOD SPACE"})
    void createCategoryRejectsInvalidCode(String code) {
        GoodsCategory input = category(code, "Tên hợp lệ", false, false);
        assertEquals("INVALID_INPUT", assertThrows(ReservationException.class, () -> service.saveGoodsCategory(null, input, 9)).getCode());
        verifyNoInteractions(categories, activity);
    }
}
