package com.queenkho.api.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.io.IOException;
import java.nio.file.*;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/uploads")
public class UploadController {

    private final Path uploadDir = Paths.get("uploads").toAbsolutePath();

    public UploadController() {
        try {
            Files.createDirectories(uploadDir);
        } catch (IOException e) {
            throw new RuntimeException("Could not initialize upload folder", e);
        }
    }

    @PostMapping
    public ResponseEntity<?> uploadFile(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Vui lòng chọn file hình ảnh biên lai."));
        }

        String originalFilename = file.getOriginalFilename();
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase();
        }
        if (!extension.matches("\\.(jpg|jpeg|png|webp|gif|jfif)$")) {
            return ResponseEntity.badRequest().body(Map.of("message", "Chỉ hỗ trợ file ảnh định dạng JPG, PNG, WEBP, GIF."));
        }

        String newFileName = "receipt_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8) + extension;
        Path targetPath = uploadDir.resolve(newFileName);

        try {
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
            String fileUrl;
            try {
                fileUrl = ServletUriComponentsBuilder.fromCurrentContextPath()
                        .path("/uploads/")
                        .path(newFileName)
                        .toUriString();
            } catch (Exception ex) {
                fileUrl = "http://localhost:8080/uploads/" + newFileName;
            }
            return ResponseEntity.ok(Map.of(
                    "url", fileUrl,
                    "fileName", newFileName
            ));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Lỗi khi lưu file: " + e.getMessage()));
        }
    }
}
