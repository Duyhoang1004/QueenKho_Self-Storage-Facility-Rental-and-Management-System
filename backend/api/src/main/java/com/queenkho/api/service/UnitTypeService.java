package com.queenkho.api.service;

import com.queenkho.api.dto.UnitTypeResponse;
import com.queenkho.api.repository.UnitTypeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UnitTypeService {

    @Autowired
    private UnitTypeRepository unitTypeRepository;

    @Transactional(readOnly = true)
    public List<UnitTypeResponse> getAllUnitTypes() {
        return unitTypeRepository.findAll().stream()
            .map(ut -> new UnitTypeResponse(
                ut.getId(),
                ut.getName(),
                ut.getAreaSqm(),
                ut.getVolumeCbm(),
                ut.getBasePriceMonthly(),
                ut.getSuggestedCapacity(),
                ut.getDimensions(),
                ut.getFeatures()
            ))
            .toList();
    }
}
