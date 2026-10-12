package com.queenkho.api.repository;

import com.queenkho.api.entity.HandoverRecord;
import org.springframework.data.jpa.repository.JpaRepository;

// UC-18: lưu biên bản bàn giao
public interface HandoverRecordRepository extends JpaRepository<HandoverRecord, Integer> {
}
