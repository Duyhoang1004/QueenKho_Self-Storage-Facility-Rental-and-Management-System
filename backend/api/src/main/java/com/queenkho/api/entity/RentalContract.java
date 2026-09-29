package com.queenkho.api.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "rental_contracts")
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class RentalContract {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "contract_code", nullable = false, unique = true, length = 50)
    private String contractCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reservation_id", nullable = false)
    private Reservation reservation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private User customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "storage_unit_id", nullable = false)
    private StorageUnit storageUnit;

    @Column(name = "rental_policy_id", nullable = false)
    private Integer rentalPolicyId; // Map as simple Integer since RentalPolicy entity is not yet created

    @Column(nullable = false, length = 30)
    private String status = "ACTIVE"; // ACTIVE / OVERDUE / TERMINATED / LIQUIDATED

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "billing_cycle_months", nullable = false)
    private Integer billingCycleMonths = 1;

    @Column(name = "deposit_held_amount", nullable = false)
    private BigDecimal depositHeldAmount = BigDecimal.ZERO;

    @Column(name = "access_pin_code", length = 20)
    private String accessPinCode;

    @Column(name = "rfid_card_code", length = 50)
    private String rfidCardCode;
}
