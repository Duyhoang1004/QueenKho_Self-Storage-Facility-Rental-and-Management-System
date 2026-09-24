package com.queenkho.api.service;


import com.queenkho.api.dto.LoginRequest;
import com.queenkho.api.dto.LoginResponse;
import com.queenkho.api.entity.User;
import com.queenkho.api.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    public LoginResponse login(LoginRequest request) {

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Email không tồn tại"));

        boolean isMatch = passwordEncoder.matches(request.getPassword(), user.getPassword());
        if (!isMatch) {
            throw new RuntimeException("Mật khẩu sai");
        }
        String token = java.util.UUID.randomUUID().toString();

        return new LoginResponse(token, user.getRole().getName(), user.getId(), user.getFullName());

    }
}


