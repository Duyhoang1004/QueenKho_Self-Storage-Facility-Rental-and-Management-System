package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@AllArgsConstructor
public class CustomerContractResponse {
    private Integer contractId;
    private String contractCode;
    private Integer customerId;
    private String customerFullName;
    private String customerPhone;
    private String storageUnitId;
    private String unitTypeName;
    private BigDecimal areaSqm;
    private String floor;
    private String zone;
    private String roomNumber;
    private String status; // ACTIVE / OVERDUE / TERMINATED / LIQUIDATED
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer billingCycleMonths;
    private BigDecimal depositHeldAmount;
    private String reservationCode;
    private String accessPinCode;
    private String rfidCardCode;
}
