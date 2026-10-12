package com.queenkho.api.service;


import com.queenkho.api.dto.LoginRequest;
import com.queenkho.api.dto.LoginResponse;
import com.queenkho.api.entity.Facility;
import com.queenkho.api.entity.User;
import com.queenkho.api.repository.FacilityRepository;
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

    @Autowired
    private FacilityRepository facilityRepository;

    public LoginResponse login(LoginRequest request) {

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Email không tồn tại"));

        boolean isMatch = passwordEncoder.matches(request.getPassword(), user.getPassword());
        if (!isMatch) {
            throw new RuntimeException("Mật khẩu sai");
        }
        String token = java.util.UUID.randomUUID().toString();

        // UC-16: trả kèm cơ sở để header Staff/Manager hiển thị tên cơ sở
        String facilityName = user.getFacilityId() == null ? null
                : facilityRepository.findById(user.getFacilityId()).map(Facility::getName).orElse(null);

        return new LoginResponse(token, user.getRole().getName(), user.getId(), user.getFullName(),
                user.getFacilityId(), facilityName);

    }

    @Autowired
    private com.queenkho.api.repository.RoleRepository roleRepository;

    public void register(com.queenkho.api.dto.RegisterRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new RuntimeException("Email này đã được sử dụng");
        }

        com.queenkho.api.entity.Role customerRole = roleRepository.findByName("CUSTOMER")
                .orElseThrow(() -> new RuntimeException("Lỗi hệ thống: Không tìm thấy Role Customer"));

        User newUser = new User();
        newUser.setEmail(request.getEmail());
        newUser.setFullName(request.getFullName());
        newUser.setPhone(request.getPhone());
        newUser.setPassword(passwordEncoder.encode(request.getPassword()));
        newUser.setRole(customerRole);
        newUser.setStatus("ACTIVE");

        userRepository.save(newUser);
    }
}


