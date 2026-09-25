package com.queenkho.api.repository;

import java.util.Optional;
import com.queenkho.api.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleRepository extends JpaRepository<Role, Integer> {
    Optional<Role> findByName(String name);
}
