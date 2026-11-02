package com.queenkho.api.service;

import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * BR-117: email cho khách hàng, đi kèm mọi thông báo notifyCustomer (đặt cọc, gán ô, check-in, hẹn trả kho,
 * nhắc gia hạn, quá hạn, hoàn tiền...).
 *  - Gửi SAU KHI transaction commit (nghiệp vụ rollback thì không gửi) và chạy nền (@Async) để không làm chậm API.
 *  - queenkho.mail.enabled=false (mặc định) → chỉ in nội dung ra console, máy chưa cấu hình SMTP vẫn chạy bình thường.
 *  - Không bao giờ gửi mã PIN / mật khẩu qua email.
 */
@Service
public class EmailService {

    private final ObjectProvider<JavaMailSender> mailSender;
    private final boolean enabled;
    private final String from;
    private final String frontendUrl;

    public EmailService(ObjectProvider<JavaMailSender> mailSender,
                        @Value("${queenkho.mail.enabled:false}") boolean enabled,
                        @Value("${queenkho.mail.from:no-reply@queenkho.local}") String from,
                        @Value("${vnpay.frontend-url:http://localhost:5173}") String frontendUrl) {
        this.mailSender = mailSender;
        this.enabled = enabled;
        this.from = from;
        this.frontendUrl = frontendUrl;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onCustomerEmail(CustomerEmailEvent event) {
        send(event);
    }

    public void send(CustomerEmailEvent event) {
        if (event == null || event.to() == null || event.to().isBlank()) return;
        String subject = "[QueenKho] " + event.subject();
        JavaMailSender sender = mailSender.getIfAvailable();
        if (!enabled || sender == null) {
            System.out.println("[Email - chưa bật gửi thật] tới " + event.to() + " | " + subject + " | " + event.message());
            return;
        }
        try {
            MimeMessage mime = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, false, "UTF-8");
            helper.setFrom(from);
            helper.setTo(event.to());
            helper.setSubject(subject);
            helper.setText(buildHtml(event), true);
            sender.send(mime);
            System.out.println("[Email] Đã gửi tới " + event.to() + ": " + subject);
        } catch (Exception e) {
            // Lỗi SMTP không được làm hỏng nghiệp vụ — thông báo trong chuông vẫn còn
            System.err.println("[Email] ⚠️ Gửi tới " + event.to() + " thất bại: " + e.getMessage());
        }
    }

    String buildHtml(CustomerEmailEvent event) {
        String link = event.targetUrl() != null && !event.targetUrl().isBlank()
                ? frontendUrl + (event.targetUrl().startsWith("/") ? "" : "/") + event.targetUrl()
                : frontendUrl;
        String name = event.fullName() != null && !event.fullName().isBlank() ? event.fullName() : "Quý khách";
        return "<div style=\"font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#333\">"
                + "<div style=\"background:#58CC02;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-size:20px;font-weight:bold\">QueenKho</div>"
                + "<div style=\"border:1px solid #e5e5e5;border-top:0;padding:20px;border-radius:0 0 12px 12px\">"
                + "<p>Xin chào <b>" + escape(name) + "</b>,</p>"
                + "<h3 style=\"margin:12px 0 8px\">" + escape(event.subject()) + "</h3>"
                + "<p style=\"line-height:1.6\">" + escape(event.message()) + "</p>"
                + "<p style=\"margin:24px 0\"><a href=\"" + escape(link) + "\" style=\"background:#1CB0F6;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:bold\">Xem chi tiết</a></p>"
                + "<p style=\"font-size:12px;color:#999\">Email tự động từ hệ thống QueenKho, vui lòng không trả lời email này.</p>"
                + "</div></div>";
    }

    private static String escape(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
