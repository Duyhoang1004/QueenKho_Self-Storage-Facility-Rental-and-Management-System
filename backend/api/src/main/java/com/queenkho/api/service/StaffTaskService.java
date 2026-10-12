package com.queenkho.api.service;

import com.queenkho.api.dto.StaffTaskResponse;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.StaffTask;
import com.queenkho.api.entity.StorageUnit;
import com.queenkho.api.entity.User;
import com.queenkho.api.repository.StaffTaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Service
public class StaffTaskService {

    // Giờ đóng cửa: hạn chót của mọi task
    private static final LocalTime CLOSING_TIME = LocalTime.of(21, 0);
    // Các trạng thái được coi là "task chưa đóng" (kể cả quá hạn — Manager vẫn phải xử lý)
    private static final List<String> OPEN_STATUSES = List.of("OPEN", "IN_PROGRESS", "OVERDUE");
    private static final List<String> VALID_STATUSES =
            List.of("OPEN", "IN_PROGRESS", "OVERDUE", "COMPLETED", "CANCELLED");

    @Autowired
    private StaffTaskRepository staffTaskRepository;

    // ================== SINH TASK (gọi từ service khác) ==================

    // UC-16: sinh task CHECK_IN — gọi trong UC-14 sau khi tạo hợp đồng
    @Transactional
    public void createCheckInTask(RentalContract contract) {
        // Ngày khách hẹn đến; không có giờ hẹn thì lấy ngày bắt đầu thuê
        LocalDate appointmentDate = contract.getStartDate();
        if (contract.getReservation() != null && contract.getReservation().getExpectedAppointmentTime() != null) {
            appointmentDate = contract.getReservation().getExpectedAppointmentTime().toLocalDate();
        }
        createTask(contract, "CHECK_IN", appointmentDate, null);
    }

    // UC-16: sinh task CHECK_OUT — gọi trong UC-22 khi khách yêu cầu trả kho
    @Transactional
    public void createCheckOutTask(RentalContract contract, LocalDate checkoutDate, String note) {
        createTask(contract, "CHECK_OUT", checkoutDate, note);
    }

    // UC-16: dời hạn task CHECK_IN khi đơn được dời lịch nhận kho (No-Show → gọi được khách).
    // Task đã quá hạn thì mở lại: chưa ai nhận → OPEN, đã có người nhận → IN_PROGRESS
    @Transactional
    public void rescheduleOpenTasks(Integer contractId, String taskType, LocalDate newAppointmentDate) {
        List<StaffTask> tasks = staffTaskRepository
                .findByContractIdAndTaskTypeAndStatusIn(contractId, taskType, OPEN_STATUSES);
        for (StaffTask task : tasks) {
            task.setDueAt(computeDueAt(newAppointmentDate));
            if ("OVERDUE".equals(task.getStatus())) {
                task.setStatus(task.getStaff() == null ? "OPEN" : "IN_PROGRESS");
            }
        }
        staffTaskRepository.saveAll(tasks);
    }

    // UC-16: huỷ task chưa đóng — gọi khi khách gia hạn (không trả kho nữa) hoặc khi xử lý No-Show
    @Transactional
    public void cancelOpenTasks(Integer contractId, String taskType) {
        List<StaffTask> tasks = staffTaskRepository
                .findByContractIdAndTaskTypeAndStatusIn(contractId, taskType, OPEN_STATUSES);
        for (StaffTask task : tasks) {
            task.setStatus("CANCELLED");
        }
        staffTaskRepository.saveAll(tasks);
    }

    private void createTask(RentalContract contract, String taskType, LocalDate appointmentDate, String note) {
        // Chặn trùng: hợp đồng đã có task cùng loại đang mở thì thôi
        if (staffTaskRepository.existsByContractIdAndTaskTypeAndStatusIn(contract.getId(), taskType, OPEN_STATUSES)) {
            return;
        }

        StaffTask task = new StaffTask();
        task.setFacilityId(contract.getStorageUnit().getFacility().getId());
        task.setContract(contract);
        task.setTaskType(taskType);
        task.setStatus("OPEN");
        task.setDueAt(computeDueAt(appointmentDate));
        task.setNote(note);
        staffTaskRepository.save(task);
    }

    // Hạn = ngày hẹn lúc 21:00.
    // Nếu mốc đó đã qua (vd: Manager gán ô trễ) → trước 21h thì hạn hôm nay, sau 21h thì hạn hôm sau.
    LocalDateTime computeDueAt(LocalDate appointmentDate) {
        LocalDateTime now = LocalDateTime.now();
        if (appointmentDate != null) {
            LocalDateTime due = appointmentDate.atTime(CLOSING_TIME);
            if (due.isAfter(now)) {
                return due;
            }
        }
        LocalDate day = now.toLocalTime().isBefore(CLOSING_TIME) ? now.toLocalDate() : now.toLocalDate().plusDays(1);
        return day.atTime(CLOSING_TIME);
    }

    // ================== UC-16: BẢNG CÔNG VIỆC ==================

    // readOnly = true: báo cho Hibernate là chỉ đọc → bỏ qua dirty checking, nhẹ hơn
    @Transactional(readOnly = true)
    public List<StaffTaskResponse> getBoard(Integer facilityId, String status) {
        if (facilityId == null) {
            throw new IllegalArgumentException("Thiếu facilityId");
        }
        String normalizedStatus = null;
        if (status != null && !status.isBlank()) {
            normalizedStatus = status.trim().toUpperCase();
            if (!VALID_STATUSES.contains(normalizedStatus)) {
                throw new IllegalArgumentException("Trạng thái không hợp lệ: " + status);
            }
        }
        return staffTaskRepository.findBoard(facilityId, normalizedStatus)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // Entity → DTO. Không trả thẳng entity ra API vì:
    // (1) quan hệ LAZY sẽ lỗi khi Jackson serialize, (2) lộ field không cần thiết (password của User...)
    private StaffTaskResponse toResponse(StaffTask task) {
        RentalContract contract = task.getContract();
        User staff = task.getStaff();
        StorageUnit unit = contract != null ? contract.getStorageUnit() : null;

        return StaffTaskResponse.builder()
                .id(task.getId())
                .taskType(task.getTaskType())
                .status(task.getStatus())
                .dueAt(task.getDueAt())
                .createdAt(task.getCreatedAt())
                .claimedAt(task.getClaimedAt())
                .completedAt(task.getCompletedAt())
                .note(task.getNote())
                .staffId(staff != null ? staff.getId() : null)
                .staffName(staff != null ? staff.getFullName() : null)
                .contractId(contract != null ? contract.getId() : null)
                .contractCode(contract != null ? contract.getContractCode() : null)
                .contractStatus(contract != null ? contract.getStatus() : null)
                .customerName(contract != null ? contract.getCustomer().getFullName() : null)
                .customerPhone(contract != null ? contract.getCustomer().getPhone() : null)
                .storageUnitId(unit != null ? unit.getId() : null)
                .unitTypeName(unit != null && unit.getUnitType() != null ? unit.getUnitType().getName() : null)
                .build();
    }

    // ================== JOB QUÁ HẠN ==================

    // @Modifying query bắt buộc chạy trong transaction → bọc ở đây
    @Transactional
    public int markOverdueTasks() {
        return staffTaskRepository.markOverdue(LocalDateTime.now());
    }
}
