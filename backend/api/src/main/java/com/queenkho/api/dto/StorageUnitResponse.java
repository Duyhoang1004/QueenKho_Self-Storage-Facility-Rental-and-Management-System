package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class StorageUnitResponse {
    private String id;
    private String unitTypeName;
    private BigDecimal areaSqm;
    private String floor;
    private String zone;
    private String roomNumber;
    private String status;
    // D-18: ô rảnh tới ngày này thì có khách khác đã đặt (null = chưa ai đặt sau) — modal gán / chuyển ô hiện "Trống đến dd/MM"
    private LocalDate freeUntil;
    private String nextContractCode;

    public StorageUnitResponse(String id, String unitTypeName, BigDecimal areaSqm, String floor, String zone,
                               String roomNumber, String status) {
        this(id, unitTypeName, areaSqm, floor, zone, roomNumber, status, null, null);
    }
}
