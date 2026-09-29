const fs = require('fs');
const path = 'backend/api/src/main/java/com/queenkho/api/service/ReservationService.java';
let content = fs.readFileSync(path, 'utf8');

const target =         // Cập nhật đơn đặt chỗ
        reservation.setStorageUnitId(storageUnit.getId());
        reservation.setStatus("UNIT_ASSIGNED");
        reservationRepository.save(reservation);
    }
};

const replacement =         // Cập nhật đơn đặt chỗ
        reservation.setStorageUnitId(storageUnit.getId());
        reservation.setStatus("UNIT_ASSIGNED");
        reservationRepository.save(reservation);

        // Sinh hợp đồng tự động
        com.queenkho.api.entity.RentalContract contract = new com.queenkho.api.entity.RentalContract();
        String contractCode = "HD-" + (100000 + new java.util.Random().nextInt(900000));
        contract.setContractCode(contractCode);
        contract.setReservation(reservation);
        contract.setCustomer(reservation.getCustomer());
        contract.setStorageUnit(storageUnit);
        contract.setRentalPolicyId(1); // Default for now
        contract.setStartDate(reservation.getStartDate());
        if (reservation.getDurationMonths() != null) {
            contract.setEndDate(reservation.getStartDate().plusMonths(reservation.getDurationMonths()));
        }
        contract.setBillingCycleMonths(1);
        if (reservation.getDepositAmount() != null) {
            contract.setDepositHeldAmount(reservation.getDepositAmount());
        } else {
            contract.setDepositHeldAmount(java.math.BigDecimal.ZERO);
        }
        contract.setStatus("ACTIVE");
        rentalContractRepository.save(contract);
    }
};

// Attempt string replace. If target is not perfectly matched due to encoding, use fallback regex
if (content.includes(target)) {
    content = content.replace(target, replacement);
} else {
    // Fallback: replace the last 3 lines before the end
    const fallbackTarget = /reservation\.setStatus\("UNIT_ASSIGNED"\);\s*reservationRepository\.save\(reservation\);\s*\}\s*\}/;
    const fallbackReplacement = eservation.setStatus("UNIT_ASSIGNED");
        reservationRepository.save(reservation);

        // Sinh hop dong tu dong
        com.queenkho.api.entity.RentalContract contract = new com.queenkho.api.entity.RentalContract();
        String contractCode = "HD-" + (100000 + new java.util.Random().nextInt(900000));
        contract.setContractCode(contractCode);
        contract.setReservation(reservation);
        contract.setCustomer(reservation.getCustomer());
        contract.setStorageUnit(storageUnit);
        contract.setRentalPolicyId(1);
        contract.setStartDate(reservation.getStartDate());
        if (reservation.getDurationMonths() != null) {
            contract.setEndDate(reservation.getStartDate().plusMonths(reservation.getDurationMonths()));
        }
        contract.setBillingCycleMonths(1);
        if (reservation.getDepositAmount() != null) {
            contract.setDepositHeldAmount(reservation.getDepositAmount());
        } else {
            contract.setDepositHeldAmount(java.math.BigDecimal.ZERO);
        }
        contract.setStatus("ACTIVE");
        rentalContractRepository.save(contract);
    }
};
    content = content.replace(fallbackTarget, fallbackReplacement);
}

fs.writeFileSync(path, content, 'utf8');
