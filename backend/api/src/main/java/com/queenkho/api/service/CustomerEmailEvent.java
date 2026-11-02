package com.queenkho.api.service;

// BR-117: sự kiện "gửi email cho khách" — NotificationService.notifyCustomer phát, EmailService gửi sau khi commit
public record CustomerEmailEvent(String to, String fullName, String subject, String message, String targetUrl) {
}
