package com.queenkho.api.service;

import com.queenkho.api.dto.MoneyLine;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * D-22 (20/11/2026): bảng "Bạn đã đóng − Cơ sở giữ lại (+ Bồi thường) = Hoàn" dùng chung cho
 * màn hẹn trả kho (xem trước — UC-22) và bảng quyết toán sau nghiệm thu (PR-O19).
 * Dòng "Đã đóng" khớp màn hợp đồng: cọc + tiền thuê kỳ hiện tại (sau ưu đãi / voucher) + bảo hiểm.
 * Tổng luôn bằng công thức PR-O19: cọc − sự cố − phí trễ (trong phần cọc còn lại) − phí chiếm dụng + hoàn tiền thuê + bồi thường.
 */
public final class RefundBreakdown {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private RefundBreakdown() {
    }

    /**
     * Phần tiền thuê / bảo hiểm của kỳ hiện tại, chốt lúc nghiệm thu (lưu vào checkout_settlements.rent_basis).
     *
     * @param rentPaid    tiền thuê kỳ hiện tại đã đóng, KHÔNG gồm bảo hiểm (đã trừ ưu đãi, voucher)
     * @param insurance   phí bảo hiểm kỳ hiện tại đã đóng
     * @param early       trả trước end_date
     * @param fault       chấm dứt do lỗi cơ sở (BR-127) — hoàn theo ngày, không phí phá HĐ
     * @param usedMonths  số tháng đã dùng (làm tròn lên)
     * @param price       giá niêm yết / tháng
     * @param breakFee    phí phá hợp đồng (0 nếu trả trong tháng cuối — PR-O2a, hoặc lỗi cơ sở)
     * @param daysPast    số ngày quá hạn tại ngày nghiệm thu
     */
    public record RentBasis(BigDecimal rentPaid, BigDecimal insurance, int periodMonths, LocalDate periodStart,
                            boolean early, boolean fault, int usedMonths, BigDecimal price, BigDecimal breakFee,
                            long daysPast) {

        public String toText() {
            return "rentPaid=" + plain(rentPaid) + ";insurance=" + plain(insurance) + ";periodMonths=" + periodMonths
                    + ";periodStart=" + (periodStart != null ? periodStart : "") + ";early=" + early + ";fault=" + fault
                    + ";usedMonths=" + usedMonths + ";price=" + plain(price) + ";breakFee=" + plain(breakFee)
                    + ";daysPast=" + daysPast;
        }

        public static RentBasis parse(String text) {
            if (text == null || text.isBlank()) return null;
            Map<String, String> m = new HashMap<>();
            for (String part : text.split(";")) {
                int i = part.indexOf('=');
                if (i > 0) m.put(part.substring(0, i), part.substring(i + 1));
            }
            try {
                String start = m.getOrDefault("periodStart", "");
                return new RentBasis(dec(m.get("rentPaid")), dec(m.get("insurance")),
                        Integer.parseInt(m.getOrDefault("periodMonths", "1")),
                        start.isBlank() ? null : LocalDate.parse(start),
                        Boolean.parseBoolean(m.get("early")), Boolean.parseBoolean(m.get("fault")),
                        Integer.parseInt(m.getOrDefault("usedMonths", "0")), dec(m.get("price")), dec(m.get("breakFee")),
                        Long.parseLong(m.getOrDefault("daysPast", "0")));
            } catch (RuntimeException e) {
                return null;
            }
        }

        private static String plain(BigDecimal v) {
            return nz(v).setScale(0, RoundingMode.HALF_UP).toPlainString();
        }

        private static BigDecimal dec(String s) {
            return s == null || s.isBlank() ? BigDecimal.ZERO : new BigDecimal(s);
        }
    }

    /** Tổng các dòng theo nhóm + số tiền tất toán (> 0 hoàn khách, < 0 khách trả thêm) */
    public record Totals(BigDecimal paid, BigDecimal kept, BigDecimal added, BigDecimal net) {
    }

    /**
     * @param rentRefund   hoàn tiền thuê (trả sớm / lỗi cơ sở) đã tính theo PR-O2 / BR-127
     * @param lateEffective phí trễ thực trừ (đã chặn trong phần cọc còn lại — PR-Q3)
     */
    public static List<MoneyLine> lines(BigDecimal deposit, RentBasis basis, BigDecimal rentRefund,
                                        BigDecimal damage, BigDecimal lateEffective, BigDecimal overstay,
                                        BigDecimal compensation) {
        List<MoneyLine> lines = new ArrayList<>();
        BigDecimal rentPaid = basis != null ? nz(basis.rentPaid()) : BigDecimal.ZERO;
        BigDecimal insurance = basis != null ? nz(basis.insurance()) : BigDecimal.ZERO;
        BigDecimal refund = nz(rentRefund);

        // ---- Bạn đã đóng ----
        lines.add(new MoneyLine(MoneyLine.PAID, "Tiền cọc", money(deposit), null));
        if (basis != null) {
            String period = basis.periodMonths() + " tháng"
                    + (basis.periodStart() != null ? " từ " + basis.periodStart().format(DATE_FMT) : "");
            lines.add(new MoneyLine(MoneyLine.PAID, "Tiền thuê kỳ hiện tại", money(rentPaid),
                    period + " · đã trừ ưu đãi / voucher"));
            if (insurance.signum() > 0) {
                lines.add(new MoneyLine(MoneyLine.PAID, "Phí bảo hiểm hàng hoá", money(insurance), basis.periodMonths() + " tháng"));
            }
        }

        // ---- Cơ sở giữ lại: tiền thuê / bảo hiểm ----
        if (basis != null) {
            BigDecimal rentKept = rentPaid.subtract(refund).max(BigDecimal.ZERO);
            if (basis.early() && basis.fault()) {
                lines.add(new MoneyLine(MoneyLine.KEPT, "Tiền thuê + bảo hiểm những ngày đã dùng",
                        money(rentPaid.add(insurance).subtract(refund).max(BigDecimal.ZERO)),
                        "Chấm dứt do lỗi cơ sở: không phí phá hợp đồng, hoàn theo số ngày còn lại (BR-127)"));
            } else if (basis.early() && nz(basis.breakFee()).signum() == 0) {
                lines.add(new MoneyLine(MoneyLine.KEPT, "Tiền thuê kỳ hiện tại", money(rentKept),
                        "Trả trong tháng cuối của kỳ: không hoàn tiền thuê, không thu phí phá hợp đồng (PR-O2a)"));
                addInsuranceKept(lines, insurance, true);
            } else if (basis.early()) {
                BigDecimal price = nz(basis.price());
                BigDecimal used = price.multiply(BigDecimal.valueOf(basis.usedMonths()));
                BigDecimal breakFee = nz(basis.breakFee());
                lines.add(new MoneyLine(MoneyLine.KEPT, "Tiền thuê đã dùng", money(used),
                        basis.usedMonths() + " tháng × giá niêm yết " + vnd(price) + " (thu hồi ưu đãi — PR-O2)"));
                lines.add(new MoneyLine(MoneyLine.KEPT, "Phí phá hợp đồng", money(breakFee), "1 tháng giá niêm yết"));
                BigDecimal over = used.add(breakFee).subtract(rentKept);
                if (over.signum() > 0) {
                    lines.add(new MoneyLine(MoneyLine.KEPT, "Giảm: không vượt tiền thuê đã đóng", money(over).negate(),
                            "Phần thiếu không trừ vào cọc"));
                }
                addInsuranceKept(lines, insurance, true);
            } else {
                lines.add(new MoneyLine(MoneyLine.KEPT, "Tiền thuê kỳ hiện tại (đã dùng hết)", money(rentKept), null));
                addInsuranceKept(lines, insurance, false);
            }
        }

        // ---- Cơ sở giữ lại: các khoản phí ----
        long days = basis != null ? basis.daysPast() : 0;
        if (nz(damage).signum() > 0) {
            lines.add(new MoneyLine(MoneyLine.KEPT, "Phí sự cố lỗi khách", money(damage), "Theo biên bản nghiệm thu"));
        }
        if (nz(lateEffective).signum() > 0) {
            lines.add(new MoneyLine(MoneyLine.KEPT, "Phí trễ hạn", money(lateEffective),
                    (days > 0 ? days + " ngày quá hạn · " : "") + "chỉ trừ trong phần cọc còn lại"));
        }
        if (nz(overstay).signum() > 0) {
            lines.add(new MoneyLine(MoneyLine.KEPT, "Phí chiếm dụng ô", money(overstay),
                    days > 0 ? days + " ngày quá hạn" : null));
        }

        // ---- Cơ sở trả thêm ----
        if (basis == null && refund.signum() > 0) {
            // Bảng quyết toán tạo trước D-22 (chưa lưu tiền thuê kỳ hiện tại) — vẫn ra đúng tổng
            lines.add(new MoneyLine(MoneyLine.ADDED, "Hoàn tiền thuê (trả sớm)", money(refund), null));
        }
        if (nz(compensation).signum() > 0) {
            lines.add(new MoneyLine(MoneyLine.ADDED, "Bồi thường hàng hư / mất", money(compensation), "Hồ sơ đã được duyệt"));
        }
        return lines;
    }

    private static void addInsuranceKept(List<MoneyLine> lines, BigDecimal insurance, boolean early) {
        if (insurance.signum() <= 0) return;
        lines.add(new MoneyLine(MoneyLine.KEPT, "Phí bảo hiểm", money(insurance),
                early ? "Không hoàn khi tự trả sớm (BR-125)" : "Kỳ bảo hiểm đã dùng hết"));
    }

    public static Totals totals(List<MoneyLine> lines) {
        BigDecimal paid = BigDecimal.ZERO;
        BigDecimal kept = BigDecimal.ZERO;
        BigDecimal added = BigDecimal.ZERO;
        for (MoneyLine l : lines) {
            switch (l.group()) {
                case MoneyLine.PAID -> paid = paid.add(l.amount());
                case MoneyLine.KEPT -> kept = kept.add(l.amount());
                default -> added = added.add(l.amount());
            }
        }
        return new Totals(paid, kept, added, paid.subtract(kept).add(added));
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private static BigDecimal money(BigDecimal v) {
        return nz(v).setScale(0, RoundingMode.HALF_UP);
    }

    private static String vnd(BigDecimal v) {
        return String.format("%,d", money(v).longValue()).replace(',', '.') + "đ";
    }
}
