package com.queenkho.api.service;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.security.SecureRandom;

// 🔸 BR-128: đối tác bảo hiểm mô phỏng — không gọi mạng, sinh mã hồ sơ QKINS-xxxxxx và trả kết quả ngay
@Component
public class MockInsuranceProviderClient implements InsuranceProviderClient {

    private static final SecureRandom RANDOM = new SecureRandom();

    @Override
    public InsuranceResult submitClaim(String claimCode, String plan, BigDecimal amount, String description) {
        String ref = "QKINS-" + (100000 + RANDOM.nextInt(900000));
        return new InsuranceResult(ref, "SUBMITTED", amount,
                "Đã tiếp nhận hồ sơ " + claimCode + " (gói " + plan + "), đang thẩm định");
    }

    @Override
    public InsuranceResult settleClaim(String insuranceRef, BigDecimal approvedAmount) {
        return new InsuranceResult(insuranceRef, "PAID", approvedAmount,
                "Đã duyệt và chuyển " + approvedAmount.toPlainString() + "đ cho cơ sở");
    }
}
