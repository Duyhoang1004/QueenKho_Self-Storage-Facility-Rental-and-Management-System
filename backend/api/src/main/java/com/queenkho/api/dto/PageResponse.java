package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

// Khuôn chung cho danh sách phân trang (UC-08, sau này UC-31).
// Không trả thẳng Page<T> của Spring: JSON của PageImpl không ổn định giữa các phiên bản
// (Spring Data đã cảnh báo), còn class này mình tự quyết định field.
@AllArgsConstructor
@Getter
public class PageResponse<T> {
    private List<T> content;
    private int page;               // bắt đầu từ 0
    private int size;
    private long totalElements;
    private int totalPages;
}
