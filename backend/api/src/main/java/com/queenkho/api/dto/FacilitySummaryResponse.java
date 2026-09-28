package com.queenkho.api.dto;

import lombok.*;

@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class FacilitySummaryResponse {
    private Integer id;
    private String name;
    private String city;
    private String district;
    private String address;
    private String hotline;
    private int totalAvailableUnits;
}
