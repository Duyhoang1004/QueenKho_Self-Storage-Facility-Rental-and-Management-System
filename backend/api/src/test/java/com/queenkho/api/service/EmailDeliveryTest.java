package com.queenkho.api.service;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;

import java.util.Properties;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EmailDeliveryTest {
    @SuppressWarnings("unchecked")
    final ObjectProvider<JavaMailSender> provider = mock(ObjectProvider.class);
    final JavaMailSender sender = mock(JavaMailSender.class);

    EmailService service(boolean enabled, String username) {
        return new EmailService(provider, enabled, username, "QueenKho <no-reply@queenkho.local>", "https://web.example.test");
    }

    CustomerEmailEvent event(String target) {
        return new CustomerEmailEvent("customer@example.test", "Khách hàng", "Đã nhận cọc", "Đã nhận 1.000.000đ", target);
    }

    @Test void nullEventIsIgnoredWithoutLookingUpSmtp() {
        service(true, "smtp@example.test").send(null);
        verifyNoInteractions(provider, sender);
    }

    @ParameterizedTest @NullAndEmptySource @ValueSource(strings = {" ", "\t"})
    void missingRecipientNeverCallsSmtp(String recipient) {
        service(true, "smtp@example.test").send(new CustomerEmailEvent(recipient, null, "subject", "message", null));
        verifyNoInteractions(provider, sender);
    }

    @Test void explicitDisableWinsEvenWhenSmtpCredentialsExist() {
        when(provider.getIfAvailable()).thenReturn(sender);
        service(false, "smtp@example.test").send(event(null));
        verifyNoInteractions(sender);
    }

    @ParameterizedTest @NullAndEmptySource @ValueSource(strings = {" "})
    void missingSmtpAccountKeepsDevelopmentMachineInLogOnlyMode(String username) {
        when(provider.getIfAvailable()).thenReturn(sender);
        service(true, username).send(event(null));
        verifyNoInteractions(sender);
    }

    @Test void missingMailSenderDoesNotBreakNotificationFlow() {
        assertDoesNotThrow(() -> service(true, "smtp@example.test").send(event(null)));
    }

    @Test void smtpFailureDoesNotPropagateToTheBusinessOperation() {
        when(provider.getIfAvailable()).thenReturn(sender);
        when(sender.createMimeMessage()).thenReturn(new MimeMessage(Session.getInstance(new Properties())));
        doThrow(new MailSendException("unavailable")).when(sender).send(any(MimeMessage.class));
        assertDoesNotThrow(() -> service(true, "smtp@example.test").send(event("/kho-cua-toi")));
        verify(sender).send(any(MimeMessage.class));
    }

    @Test void realMimeMessagePreservesVietnameseAndUsesAuthenticatedDefaultSender() throws Exception {
        var mime = new MimeMessage(Session.getInstance(new Properties()));
        when(provider.getIfAvailable()).thenReturn(sender);
        when(sender.createMimeMessage()).thenReturn(mime);
        service(true, "smtp@example.test").send(event("/kho-cua-toi"));
        mime.saveChanges();
        assertEquals("[QueenKho] Đã nhận cọc", mime.getSubject());
        assertTrue(mime.getFrom()[0].toString().contains("smtp@example.test"));
        assertEquals("customer@example.test", mime.getAllRecipients()[0].toString());
        assertTrue(mime.getContent().toString().contains("1.000.000đ"));
        assertTrue(mime.getContentType().toLowerCase().contains("text/html"));
        verify(sender).send(mime);
    }

    @ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({"/kho-cua-toi,https://web.example.test/kho-cua-toi", "kho-cua-toi,https://web.example.test/kho-cua-toi"})
    void detailLinkPointsAtConfiguredFrontend(String target, String expected) {
        assertTrue(service(false, "").buildHtml(event(target)).contains("href=\"" + expected + "\""));
    }

    @ParameterizedTest @NullAndEmptySource @ValueSource(strings = {" "})
    void missingTargetLinksToHomepage(String target) {
        assertTrue(service(false, "").buildHtml(event(target)).contains("href=\"https://web.example.test\""));
    }

    @Test void customerContentCannotInjectMarkupOrBreakLinkAttribute() {
        var event = new CustomerEmailEvent("customer@example.test", "<img src=x>", "<script>bad()</script>",
                "<b>fake</b> & text", "/detail?x=\" onmouseover=\"bad()");
        String html = service(false, "").buildHtml(event);
        assertFalse(html.contains("<script>"));
        assertFalse(html.contains("<img src=x>"));
        assertTrue(html.contains("&lt;b&gt;fake&lt;/b&gt; &amp; text"));
        assertTrue(html.contains("&quot; onmouseover=&quot;"));
    }

    @Test void unknownCustomerNameUsesNeutralGreeting() {
        String html = service(false, "").buildHtml(new CustomerEmailEvent("a@example.test", null, null, null, null));
        assertTrue(html.contains("Quý khách"));
        assertFalse(html.contains(">null<"));
    }
}
