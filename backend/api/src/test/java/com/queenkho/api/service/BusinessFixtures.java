package com.queenkho.api.service;

import com.queenkho.api.entity.*;
import java.math.BigDecimal;
import java.time.LocalDate;

/** Small independent fixtures: no application context, DB, real account or payment gateway. */
final class BusinessFixtures {
    private BusinessFixtures() {}

    static BigDecimal money(String value) { return new BigDecimal(value); }

    static User user(int id, String role, Integer facility) {
        Role r = new Role();
        r.setName(role);
        User u = new User();
        u.setId(id);
        u.setRole(r);
        u.setFacilityId(facility);
        u.setStatus("ACTIVE");
        u.setEmail("test" + id + "@example.invalid");
        u.setFullName("Test " + role);
        u.setPhone("0900000000");
        u.setCccd("079000000001");
        u.setPassword("encoded-password");
        return u;
    }

    static Facility facility(int id) {
        Facility f = new Facility();
        f.setId(id);
        f.setName("Test facility " + id);
        f.setStatus("ACTIVE");
        return f;
    }

    static StorageUnit unit(String id, int facility, int type) {
        UnitType t = new UnitType();
        t.setId(type);
        t.setName("Test type " + type);
        t.setStatus("ACTIVE");
        t.setBasePriceMonthly(money("1000000"));
        StorageUnit u = new StorageUnit();
        u.setId(id);
        u.setFacility(facility(facility));
        u.setUnitType(t);
        u.setStatus("AVAILABLE");
        u.setFloor("1");
        u.setZone("A");
        u.setRoomNumber("101");
        return u;
    }

    static RentalContract contract(String status) {
        StorageUnit unit = unit("TEST-A", 1, 1);
        unit.setStatus("OCCUPIED");
        User customer = user(10, "CUSTOMER", null);
        Reservation reservation = new Reservation();
        reservation.setId(20);
        reservation.setReservationCode("RES-TEST");
        reservation.setCustomer(customer);
        reservation.setFacility(unit.getFacility());
        reservation.setUnitType(unit.getUnitType());
        reservation.setStorageUnitId(unit.getId());
        reservation.setStatus("UNIT_ASSIGNED");
        reservation.setDurationMonths(3);
        reservation.setRentDiscountPercent(5);
        reservation.setDepositAmount(money("1000000"));
        reservation.setInsurancePlan("BASIC");
        reservation.setInsurancePremiumMonthly(BigDecimal.ZERO);
        reservation.setTermsVersion("v3");
        reservation.setStartDate(LocalDate.now().minusMonths(1));
        RentalContract c = new RentalContract();
        c.setId(30);
        c.setContractCode("HD-TEST");
        c.setCustomer(customer);
        c.setReservation(reservation);
        c.setStorageUnit(unit);
        c.setStartDate(reservation.getStartDate());
        c.setEndDate(LocalDate.now().plusMonths(2));
        c.setBillingCycleMonths(3);
        c.setRentalPolicyId(1);
        c.setDepositHeldAmount(money("1000000"));
        c.setAccessPinCode("135790");
        c.setStatus(status);
        return c;
    }
}
