package com.queenkho.api.controller;

import com.queenkho.api.entity.Voucher;
import com.queenkho.api.repository.UnitTypeRepository;
import com.queenkho.api.repository.VoucherRepository;
import com.queenkho.api.service.PricingService;
import com.queenkho.api.service.VoucherService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;

import java.util.Optional;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Exercises real voucher validation all the way from HTTP JSON to service. */
class VoucherApiContractTest extends SecuredMvcFixture {
    final VoucherRepository vouchers = mock(VoucherRepository.class);
    final UnitTypeRepository types = mock(UnitTypeRepository.class);
    final VoucherService service = new VoucherService(vouchers, types, mock(PricingService.class), jdbc);
    static final String VALID = "{\"code\":\"newkho\",\"name\":\"Ưu đãi\",\"discountType\":\"FIXED\",\"discountValue\":100000}";

    @BeforeEach void setup() { controllers(new VoucherController(service, currentUser)); }

    @ParameterizedTest @ValueSource(strings = {"CUSTOMER", "STAFF", "FACILITY_MANAGER", "ADMIN"})
    void onlyBomCanManageVouchers(String role) throws Exception {
        login(role);
        mvc.perform(post("/api/v1/bom/vouchers").header("Authorization", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content(VALID))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("FORBIDDEN_ROLE"));
        verifyNoInteractions(vouchers, types);
    }

    @Test void anonymousCallerCannotCreateVoucher() throws Exception {
        mvc.perform(post("/api/v1/bom/vouchers").contentType(MediaType.APPLICATION_JSON).content(VALID))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(vouchers);
    }

    @Test void bomCreatesVoucherWithNormalizedCodeAndServerSideActor() throws Exception {
        login("BOM");
        when(vouchers.save(any())).thenAnswer(invocation -> { Voucher voucher = invocation.getArgument(0); voucher.setId(5); return voucher; });
        mvc.perform(post("/api/v1/bom/vouchers").header("Authorization", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content(VALID))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(5))
                .andExpect(jsonPath("$.code").value("NEWKHO")).andExpect(jsonPath("$.usedCount").value(0));
        verify(vouchers).save(argThat(v -> v.getCreatedBy() == 42));
    }

    @ParameterizedTest @ValueSource(strings = {
            "{}",
            "{\"code\":\"BAD CODE\",\"name\":\"Test\",\"discountType\":\"FIXED\",\"discountValue\":1}",
            "{\"code\":\"TEST\",\"name\":\"Test\",\"discountType\":\"PERCENT\",\"discountValue\":101}",
            "{\"code\":\"TEST\",\"name\":\"Test\",\"discountType\":\"FIXED\",\"discountValue\":0}"
    })
    void invalidVoucherReturnsMachineReadableErrorAndDoesNotPersist(String body) throws Exception {
        login("BOM");
        mvc.perform(post("/api/v1/bom/vouchers").header("Authorization", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.message").isNotEmpty());
        verify(vouchers, never()).save(any());
    }

    @Test void duplicateCodeIs400RatherThanServerError() throws Exception {
        login("BOM"); when(vouchers.existsByCode("NEWKHO")).thenReturn(true);
        mvc.perform(post("/api/v1/bom/vouchers").header("Authorization", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content(VALID))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("DUPLICATE_CODE"));
        verify(vouchers, never()).save(any());
    }

    @Test void unknownVoucherStatusTargetReturns404() throws Exception {
        login("BOM"); when(vouchers.findById(999)).thenReturn(Optional.empty());
        mvc.perform(patch("/api/v1/bom/vouchers/999/status").header("Authorization", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"INACTIVE\"}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("VOUCHER_NOT_FOUND"));
    }

    @Test void unsupportedVoucherStatusIsRejected() throws Exception {
        login("BOM");
        mvc.perform(patch("/api/v1/bom/vouchers/5/status").header("Authorization", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"DELETED\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("INVALID_INPUT"));
        verifyNoInteractions(vouchers);
    }

    @Test void customerPreviewRequiresFacilityAndUnitTypeQueryParameters() throws Exception {
        login("CUSTOMER");
        mvc.perform(get("/api/v1/vouchers/validate").header("Authorization", TOKEN).param("months", "3"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(vouchers, types);
    }

    @Test void invalidMonthQueryIs400BeforeVoucherLookup() throws Exception {
        login("CUSTOMER");
        mvc.perform(get("/api/v1/vouchers/validate").header("Authorization", TOKEN)
                        .param("facilityId", "1").param("unitTypeId", "2").param("months", "abc"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(vouchers, types);
    }
}
