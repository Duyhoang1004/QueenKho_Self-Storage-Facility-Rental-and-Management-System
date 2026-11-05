package com.queenkho.api.service;

import com.queenkho.api.dto.VoucherQuoteResponse;
import com.queenkho.api.dto.VoucherRequest;
import com.queenkho.api.dto.VoucherResponse;
import com.queenkho.api.entity.UnitType;
import com.queenkho.api.entity.Voucher;
import com.queenkho.api.exception.ReservationException;
import com.queenkho.api.repository.UnitTypeRepository;
import com.queenkho.api.repository.VoucherRepository;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * BR-25 (sửa 02/11/2026): voucher đặt kho trực tuyến do BOM quản lý.
 *  - Chỉ áp lúc đặt kho (không áp cho gia hạn / trả nợ), 1 đơn tối đa 1 mã, không cộng dồn.
 *  - Khách không nhập mã → tự áp mã mặc định (NEWKHO) nếu còn hiệu lực.
 *  - Điều kiện: đang ACTIVE, trong thời gian hiệu lực, đúng cơ sở, gói thuê ≥ số tháng tối thiểu,
 *    còn lượt (tổng + mỗi khách). Lượt "đang giữ" = đơn PENDING trong 15 phút giữ chỗ (tránh 2 khách cùng dùng lượt cuối).
 *  - Mức giảm: FIXED = số tiền; PERCENT = % tiền thuê (sau ưu đãi gói), có trần. Không bao giờ giảm vào tiền cọc.
 *  - Số tiền giảm chốt trên đơn lúc tạo; used_count cộng khi VNPAY báo cọc thành công; huỷ đơn KHÔNG trả lại lượt.
 */
@Service
public class VoucherService {

    private static final String ACTIVE = "ACTIVE";
    private static final List<Integer> VALID_MONTHS = List.of(1, 3, 6, 12);

    private final VoucherRepository voucherRepository;
    private final UnitTypeRepository unitTypeRepository;
    private final PricingService pricingService;
    private final JdbcTemplate jdbcTemplate;

    public VoucherService(VoucherRepository voucherRepository, UnitTypeRepository unitTypeRepository,
                          PricingService pricingService, JdbcTemplate jdbcTemplate) {
        this.voucherRepository = voucherRepository;
        this.unitTypeRepository = unitTypeRepository;
        this.pricingService = pricingService;
        this.jdbcTemplate = jdbcTemplate;
    }

    // ---------- Khách: kiểm tra mã cho 1 đơn sắp đặt ----------
    @Transactional(readOnly = true)
    public VoucherQuoteResponse preview(String code, Integer customerId, Integer facilityId, Integer unitTypeId, Integer months) {
        if (facilityId == null || unitTypeId == null || months == null || months <= 0) {
            throw invalid("INVALID_INPUT", "Thiếu cơ sở, loại kho hoặc số tháng thuê");
        }
        UnitType unitType = unitTypeRepository.findById(unitTypeId)
                .orElseThrow(() -> invalid("INVALID_INPUT", "Loại kho không tồn tại"));
        int percent = pricingService.bookingDiscountPercent(pricingService.activePolicy(facilityId), months);
        BigDecimal rent = PricingService.discountedRent(unitType.getBasePriceMonthly(), months, percent);
        Map<String, Object> quote = quote(code, customerId, facilityId, unitTypeId, months, rent);
        return new VoucherQuoteResponse((Integer) quote.get("voucherId"), (String) quote.get("code"),
                (String) quote.get("name"), (BigDecimal) quote.get("discount"), rent);
    }

    /**
     * Mức giảm cho 1 đơn. code trống → mã mặc định (không hợp lệ thì trả giảm 0, không báo lỗi);
     * code do khách nhập mà không hợp lệ → 400 VOUCHER_INVALID kèm lý do.
     * Trả map: voucherId, code, name, discount.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> quote(String rawCode, Integer customerId, Integer facilityId, Integer unitTypeId, int months,
                                     BigDecimal rentAmount) {
        String code = rawCode == null ? "" : rawCode.trim().toUpperCase();
        Voucher voucher;
        if (code.isEmpty()) {
            voucher = voucherRepository.findFirstByIsDefaultTrueAndStatusOrderByIdAsc(ACTIVE).orElse(null);
            if (voucher != null && validationError(voucher, customerId, facilityId, unitTypeId, months) != null) {
                voucher = null;
            }
        } else {
            voucher = voucherRepository.findByCode(code)
                    .orElseThrow(() -> invalid("VOUCHER_INVALID", "Mã voucher không tồn tại"));
            String error = validationError(voucher, customerId, facilityId, unitTypeId, months);
            if (error != null) {
                throw invalid("VOUCHER_INVALID", error);
            }
        }
        Map<String, Object> result = new HashMap<>();
        result.put("voucherId", voucher != null ? voucher.getId() : null);
        result.put("code", voucher != null ? voucher.getCode() : null);
        result.put("name", voucher != null ? voucher.getName() : null);
        result.put("discount", voucher != null ? discountOf(voucher, rentAmount) : BigDecimal.ZERO);
        return result;
    }

    String validationError(Voucher v, Integer customerId, Integer facilityId, Integer unitTypeId, int months) {
        LocalDateTime now = LocalDateTime.now();
        if (!ACTIVE.equals(v.getStatus())) return "Mã voucher đang tạm dừng";
        if (v.getStartAt() != null && now.isBefore(v.getStartAt())) return "Mã voucher chưa đến thời gian áp dụng";
        if (v.getEndAt() != null && now.isAfter(v.getEndAt())) return "Mã voucher đã hết hạn";
        if (v.getFacilityId() != null && !v.getFacilityId().equals(facilityId)) return "Mã voucher không áp dụng cho cơ sở này";
        // 05/11/2026: voucher gắn 1 loại kho thì chỉ áp cho loại kho đó
        if (v.getUnitTypeId() != null && !v.getUnitTypeId().equals(unitTypeId)) return "Mã voucher không áp dụng cho loại kho này";
        if (v.getMinMonths() != null && months < v.getMinMonths()) {
            return "Mã voucher chỉ áp dụng cho gói thuê từ " + v.getMinMonths() + " tháng";
        }
        if (v.getUsageLimit() != null) {
            Integer holding = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM reservations WHERE voucher_id = ? AND status = 'PENDING' " +
                            "AND created_at > DATEADD(MINUTE, -15, SYSDATETIME())", Integer.class, v.getId());
            if (v.getUsedCount() + (holding != null ? holding : 0) >= v.getUsageLimit()) return "Mã voucher đã hết lượt sử dụng";
        }
        if (v.getPerUserLimit() != null && customerId != null) {
            Integer mine = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM reservations r WHERE r.voucher_id = ? AND r.customer_id = ? AND (" +
                            " EXISTS (SELECT 1 FROM payment_transactions p WHERE p.reservation_id = r.id " +
                            "         AND p.payment_type = 'DEPOSIT' AND p.status = 'SUCCESS') " +
                            " OR (r.status = 'PENDING' AND r.created_at > DATEADD(MINUTE, -15, SYSDATETIME())))",
                    Integer.class, v.getId(), customerId);
            if ((mine != null ? mine : 0) >= v.getPerUserLimit()) return "Bạn đã dùng hết lượt của mã voucher này";
        }
        return null;
    }

    static BigDecimal discountOf(Voucher v, BigDecimal rentAmount) {
        BigDecimal rent = rentAmount != null ? rentAmount : BigDecimal.ZERO;
        BigDecimal discount = "PERCENT".equals(v.getDiscountType())
                ? rent.multiply(v.getDiscountValue()).divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP)
                : v.getDiscountValue();
        if ("PERCENT".equals(v.getDiscountType()) && v.getMaxDiscount() != null) {
            discount = discount.min(v.getMaxDiscount());
        }
        return discount.min(rent).max(BigDecimal.ZERO).setScale(0, RoundingMode.HALF_UP);
    }

    // VNPAY báo cọc thành công → cộng 1 lượt cho voucher của đơn (nếu có)
    @Transactional
    public void markUsed(Integer reservationId) {
        jdbcTemplate.update("UPDATE vouchers SET used_count = used_count + 1 " +
                "WHERE id = (SELECT voucher_id FROM reservations WHERE id = ?)", reservationId);
    }

    // ---------- BOM: quản lý voucher ----------
    @Transactional(readOnly = true)
    public List<VoucherResponse> list() {
        Map<Integer, String> facilityNames = new HashMap<>();
        jdbcTemplate.query("SELECT id, name FROM facilities", rs -> {
            facilityNames.put(rs.getInt("id"), rs.getString("name"));
        });
        Map<Integer, String> unitTypeNames = new HashMap<>();
        unitTypeRepository.findAll().forEach(t -> unitTypeNames.put(t.getId(), t.getName()));
        return voucherRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(v -> VoucherResponse.of(v, v.getFacilityId() != null ? facilityNames.get(v.getFacilityId()) : null,
                        v.getUnitTypeId() != null ? unitTypeNames.get(v.getUnitTypeId()) : null))
                .toList();
    }

    @Transactional
    public VoucherResponse create(VoucherRequest request, Integer actorId) {
        Voucher v = new Voucher();
        apply(v, request, true);
        v.setCreatedBy(actorId);
        v.setCreatedAt(LocalDateTime.now());
        v.setUsedCount(0);
        v.setStatus(ACTIVE);
        if (Boolean.TRUE.equals(v.getIsDefault())) clearOtherDefaults(null);
        Voucher saved = voucherRepository.save(v);
        return VoucherResponse.of(saved, null);
    }

    @Transactional
    public VoucherResponse update(Integer id, VoucherRequest request) {
        Voucher v = voucherRepository.findById(id)
                .orElseThrow(() -> new ReservationException(HttpStatus.NOT_FOUND, "VOUCHER_NOT_FOUND", "Không tìm thấy voucher"));
        apply(v, request, v.getUsedCount() == null || v.getUsedCount() == 0);
        if (Boolean.TRUE.equals(v.getIsDefault())) clearOtherDefaults(v.getId());
        return VoucherResponse.of(voucherRepository.save(v), null);
    }

    @Transactional
    public VoucherResponse setStatus(Integer id, String status) {
        String s = status != null ? status.trim().toUpperCase() : "";
        if (!ACTIVE.equals(s) && !"INACTIVE".equals(s)) {
            throw invalid("INVALID_INPUT", "Trạng thái chỉ nhận ACTIVE hoặc INACTIVE");
        }
        Voucher v = voucherRepository.findById(id)
                .orElseThrow(() -> new ReservationException(HttpStatus.NOT_FOUND, "VOUCHER_NOT_FOUND", "Không tìm thấy voucher"));
        v.setStatus(s);
        return VoucherResponse.of(voucherRepository.save(v), null);
    }

    private void apply(Voucher v, VoucherRequest r, boolean codeEditable) {
        if (r == null) throw invalid("INVALID_INPUT", "Thiếu thông tin voucher");
        String code = r.getCode() != null ? r.getCode().trim().toUpperCase() : "";
        if (!code.matches("[A-Z0-9]{3,30}")) {
            throw invalid("INVALID_INPUT", "Mã voucher gồm 3–30 ký tự chữ (không dấu) hoặc số, không khoảng trắng");
        }
        if (!code.equals(v.getCode())) {
            if (v.getCode() != null && !codeEditable) {
                throw invalid("VOUCHER_IN_USE", "Voucher đã có khách dùng, không đổi được mã (tạo mã mới thay thế)");
            }
            if (voucherRepository.existsByCode(code)) throw invalid("DUPLICATE_CODE", "Mã voucher " + code + " đã tồn tại");
            v.setCode(code);
        }
        String name = r.getName() != null ? r.getName().trim() : "";
        if (name.isEmpty() || name.length() > 150) throw invalid("INVALID_INPUT", "Tên voucher bắt buộc, tối đa 150 ký tự");
        v.setName(name);

        String type = r.getDiscountType() != null ? r.getDiscountType().trim().toUpperCase() : "";
        if (!"FIXED".equals(type) && !"PERCENT".equals(type)) throw invalid("INVALID_INPUT", "Loại giảm chỉ nhận FIXED hoặc PERCENT");
        BigDecimal value = r.getDiscountValue();
        if (value == null || value.signum() <= 0) throw invalid("INVALID_INPUT", "Mức giảm phải lớn hơn 0");
        if ("PERCENT".equals(type) && value.compareTo(BigDecimal.valueOf(100)) > 0) {
            throw invalid("INVALID_INPUT", "Giảm theo % tối đa 100%");
        }
        v.setDiscountType(type);
        v.setDiscountValue(value);
        if (r.getMaxDiscount() != null && r.getMaxDiscount().signum() <= 0) throw invalid("INVALID_INPUT", "Mức giảm tối đa phải lớn hơn 0");
        v.setMaxDiscount("PERCENT".equals(type) ? r.getMaxDiscount() : null);

        int minMonths = r.getMinMonths() != null ? r.getMinMonths() : 1;
        if (!VALID_MONTHS.contains(minMonths)) throw invalid("INVALID_INPUT", "Gói tối thiểu chỉ nhận 1, 3, 6 hoặc 12 tháng");
        v.setMinMonths(minMonths);
        if (r.getFacilityId() != null) {
            Integer exists = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM facilities WHERE id = ?", Integer.class, r.getFacilityId());
            if (exists == null || exists == 0) throw invalid("INVALID_INPUT", "Cơ sở không tồn tại");
        }
        v.setFacilityId(r.getFacilityId());
        if (r.getUnitTypeId() != null && unitTypeRepository.findById(r.getUnitTypeId()).isEmpty()) {
            throw invalid("INVALID_INPUT", "Loại kho không tồn tại");
        }
        v.setUnitTypeId(r.getUnitTypeId());

        LocalDateTime start = r.getStartAt() != null ? r.getStartAt() : (v.getStartAt() != null ? v.getStartAt() : LocalDateTime.now());
        if (r.getEndAt() != null && !r.getEndAt().isAfter(start)) throw invalid("INVALID_INPUT", "Ngày kết thúc phải sau ngày bắt đầu");
        v.setStartAt(start);
        v.setEndAt(r.getEndAt());

        if (r.getUsageLimit() != null && r.getUsageLimit() < 1) throw invalid("INVALID_INPUT", "Tổng lượt dùng tối thiểu 1");
        if (r.getUsageLimit() != null && v.getUsedCount() != null && r.getUsageLimit() < v.getUsedCount()) {
            throw invalid("INVALID_INPUT", "Tổng lượt không được nhỏ hơn số lượt đã dùng (" + v.getUsedCount() + ")");
        }
        if (r.getPerUserLimit() != null && r.getPerUserLimit() < 1) throw invalid("INVALID_INPUT", "Lượt mỗi khách tối thiểu 1");
        v.setUsageLimit(r.getUsageLimit());
        v.setPerUserLimit(r.getPerUserLimit());
        v.setIsDefault(Boolean.TRUE.equals(r.getIsDefault()));
    }

    // Chỉ 1 mã mặc định tại 1 thời điểm
    private void clearOtherDefaults(Integer keepId) {
        jdbcTemplate.update("UPDATE vouchers SET is_default = 0 WHERE is_default = 1 AND id <> ?", keepId != null ? keepId : -1);
    }

    private static ReservationException invalid(String code, String message) {
        return new ReservationException(HttpStatus.BAD_REQUEST, code, message);
    }
}
