package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "reservations")
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class Reservation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "reservation_code", nullable = false, unique = true)
    private String reservationCode;

    @ManyToOne
    @JoinColumn(name = "customer_id", nullable = false)
    private User customer;

    @ManyToOne
    @JoinColumn(name = "facility_id", nullable = false)
    private Facility facility;

    @ManyToOne
    @JoinColumn(name = "unit_type_id", nullable = false)
    private UnitType unitType;

    @Column(name = "storage_unit_id") // để String, chỉ cần biết null hay không
    private String storageUnitId;

    @Column(nullable = false, length = 30)
    private String status; // PENDING / DEPOSIT_PAID / UNIT_ASSIGNED / CANCELLED / EXPIRED / COMPLETED

    @Column(name = "duration_months", nullable = false)
    private Integer durationMonths;

    @Column(name = "deposit_amount", nullable = false)
    private BigDecimal depositAmount;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "total_deposit_paid")
    private java.math.BigDecimal totalDepositPaid;
    
    @Column(name = "expected_appointment_time")
    private java.time.LocalDateTime expectedAppointmentTime;

    // Flow 4: % ưu đãi tiền thuê chốt theo chính sách lúc tạo đơn (giống deposit_amount — PR-M6).
    // NULL ở đơn rất cũ → PricingService tính lại theo bảng mặc định.
    @Column(name = "rent_discount_percent")
    private Integer rentDiscountPercent;

    // Điều khoản xử lý tài sản khi không trả kho mà khách đã đồng ý lúc đặt kho.
    // NULL = đơn tạo trước khi có điều khoản → khi thanh lý không được bán hàng của khách.
    @Column(name = "terms_version")
    private String termsVersion;

    @Column(name = "terms_accepted_at")
    private java.time.LocalDateTime termsAcceptedAt;

    // BR-25: voucher chốt lúc tạo đơn. voucherDiscount NULL = đơn cũ (trước khi có bảng vouchers) → coi như NEWKHO 100.000đ
    @Column(name = "voucher_id")
    private Integer voucherId;

    @Column(name = "voucher_code", length = 30)
    private String voucherCode;

    @Column(name = "voucher_discount", precision = 12, scale = 2)
    private java.math.BigDecimal voucherDiscount;

    // BR-125: gói bảo hiểm hàng hoá khách chọn khi đặt kho (BASIC / ADVANCED / PREMIUM) + phí / tháng chốt lúc đặt
    @Column(name = "insurance_plan", nullable = false, length = 20)
    private String insurancePlan = "BASIC";

    @Column(name = "insurance_premium_monthly", nullable = false, precision = 15, scale = 2)
    private java.math.BigDecimal insurancePremiumMonthly = java.math.BigDecimal.ZERO;

    // Giá trị hàng khách khai báo — căn cứ trần bồi thường (NULL = không khai báo → trần thấp)
    @Column(name = "declared_goods_value", precision = 15, scale = 2)
    private java.math.BigDecimal declaredGoodsValue;

    // BR-131 (05/11/2026): loại hàng khách khai báo (mã goods_categories, ngăn bởi dấu phẩy) + mô tả thêm
    @Column(name = "goods_category_codes", length = 300)
    private String goodsCategoryCodes;

    @Column(name = "goods_description", length = 500)
    private String goodsDescription;
}