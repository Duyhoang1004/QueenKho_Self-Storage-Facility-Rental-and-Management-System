package com.queenkho.api.repository;

import com.queenkho.api.entity.Voucher;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VoucherRepository extends JpaRepository<Voucher, Integer> {

    Optional<Voucher> findByCode(String code);

    boolean existsByCode(String code);

    List<Voucher> findAllByOrderByCreatedAtDesc();

    // Mã mặc định tự áp khi khách không nhập mã (NEWKHO)
    Optional<Voucher> findFirstByIsDefaultTrueAndStatusOrderByIdAsc(String status);
}
