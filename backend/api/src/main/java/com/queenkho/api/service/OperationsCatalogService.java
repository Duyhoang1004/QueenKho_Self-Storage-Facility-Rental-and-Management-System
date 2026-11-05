package com.queenkho.api.service;

import com.queenkho.api.entity.CentralWarehouse;
import com.queenkho.api.entity.GoodsCategory;
import com.queenkho.api.entity.UnitType;
import com.queenkho.api.exception.ReservationException;
import com.queenkho.api.repository.CentralWarehouseRepository;
import com.queenkho.api.repository.GoodsCategoryRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Họp nhóm 05/11/2026 — 2 danh mục vận hành do BOM quản lý:
 *  - BR-131 loại hàng khách khai báo khi đặt kho (thực phẩm chỉ gửi kho lạnh / kho đông, "Khác" phải mô tả).
 *  - BR-134 kho tổng giữ hàng của khách quá hạn (không bán).
 */
@Service
public class OperationsCatalogService {

    public static final List<String> TEMPERATURE_CLASSES = List.of("NORMAL", "COLD", "FROZEN");
    private static final int MAX_CATEGORIES_PER_BOOKING = 7;

    private final GoodsCategoryRepository goodsCategories;
    private final CentralWarehouseRepository warehouses;
    private final ActivityLogService activityLogService;

    public OperationsCatalogService(GoodsCategoryRepository goodsCategories, CentralWarehouseRepository warehouses,
                                    ActivityLogService activityLogService) {
        this.goodsCategories = goodsCategories;
        this.warehouses = warehouses;
        this.activityLogService = activityLogService;
    }

    // ================== LOẠI HÀNG ==================

    @Transactional(readOnly = true)
    public List<GoodsCategory> listGoodsCategories(boolean activeOnly) {
        return activeOnly ? goodsCategories.findByStatusOrderBySortOrderAscIdAsc("ACTIVE")
                : goodsCategories.findAllByOrderBySortOrderAscIdAsc();
    }

    @Transactional
    public GoodsCategory saveGoodsCategory(Integer id, GoodsCategory input, Integer actorId) {
        if (input == null) throw bad("Thiếu dữ liệu loại hàng");
        String name = input.getName() != null ? input.getName().trim() : "";
        if (name.isEmpty() || name.length() > 100) throw bad("Tên loại hàng bắt buộc, tối đa 100 ký tự");
        if (input.getDescription() != null && input.getDescription().trim().length() > 300) throw bad("Mô tả tối đa 300 ký tự");

        GoodsCategory target;
        if (id == null) {
            String code = input.getCode() != null ? input.getCode().trim().toUpperCase() : "";
            if (!code.matches("[A-Z][A-Z0-9_]{1,29}")) {
                throw bad("Mã loại hàng 2–30 ký tự, chữ in hoa / số / gạch dưới, bắt đầu bằng chữ (vd FOOD)");
            }
            if (goodsCategories.existsByCode(code)) {
                throw new ReservationException(HttpStatus.CONFLICT, "DUPLICATE_CODE", "Mã loại hàng " + code + " đã tồn tại");
            }
            target = new GoodsCategory();
            target.setCode(code);
        } else {
            // Không đổi mã: đơn cũ lưu theo mã
            target = goodsCategories.findById(id)
                    .orElseThrow(() -> new ReservationException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Không tìm thấy loại hàng"));
        }
        target.setName(name);
        target.setDescription(input.getDescription() != null && !input.getDescription().isBlank() ? input.getDescription().trim() : null);
        target.setRequiresColdStorage(Boolean.TRUE.equals(input.getRequiresColdStorage()));
        target.setRequiresNote(Boolean.TRUE.equals(input.getRequiresNote()));
        target.setSortOrder(input.getSortOrder() != null ? input.getSortOrder() : 0);
        GoodsCategory saved = goodsCategories.save(target);
        activityLogService.log(actorId, "[GOODS_CATEGORY_" + (id == null ? "CREATE" : "UPDATE") + "] " + saved.getCode() + " — " + saved.getName(),
                "goods_categories", String.valueOf(saved.getId()));
        return saved;
    }

    @Transactional
    public GoodsCategory setGoodsCategoryStatus(Integer id, String status, Integer actorId) {
        GoodsCategory c = goodsCategories.findById(id)
                .orElseThrow(() -> new ReservationException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Không tìm thấy loại hàng"));
        c.setStatus(normalizeStatus(status));
        activityLogService.log(actorId, "[GOODS_CATEGORY_STATUS] " + c.getCode() + " → " + c.getStatus(),
                "goods_categories", String.valueOf(id));
        return goodsCategories.save(c);
    }

    /**
     * BR-131: kiểm tra loại hàng khách chọn khi đặt kho → trả chuỗi mã đã chuẩn hoá (ngăn bởi dấu phẩy).
     * Bắt buộc ≥ 1 loại đang ACTIVE; loại cần kho lạnh chỉ đặt được loại kho COLD / FROZEN; loại cần mô tả thì mô tả ≥ 3 ký tự.
     */
    @Transactional(readOnly = true)
    public String validateBookingGoods(List<String> codes, String description, UnitType unitType) {
        List<String> picked = codes == null ? List.of() : codes.stream()
                .filter(Objects::nonNull).map(c -> c.trim().toUpperCase()).filter(c -> !c.isEmpty()).distinct().toList();
        if (picked.isEmpty()) {
            throw new ReservationException(HttpStatus.BAD_REQUEST, "GOODS_CATEGORY_REQUIRED", "Vui lòng chọn loại hàng sẽ gửi kho");
        }
        if (picked.size() > MAX_CATEGORIES_PER_BOOKING) throw bad("Chọn tối đa " + MAX_CATEGORIES_PER_BOOKING + " loại hàng");
        Map<String, GoodsCategory> active = listGoodsCategories(true).stream()
                .collect(Collectors.toMap(GoodsCategory::getCode, c -> c));
        String temperature = unitType != null && unitType.getTemperatureClass() != null ? unitType.getTemperatureClass() : "NORMAL";
        String note = description != null ? description.trim() : "";
        if (note.length() > 500) throw bad("Mô tả hàng tối đa 500 ký tự");
        for (String code : picked) {
            GoodsCategory c = active.get(code);
            if (c == null) {
                throw new ReservationException(HttpStatus.BAD_REQUEST, "INVALID_GOODS_CATEGORY", "Loại hàng " + code + " không tồn tại hoặc đã ngừng nhận");
            }
            if (Boolean.TRUE.equals(c.getRequiresColdStorage()) && "NORMAL".equals(temperature)) {
                throw new ReservationException(HttpStatus.BAD_REQUEST, "GOODS_REQUIRES_COLD_STORAGE",
                        "\"" + c.getName() + "\" chỉ gửi được ở kho lạnh hoặc kho đông — vui lòng chọn loại kho khác");
            }
            if (Boolean.TRUE.equals(c.getRequiresNote()) && note.length() < 3) {
                throw new ReservationException(HttpStatus.BAD_REQUEST, "GOODS_DESCRIPTION_REQUIRED",
                        "Chọn \"" + c.getName() + "\" thì cần mô tả rõ loại hàng");
            }
        }
        return String.join(",", picked);
    }

    /** Tên hiển thị của chuỗi mã loại hàng (mã đã bị xoá vẫn hiện mã) */
    @Transactional(readOnly = true)
    public List<String> goodsLabels(String codesCsv) {
        if (codesCsv == null || codesCsv.isBlank()) return List.of();
        Map<String, String> names = goodsCategories.findAll().stream()
                .collect(Collectors.toMap(GoodsCategory::getCode, GoodsCategory::getName, (a, b) -> a));
        return Arrays.stream(codesCsv.split(",")).map(String::trim).filter(s -> !s.isEmpty())
                .map(c -> names.getOrDefault(c, c)).toList();
    }

    // ================== KHO TỔNG ==================

    @Transactional(readOnly = true)
    public List<CentralWarehouse> listWarehouses(boolean activeOnly) {
        return activeOnly ? warehouses.findByStatusOrderByIdAsc("ACTIVE") : warehouses.findAllByOrderByIdAsc();
    }

    @Transactional(readOnly = true)
    public Optional<CentralWarehouse> findWarehouse(Integer id) {
        return id == null ? Optional.empty() : warehouses.findById(id);
    }

    @Transactional
    public CentralWarehouse saveWarehouse(Integer id, CentralWarehouse input, Integer actorId) {
        if (input == null) throw bad("Thiếu dữ liệu kho tổng");
        String name = input.getName() != null ? input.getName().trim() : "";
        String address = input.getAddress() != null ? input.getAddress().trim() : "";
        if (name.isEmpty() || name.length() > 150) throw bad("Tên kho tổng bắt buộc, tối đa 150 ký tự");
        if (address.isEmpty() || address.length() > 300) throw bad("Địa chỉ bắt buộc, tối đa 300 ký tự");
        String hotline = input.getHotline() != null ? input.getHotline().trim() : "";
        if (!hotline.isEmpty() && !hotline.matches("0\\d{8,10}")) throw bad("Hotline phải là số điện thoại bắt đầu bằng 0");
        CentralWarehouse target = id == null ? new CentralWarehouse() : warehouses.findById(id)
                .orElseThrow(() -> new ReservationException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Không tìm thấy kho tổng"));
        target.setName(name);
        target.setAddress(address);
        target.setHotline(hotline.isEmpty() ? null : hotline);
        target.setNote(input.getNote() != null && !input.getNote().isBlank() ? input.getNote().trim() : null);
        CentralWarehouse saved = warehouses.save(target);
        activityLogService.log(actorId, "[CENTRAL_WAREHOUSE_" + (id == null ? "CREATE" : "UPDATE") + "] " + saved.getName(),
                "central_warehouses", String.valueOf(saved.getId()));
        return saved;
    }

    @Transactional
    public CentralWarehouse setWarehouseStatus(Integer id, String status, Integer actorId) {
        CentralWarehouse w = warehouses.findById(id)
                .orElseThrow(() -> new ReservationException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Không tìm thấy kho tổng"));
        String next = normalizeStatus(status);
        if ("INACTIVE".equals(next) && listWarehouses(true).stream().filter(x -> !x.getId().equals(id)).findAny().isEmpty()) {
            throw new ReservationException(HttpStatus.CONFLICT, "LAST_ACTIVE_WAREHOUSE", "Phải còn ít nhất 1 kho tổng đang hoạt động");
        }
        w.setStatus(next);
        activityLogService.log(actorId, "[CENTRAL_WAREHOUSE_STATUS] " + w.getName() + " → " + next,
                "central_warehouses", String.valueOf(id));
        return warehouses.save(w);
    }

    private static String normalizeStatus(String status) {
        String s = status != null ? status.trim().toUpperCase() : "";
        if (!List.of("ACTIVE", "INACTIVE").contains(s)) throw bad("Trạng thái phải là ACTIVE hoặc INACTIVE");
        return s;
    }

    private static ReservationException bad(String message) {
        return new ReservationException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", message);
    }
}
