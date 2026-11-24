package com.queenkho.api.service;

import com.queenkho.api.entity.CentralWarehouse;
import com.queenkho.api.entity.Facility;
import com.queenkho.api.exception.ReservationException;
import com.queenkho.api.repository.CentralWarehouseRepository;
import com.queenkho.api.repository.FacilityRepository;
import com.queenkho.api.repository.GoodsCategoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

// BR-134a (23/11/2026): mỗi thành phố một kho tổng, cơ sở dùng kho tổng cùng thành phố
@ExtendWith(MockitoExtension.class)
class CentralWarehouseByCityTest {
    @Mock GoodsCategoryRepository categories;
    @Mock CentralWarehouseRepository warehouses;
    @Mock ActivityLogService activity;
    @Mock FacilityRepository facilities;
    OperationsCatalogService service;

    @BeforeEach void setup() { service = new OperationsCatalogService(categories, warehouses, activity, facilities); }

    private static CentralWarehouse warehouse(int id, String name, String city) {
        CentralWarehouse w = new CentralWarehouse();
        w.setId(id);
        w.setName(name);
        w.setAddress("addr " + id);
        w.setCity(city);
        return w;
    }

    private static Facility facility(int id, String name, String city) {
        return Facility.builder().id(id).code("F" + id).name(name).city(city).district("d").address("a").status("ACTIVE").build();
    }

    @Test void facilityGetsActiveWarehouseOfSameCity() {
        when(facilities.findById(5)).thenReturn(Optional.of(facility(5, "QueenKho Cầu Giấy", "Hà Nội")));
        when(warehouses.findByStatusOrderByIdAsc("ACTIVE")).thenReturn(List.of(
                warehouse(1, "Kho tổng HCM", "TP.HCM"), warehouse(6, "Kho tổng Hà Nội", "Hà Nội")));
        Map<String, Object> body = service.warehouseForFacility(5);
        assertEquals("Hà Nội", body.get("facilityCity"));
        assertEquals(6, ((CentralWarehouse) body.get("warehouse")).getId());
    }

    @Test void cityMatchIgnoresCaseSpacesAndDots() {
        when(warehouses.findByStatusOrderByIdAsc("ACTIVE")).thenReturn(List.of(warehouse(1, "Kho tổng HCM", "TP.HCM")));
        assertEquals(1, service.findWarehouseForCity(" tp. hcm ").orElseThrow().getId());
    }

    @Test void noWarehouseInCityReturnsNullWarehouse() {
        when(facilities.findById(5)).thenReturn(Optional.of(facility(5, "QueenKho Cầu Giấy", "Hà Nội")));
        when(warehouses.findByStatusOrderByIdAsc("ACTIVE")).thenReturn(List.of(warehouse(1, "Kho tổng HCM", "TP.HCM")));
        assertNull(service.warehouseForFacility(5).get("warehouse"));
    }

    @Test void saveWarehouseUsesFacilitySpellingOfCity() {
        when(facilities.findAllByOrderByIdAsc()).thenReturn(List.of(facility(1, "TB", "TP.HCM"), facility(5, "CG", "Hà Nội")));
        when(warehouses.save(any())).thenAnswer(i -> i.getArgument(0));
        CentralWarehouse input = warehouse(0, "Kho tổng HCM 2", "tp. hcm");
        assertEquals("TP.HCM", service.saveWarehouse(null, input, 9).getCity());
    }

    @Test void saveWarehouseRejectsMissingOrUnknownCity() {
        assertEquals("INVALID_INPUT", assertThrows(ReservationException.class,
                () -> service.saveWarehouse(null, warehouse(0, "Kho", " "), 9)).getCode());
        when(facilities.findAllByOrderByIdAsc()).thenReturn(List.of(facility(1, "TB", "TP.HCM")));
        assertEquals("INVALID_INPUT", assertThrows(ReservationException.class,
                () -> service.saveWarehouse(null, warehouse(0, "Kho", "Đà Nẵng"), 9)).getCode());
        verify(warehouses, never()).save(any());
    }
}
