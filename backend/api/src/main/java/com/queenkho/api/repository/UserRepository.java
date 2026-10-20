package com.queenkho.api.repository;

import java.util.List;
import java.util.Optional;
import com.queenkho.api.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, Integer> {

    //Spring tu viet SQL script SELECT * FROM users WHERE email = ?
    Optional<User> findByEmail(String email);

    // UC-03 (+ dashboard Admin): đếm user theo (role, status) trong 1 query GROUP BY, bỏ tài khoản system.
    // Alias (AS roleName...) phải trùng tên getter của interface RoleStatusCount bên dưới.
    @Query("SELECT u.role.name AS roleName, u.status AS status, COUNT(u) AS total " +
           "FROM User u WHERE u.email <> :systemEmail " +
           "GROUP BY u.role.name, u.status")
    List<RoleStatusCount> countGroupByRoleAndStatus(@Param("systemEmail") String systemEmail);

    // Projection: mỗi dòng kết quả GROUP BY → 1 object implement interface này (Spring tự tạo)
    interface RoleStatusCount {
        String getRoleName();
        String getStatus();
        Long getTotal();
    }

    // UC-08: danh sách người dùng có bộ lọc tuỳ chọn.
    // Mẹo "(:x IS NULL OR ...)": tham số null = bỏ qua điều kiện đó → 1 query dùng cho mọi tổ hợp bộ lọc.
    // Không viết ORDER BY ở đây: thứ tự sắp xếp nằm trong Pageable (service truyền vào).
    // Spring tự sinh thêm câu COUNT(...) từ query này để tính tổng số trang.
    @Query("SELECT u FROM User u JOIN u.role r " +
           "WHERE u.email <> :systemEmail " +
           "AND (:keyword IS NULL " +
           "     OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "     OR LOWER(u.email) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "     OR u.phone LIKE CONCAT('%', :keyword, '%')) " +
           "AND (:roleName IS NULL OR r.name = :roleName) " +
           "AND (:status IS NULL OR u.status = :status) " +
           "AND (:facilityId IS NULL OR u.facilityId = :facilityId)")
    Page<User> searchUsers(@Param("keyword") String keyword,
                           @Param("roleName") String roleName,
                           @Param("status") String status,
                           @Param("facilityId") Integer facilityId,
                           @Param("systemEmail") String systemEmail,
                           Pageable pageable);

    // UC-08: email đã tồn tại chưa (không phân biệt hoa thường)
    boolean existsByEmailIgnoreCase(String email);

    // UC-08 / PR-A7: đếm Admin ACTIVE (bỏ tài khoản system)
    long countByRole_NameAndStatusAndEmailNot(String roleName, String status, String email);

    // UC-08 / PR-04: các FM ACTIVE của 1 cơ sở (đúng ra tối đa 1, dữ liệu cũ có thể sai → trả List)
    List<User> findByRole_NameAndFacilityIdAndStatus(String roleName, Integer facilityId, String status);

    // UC-08: mọi FM ACTIVE — để biết cơ sở nào đã có quản lý (dropdown chọn cơ sở)
    List<User> findByRole_NameAndStatus(String roleName, String status);
}
