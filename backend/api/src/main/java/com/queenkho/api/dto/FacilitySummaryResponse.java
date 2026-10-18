package com.queenkho.api.dto;

import lombok.*;

@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class FacilitySummaryResponse {
    private Integer id;
    private String code;
    private String name;
    private String city;
    private String district;
    private String address;
    private String hotline;
    private int totalAvailableUnits;

    public FacilitySummaryResponse(Integer id, String name, String city, String district, String address, String hotline, int totalAvailableUnits) {
        this.id = id;
        this.name = name;
        this.city = city;
        this.district = district;
        this.address = address;
        this.hotline = hotline;
        this.totalAvailableUnits = totalAvailableUnits;
    }
}
