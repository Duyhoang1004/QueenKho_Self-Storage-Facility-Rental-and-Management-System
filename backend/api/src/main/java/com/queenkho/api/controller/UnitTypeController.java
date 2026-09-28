package com.queenkho.api.controller;

import com.queenkho.api.dto.UnitTypeResponse;
import com.queenkho.api.service.UnitTypeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/unit-types")
public class UnitTypeController {

    @Autowired
    private UnitTypeService unitTypeService;

    // UC-09: Lấy tất cả loại kho (cho dropdown filter)
    @GetMapping
    public ResponseEntity<List<UnitTypeResponse>> getAllUnitTypes() {
        return ResponseEntity.ok(unitTypeService.getAllUnitTypes());
    }
}
