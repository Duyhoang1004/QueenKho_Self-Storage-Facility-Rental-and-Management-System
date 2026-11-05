package com.queenkho.api.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class UploadApiValidationTest extends SecuredMvcFixture {
    @TempDir Path uploads;

    @BeforeEach void setup() {
        var controller = new UploadController();
        ReflectionTestUtils.setField(controller, "uploadDir", uploads);
        controllers(controller);
    }

    @Test void anonymousUploadCannotWriteAFile() throws Exception {
        mvc.perform(multipart("/api/v1/uploads").file(new MockMultipartFile("file", "receipt.png", "image/png", new byte[]{1})))
                .andExpect(status().isUnauthorized());
        try (var files = Files.list(uploads)) { assertEquals(0, files.count()); }
    }

    @ParameterizedTest @ValueSource(strings = {"CUSTOMER", "STAFF", "FACILITY_MANAGER", "BOM", "ADMIN"})
    void authenticatedRolesCanUploadWithServerGeneratedSafeFilename(String role) throws Exception {
        login(role);
        byte[] content = {1, 2, 3};
        var result = mvc.perform(multipart("/api/v1/uploads").header("Authorization", TOKEN)
                        .file(new MockMultipartFile("file", "../../receipt.PNG", "image/png", content)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.url").value(org.hamcrest.Matchers.startsWith("http://localhost/uploads/")))
                .andExpect(jsonPath("$.fileName").value(org.hamcrest.Matchers.matchesPattern("receipt_[0-9]+_[a-f0-9]{8}\\.png")))
                .andReturn();
        try (var files = Files.list(uploads)) {
            var saved = files.toList(); assertEquals(1, saved.size());
            assertArrayEquals(content, Files.readAllBytes(saved.get(0)));
            assertEquals(uploads, saved.get(0).getParent());
        }
        assertFalse(result.getResponse().getContentAsString().contains("../"));
    }

    @ParameterizedTest @ValueSource(strings = {"receipt.exe", "receipt.png.exe", "receipt", "receipt.svg", "receipt.html"})
    void unsupportedExtensionIsRejectedWithoutWriting(String filename) throws Exception {
        login("CUSTOMER");
        mvc.perform(multipart("/api/v1/uploads").header("Authorization", TOKEN)
                        .file(new MockMultipartFile("file", filename, "image/png", new byte[]{1})))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").isNotEmpty());
        try (var files = Files.list(uploads)) { assertEquals(0, files.count()); }
    }

    @Test void emptyFileIsRejected() throws Exception {
        login("CUSTOMER");
        mvc.perform(multipart("/api/v1/uploads").header("Authorization", TOKEN)
                        .file(new MockMultipartFile("file", "receipt.png", "image/png", new byte[0])))
                .andExpect(status().isBadRequest());
        try (var files = Files.list(uploads)) { assertEquals(0, files.count()); }
    }

    @Test void missingMultipartPartIs400() throws Exception {
        login("CUSTOMER");
        mvc.perform(multipart("/api/v1/uploads").header("Authorization", TOKEN))
                .andExpect(status().isBadRequest());
    }
}
