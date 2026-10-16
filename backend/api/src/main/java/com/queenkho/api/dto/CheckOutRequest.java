package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckOutRequest {
    private Boolean identityVerified;
    private Boolean unitEmpty;
    private Boolean unitClean;
    private Boolean lockIntact;
    private Boolean customerSignatureConfirmed;
    private BigDecimal damageFee;
    private String notes;
    private String evidenceImageUrl;
}
