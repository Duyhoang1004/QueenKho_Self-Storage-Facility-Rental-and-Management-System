package com.queenkho.api.dto;

public record NoShowEligibility(boolean eligible, int failedCount, String reason) {
}
