package com.queenkho.api.service;

import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
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
 *  - Gửi thật khi queenkho.mail.enabled=true (mặc định) VÀ đã có spring.mail.username (MAIL_USERNAME).
 *    Thiếu một trong hai → chỉ in nội dung ra console, máy chưa cấu hình SMTP vẫn chạy bình thường.
 *  - Không bao giờ gửi mã PIN / mật khẩu qua email.
 */
@Service
public class EmailService {

    private final ObjectProvider<JavaMailSender> mailSender;
    private final boolean enabled;
    private final String from;
    private final String frontendUrl;
    // MAIL_REDIRECT_TO (06/11/2026): môi trường dev / demo — mọi email dồn về 1 hộp thư, tiêu đề ghi người nhận gốc.
    // Tài khoản seed khachhang1..5@gmail.com là địa chỉ Gmail thật của người khác → không được gửi thẳng khi test.
    private final String redirectTo;

    public EmailService(ObjectProvider<JavaMailSender> mailSender, boolean enabled, String smtpUsername,
                        String from, String frontendUrl) {
        this(mailSender, enabled, smtpUsername, from, frontendUrl, "");
    }

    @Autowired
    public EmailService(ObjectProvider<JavaMailSender> mailSender,
                        @Value("${queenkho.mail.enabled:true}") boolean enabled,
                        @Value("${spring.mail.username:}") String smtpUsername,
                        @Value("${queenkho.mail.from:no-reply@queenkho.local}") String from,
                        @Value("${vnpay.frontend-url:http://localhost:5173}") String frontendUrl,
                        @Value("${queenkho.mail.redirect-to:}") String redirectTo) {
        this.mailSender = mailSender;
        this.enabled = enabled && smtpUsername != null && !smtpUsername.isBlank();
        // Gmail chỉ cho gửi bằng chính tài khoản đăng nhập → dùng MAIL_USERNAME làm From khi chưa đặt MAIL_FROM riêng
        this.from = from.contains("no-reply@queenkho.local") && this.enabled ? "QueenKho <" + smtpUsername + ">" : from;
        this.frontendUrl = frontendUrl;
        this.redirectTo = redirectTo != null ? redirectTo.trim() : "";
        System.out.println(this.enabled
                ? "[Email] Gửi email thật qua SMTP, tài khoản " + smtpUsername
                    + (this.redirectTo.isEmpty() ? "" : " — MAIL_REDIRECT_TO: mọi email chuyển tới " + this.redirectTo)
                : "[Email] Chưa gửi thật (thiếu MAIL_USERNAME/MAIL_PASSWORD hoặc MAIL_ENABLED=false) — chỉ in nội dung ra console");
    }

    /** Người nhận thật sự: hộp thư MAIL_REDIRECT_TO nếu có đặt, ngược lại là email của khách */
    String recipientFor(CustomerEmailEvent event) {
        return redirectTo.isEmpty() ? event.to() : redirectTo;
    }

    String subjectFor(CustomerEmailEvent event) {
        return "[QueenKho] " + (redirectTo.isEmpty() ? "" : "[→ " + event.to() + "] ") + event.subject();
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onCustomerEmail(CustomerEmailEvent event) {
        send(event);
    }

    public void send(CustomerEmailEvent event) {
        if (event == null || event.to() == null || event.to().isBlank()) return;
        String subject = subjectFor(event);
        String to = recipientFor(event);
        JavaMailSender sender = mailSender.getIfAvailable();
        if (!enabled || sender == null) {
            System.out.println("[Email - chưa bật gửi thật] tới " + to + " | " + subject + " | " + event.message());
            return;
        }
        try {
            MimeMessage mime = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, false, "UTF-8");
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(buildHtml(event), true);
            sender.send(mime);
            System.out.println("[Email] Đã gửi tới " + to + ": " + subject);
        } catch (Exception e) {
            // Lỗi SMTP không được làm hỏng nghiệp vụ — thông báo trong chuông vẫn còn
            System.err.println("[Email] ⚠️ Gửi tới " + to + " thất bại: " + e.getMessage());
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
