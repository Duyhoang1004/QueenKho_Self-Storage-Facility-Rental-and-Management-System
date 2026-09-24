package com.queenkho.api.repository;

import java.util.Optional;
import com.queenkho.api.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Integer> {

    //Spring tu viet SQL script SELECT * FROM users WHERE email = ?
    Optional<User> findByEmail(String email);
}
