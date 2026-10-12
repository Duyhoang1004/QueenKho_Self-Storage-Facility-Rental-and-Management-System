package com.queenkho.api.dto;

import lombok.Data;

@Data
public class NoShowRequest {
    private String reason;
    private String note;
    private Integer staffId;

}
