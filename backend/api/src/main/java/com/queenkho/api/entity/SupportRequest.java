package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "support_requests")
public class SupportRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "ticket_code", nullable = false, unique = true, length = 50)
    private String ticketCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_id")
    private RentalContract contract;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private User customer;

    @Column(name = "issue_type", nullable = false, length = 50)
    private String issueType;

    @Column(name = "description")
    private String description;

    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private String status = "OPEN"; // OPEN / IN_PROGRESS / RESOLVED / CLOSED

    @Column(name = "resolution_note", length = 1000)
    private String resolutionNote;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
