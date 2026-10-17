package com.queenkho.api.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

// UC-24: thông tin sự cố hư hỏng trả về trong chi tiết task check-out
@Getter
@Builder
public class DamageCaseResponse {
    private Integer id;
    private String title;
    private String description;
    private BigDecimal estimatedCost;
    private List<String> evidenceImages;
    private LocalDateTime createdAt;
}
