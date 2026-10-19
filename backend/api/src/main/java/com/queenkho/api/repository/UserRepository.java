package com.queenkho.api.repository;

import java.util.List;
import java.util.Optional;
import com.queenkho.api.entity.User;
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
}
