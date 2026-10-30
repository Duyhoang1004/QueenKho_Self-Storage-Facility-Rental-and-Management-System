package com.queenkho.api.service;

import com.queenkho.api.dto.*;
import com.queenkho.api.entity.Facility;
import com.queenkho.api.entity.FacilityFloor;
import com.queenkho.api.entity.FloorFixture;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.StorageUnit;
import com.queenkho.api.entity.UnitType;
import com.queenkho.api.exception.ContractException;
import com.queenkho.api.exception.FacilityException;
import com.queenkho.api.repository.FacilityFloorRepository;
import com.queenkho.api.repository.FacilityRepository;
import com.queenkho.api.repository.FloorFixtureRepository;
import com.queenkho.api.repository.StorageUnitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * UC-06: Sơ đồ mặt bằng ô kho.
 * Lưới: 1 ô = 0.5m, toạ độ (x, y) là góc trên-trái. Ô kho không được chồng lên nhau,
 * không đè lên lối đi / cửa / thang / văn phòng và phải nằm trong mặt bằng tầng.
 */
@Service
@RequiredArgsConstructor
public class FloorPlanService {

    public static final double CELL_METERS = 0.5;
    public static final Set<String> FIXTURE_TYPES = Set.of("AISLE", "ENTRANCE", "STAIRS", "ELEVATOR", "OFFICE");
    public static final Set<String> DOOR_SIDES = Set.of("TOP", "BOTTOM", "LEFT", "RIGHT");
    private static final int MAX_ITEM_CELLS = 100;
    private static final Pattern NUMBER = Pattern.compile("\\d+(?:[.,]\\d+)?");

    private final FacilityRepository facilityRepository;
    private final FacilityFloorRepository facilityFloorRepository;
    private final FloorFixtureRepository floorFixtureRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final ActivityLogService activityLogService;

    // Hình chữ nhật trên lưới; chạm cạnh không tính là chồng
    record Rect(int x, int y, int w, int h) {
        boolean overlaps(Rect o) {
            return x < o.x + o.w && o.x < x + w && y < o.y + o.h && o.y < y + h;
        }

        boolean inside(int gridWidth, int gridHeight) {
            return x >= 0 && y >= 0 && x + w <= gridWidth && y + h <= gridHeight;
        }
    }

    /**
     * Kích thước mặc định (ô lưới) theo loại kho: lấy 2 số đầu của dimensions ("2.5m × 2.4m × 2.7m" → 5 × 5),
     * không đọc được thì lấy hình vuông theo diện tích.
     */
    public static int[] defaultSize(UnitType unitType) {
        if (unitType == null) {
            return new int[]{4, 4};
        }
        if (unitType.getDimensions() != null) {
            Matcher m = NUMBER.matcher(unitType.getDimensions());
            List<Double> numbers = new ArrayList<>();
            while (m.find() && numbers.size() < 2) {
                numbers.add(Double.parseDouble(m.group().replace(',', '.')));
            }
            if (numbers.size() == 2) {
                return new int[]{toCells(numbers.get(0)), toCells(numbers.get(1))};
            }
        }
        double area = unitType.getAreaSqm() != null ? unitType.getAreaSqm().doubleValue() : 4.0;
        int side = toCells(Math.sqrt(area));
        return new int[]{side, side};
    }

    private static int toCells(double meters) {
        return Math.max(1, (int) Math.round(meters / CELL_METERS));
    }

    // ──────────────────────────────────────────────────────
    // Đọc mặt bằng
    // ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public FacilityLayoutResponse getLayout(Integer facilityId) {
        if (!facilityRepository.existsById(facilityId)) {
            throw new FacilityException(HttpStatus.NOT_FOUND, "FACILITY_NOT_FOUND", "Không tìm thấy cơ sở ID: " + facilityId);
        }
        List<FacilityFloor> floors = facilityFloorRepository.findByFacility_IdOrderBySortOrderAscIdAsc(facilityId);
        Map<Integer, List<FloorFixture>> fixturesByFloor = floors.isEmpty()
                ? Map.of()
                : floorFixtureRepository.findByFloor_IdIn(floors.stream().map(FacilityFloor::getId).toList())
                        .stream()
                        .sorted(Comparator.comparing(FloorFixture::getId))
                        .collect(Collectors.groupingBy(f -> f.getFloor().getId()));

        return FacilityLayoutResponse.builder()
                .facilityId(facilityId)
                .cellMeters(CELL_METERS)
                .floors(floors.stream()
                        .map(f -> toFloorResponse(f, fixturesByFloor.getOrDefault(f.getId(), List.of())))
                        .toList())
                .build();
    }

    // ──────────────────────────────────────────────────────
    // Tầng
    // ──────────────────────────────────────────────────────

    @Transactional
    public FloorLayoutResponse createFloor(Integer facilityId, FloorRequest request, Integer actorUserId) {
        Facility facility = facilityRepository.findById(facilityId)
                .orElseThrow(() -> new FacilityException(HttpStatus.NOT_FOUND, "FACILITY_NOT_FOUND", "Không tìm thấy cơ sở ID: " + facilityId));

        String name = request.getName().trim();
        if (facilityFloorRepository.findByFacility_IdAndNameIgnoreCase(facilityId, name).isPresent()) {
            throw new FacilityException(HttpStatus.CONFLICT, "DUPLICATE_FLOOR", "Cơ sở đã có mặt bằng \"" + name + "\"");
        }

        int nextOrder = facilityFloorRepository.findByFacility_IdOrderBySortOrderAscIdAsc(facilityId).stream()
                .mapToInt(FacilityFloor::getSortOrder).max().orElse(0) + 1;

        FacilityFloor floor = facilityFloorRepository.save(FacilityFloor.builder()
                .facility(facility)
                .name(name)
                .gridWidth(request.getGridWidth())
                .gridHeight(request.getGridHeight())
                .sortOrder(nextOrder)
                .build());

        activityLogService.log(actorUserId != null ? actorUserId : 1,
                "[FLOOR_CREATE] Tạo mặt bằng " + name + " (" + meters(request.getGridWidth()) + "m × "
                        + meters(request.getGridHeight()) + "m) tại cơ sở " + facility.getName(),
                "facility_floors", String.valueOf(floor.getId()));

        return toFloorResponse(floor, List.of());
    }

    /**
     * Đổi tên / kích thước tầng. Đổi tên thì đổi luôn storage_units.floor của các ô thuộc tầng đó.
     * Thu nhỏ mặt bằng bị chặn nếu có ô kho / vật cố định nằm ngoài kích thước mới.
     */
    @Transactional
    public FloorLayoutResponse updateFloor(Integer floorId, FloorRequest request, Integer actorUserId) {
        FacilityFloor floor = findFloor(floorId);
        Integer facilityId = floor.getFacility().getId();
        String oldName = floor.getName();
        String newName = request.getName().trim();

        if (!oldName.equalsIgnoreCase(newName)) {
            facilityFloorRepository.findByFacility_IdAndNameIgnoreCase(facilityId, newName).ifPresent(other -> {
                throw new FacilityException(HttpStatus.CONFLICT, "DUPLICATE_FLOOR", "Cơ sở đã có mặt bằng \"" + newName + "\"");
            });
        }

        List<StorageUnit> unitsOnFloor = unitsOnFloor(facilityId, oldName);
        List<FloorFixture> fixtures = floorFixtureRepository.findByFloor_IdOrderByIdAsc(floorId);
        List<String> outside = new ArrayList<>();
        for (StorageUnit u : unitsOnFloor) {
            if (u.isPlacedOnMap() && !rectOf(u).inside(request.getGridWidth(), request.getGridHeight())) {
                outside.add(u.getId());
            }
        }
        for (FloorFixture f : fixtures) {
            if (!rectOf(f).inside(request.getGridWidth(), request.getGridHeight())) {
                outside.add(fixtureName(f));
            }
        }
        if (!outside.isEmpty()) {
            throw new FacilityException(HttpStatus.BAD_REQUEST, "MAP_OUT_OF_BOUNDS",
                    "Không thu nhỏ được mặt bằng vì còn " + String.join(", ", limit(outside)) + " nằm ngoài kích thước mới");
        }

        if (!oldName.equals(newName)) {
            unitsOnFloor.forEach(u -> u.setFloor(newName));
            storageUnitRepository.saveAll(unitsOnFloor);
        }
        floor.setName(newName);
        floor.setGridWidth(request.getGridWidth());
        floor.setGridHeight(request.getGridHeight());
        facilityFloorRepository.save(floor);

        activityLogService.log(actorUserId != null ? actorUserId : 1,
                "[FLOOR_UPDATE] Cập nhật mặt bằng " + oldName + (oldName.equals(newName) ? "" : " → " + newName)
                        + " (" + meters(request.getGridWidth()) + "m × " + meters(request.getGridHeight()) + "m)",
                "facility_floors", String.valueOf(floorId));

        return toFloorResponse(floor, fixtures);
    }

    // Chỉ xoá được tầng không còn ô kho nào (ô có thể đã đặt hoặc chưa đặt trên mặt bằng)
    @Transactional
    public void deleteFloor(Integer floorId, Integer actorUserId) {
        FacilityFloor floor = findFloor(floorId);
        int unitCount = unitsOnFloor(floor.getFacility().getId(), floor.getName()).size();
        if (unitCount > 0) {
            throw new FacilityException(HttpStatus.CONFLICT, "FLOOR_HAS_UNITS",
                    "Không xoá được mặt bằng " + floor.getName() + " vì còn " + unitCount + " ô kho thuộc tầng này");
        }
        floorFixtureRepository.deleteAllByFloorId(floorId);
        facilityFloorRepository.delete(floor);

        activityLogService.log(actorUserId != null ? actorUserId : 1,
                "[FLOOR_DELETE] Xoá mặt bằng " + floor.getName(), "facility_floors", String.valueOf(floorId));
    }

    // ──────────────────────────────────────────────────────
    // Lưu mặt bằng
    // ──────────────────────────────────────────────────────

    /**
     * Lưu mặt bằng 1 tầng trong 1 giao dịch:
     *  - fixtures: thay toàn bộ vật cố định của tầng
     *  - units: đặt / dời ô (ô đang ở tầng khác sẽ chuyển sang tầng này), x = null → gỡ khỏi mặt bằng
     * Sau khi áp dụng, kiểm tra toàn tầng: ra ngoài mặt bằng / chồng ô / đè vật cố định → huỷ cả lần lưu.
     */
    @Transactional
    public FloorLayoutResponse saveFloorPlan(Integer floorId, SaveFloorPlanRequest request, Integer actorUserId) {
        FacilityFloor floor = findFloor(floorId);
        Integer facilityId = floor.getFacility().getId();
        Map<String, StorageUnit> facilityUnits = storageUnitRepository.findByFacility_Id(facilityId).stream()
                .collect(Collectors.toMap(StorageUnit::getId, u -> u));

        List<StorageUnit> changed = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (UnitPlacementDto p : Optional.ofNullable(request.getUnits()).orElse(List.of())) {
            StorageUnit unit = facilityUnits.get(p.getUnitId());
            if (unit == null) {
                throw new FacilityException(HttpStatus.BAD_REQUEST, "UNIT_NOT_IN_FACILITY",
                        "Ô kho " + p.getUnitId() + " không thuộc cơ sở này");
            }
            if (!seen.add(unit.getId())) {
                throw new FacilityException(HttpStatus.BAD_REQUEST, "DUPLICATE_PLACEMENT",
                        "Ô kho " + unit.getId() + " xuất hiện 2 lần trong yêu cầu");
            }
            if (p.getX() == null) {
                if (sameFloor(unit.getFloor(), floor.getName())) {
                    unit.clearMapPosition();
                    changed.add(unit);
                }
                continue;
            }
            applyPlacement(unit, p, floor.getName());
            changed.add(unit);
        }

        List<FloorFixture> newFixtures = new ArrayList<>();
        for (FloorFixtureDto dto : Optional.ofNullable(request.getFixtures()).orElse(List.of())) {
            newFixtures.add(toFixture(dto, floor));
        }

        List<StorageUnit> placedOnFloor = facilityUnits.values().stream()
                .filter(u -> sameFloor(u.getFloor(), floor.getName()) && u.isPlacedOnMap())
                .sorted(Comparator.comparing(StorageUnit::getId))
                .toList();
        List<String> conflicts = findConflicts(floor, placedOnFloor, newFixtures);
        if (!conflicts.isEmpty()) {
            throw new FacilityException(HttpStatus.BAD_REQUEST, "MAP_CONFLICT",
                    "Mặt bằng chưa hợp lệ: " + String.join("; ", limit(conflicts)));
        }

        storageUnitRepository.saveAll(changed);
        floorFixtureRepository.deleteAllByFloorId(floorId);
        List<FloorFixture> savedFixtures = floorFixtureRepository.saveAll(newFixtures);

        activityLogService.log(actorUserId != null ? actorUserId : 1,
                "[FLOOR_PLAN] Lưu mặt bằng " + floor.getName() + " tại cơ sở " + floor.getFacility().getName()
                        + ": " + placedOnFloor.size() + " ô kho, " + savedFixtures.size() + " vật cố định",
                "facility_floors", String.valueOf(floorId));

        return toFloorResponse(floor, savedFixtures);
    }

    /**
     * Dùng khi tạo ô kho mới có kèm vị trí: tầng phải có mặt bằng, ô nằm trong mặt bằng
     * và không chồng ô khác / vật cố định.
     */
    @Transactional(readOnly = true)
    public void validateNewUnitPlacement(Integer facilityId, String floorName, StorageUnit candidate) {
        FacilityFloor floor = facilityFloorRepository.findByFacility_IdAndNameIgnoreCase(facilityId, floorName.trim())
                .orElseThrow(() -> new FacilityException(HttpStatus.BAD_REQUEST, "FLOOR_HAS_NO_MAP",
                        "Tầng \"" + floorName + "\" chưa có mặt bằng, hãy tạo mặt bằng trước khi đặt vị trí"));
        candidate.setFloor(floor.getName());

        List<StorageUnit> placed = new ArrayList<>(unitsOnFloor(facilityId, floor.getName()).stream()
                .filter(StorageUnit::isPlacedOnMap)
                .toList());
        placed.add(candidate);
        List<String> conflicts = findConflicts(floor, placed, floorFixtureRepository.findByFloor_IdOrderByIdAsc(floor.getId()));
        if (!conflicts.isEmpty()) {
            throw new FacilityException(HttpStatus.BAD_REQUEST, "MAP_CONFLICT",
                    "Vị trí chưa hợp lệ: " + String.join("; ", limit(conflicts)));
        }
    }

    // ──────────────────────────────────────────────────────
    // Vị trí ô theo hợp đồng (khách / nhân viên chỉ xem)
    // ──────────────────────────────────────────────────────

    // Khách chỉ xem khi hợp đồng còn giữ ô
    public static final List<String> CUSTOMER_VISIBLE_STATUSES =
            List.of("PENDING_CHECK_IN", "ACTIVE", "OVERDUE", "TERMINATION_PENDING");

    /**
     * UC-06: Vị trí ô của hợp đồng trên mặt bằng tầng, kèm 1 dòng chỉ dẫn.
     * Ô khác trên tầng chỉ trả hình khối (không mã, không trạng thái) để khách không biết ô nào đang có người thuê.
     * customerView = true: hợp đồng đã kết thúc → 409 CONTRACT_NOT_ACTIVE. Staff / FM xem mọi trạng thái.
     */
    @Transactional(readOnly = true)
    public UnitLocationResponse getUnitLocation(RentalContract contract, boolean customerView) {
        if (customerView && !CUSTOMER_VISIBLE_STATUSES.contains(contract.getStatus())) {
            throw new ContractException(HttpStatus.CONFLICT, "CONTRACT_NOT_ACTIVE",
                    "Hợp đồng đã kết thúc nên không còn xem được vị trí ô kho");
        }
        StorageUnit unit = contract.getStorageUnit();
        Facility facility = unit.getFacility();
        UnitLocationResponse.UnitLocationResponseBuilder builder = UnitLocationResponse.builder()
                .contractId(contract.getId())
                .unitId(unit.getId())
                .unitTypeName(unit.getUnitType() != null ? unit.getUnitType().getName() : null)
                .areaSqm(unit.getUnitType() != null ? unit.getUnitType().getAreaSqm() : null)
                .facilityName(facility.getName())
                .floor(unit.getFloor())
                .zone(unit.getZone())
                .roomNumber(unit.getRoomNumber());

        Optional<FacilityFloor> floorOpt = unit.isPlacedOnMap() && unit.getFloor() != null
                ? facilityFloorRepository.findByFacility_IdAndNameIgnoreCase(facility.getId(), unit.getFloor().trim())
                : Optional.empty();
        if (floorOpt.isEmpty()) {
            return builder.placed(false).locationHint(locationHint(unit, null)).build();
        }

        FacilityFloor floor = floorOpt.get();
        List<FloorFixture> fixtures = floorFixtureRepository.findByFloor_IdOrderByIdAsc(floor.getId());
        List<UnitLocationResponse.Rect> otherUnits = unitsOnFloor(facility.getId(), floor.getName()).stream()
                .filter(u -> u.isPlacedOnMap() && !u.getId().equals(unit.getId()))
                .sorted(Comparator.comparing(StorageUnit::getMapY).thenComparing(StorageUnit::getMapX))
                .map(FloorPlanService::toLocationRect)
                .toList();

        return builder
                .placed(true)
                .unit(toLocationRect(unit))
                .door(unit.getMapDoor())
                .locationHint(locationHint(unit, fixtureInFrontOfDoor(unit, fixtures)))
                .floorPlan(UnitLocationResponse.FloorPlan.builder()
                        .name(floor.getName())
                        .gridWidth(floor.getGridWidth())
                        .gridHeight(floor.getGridHeight())
                        .cellMeters(CELL_METERS)
                        .fixtures(fixtures.stream().map(FloorPlanService::toFixtureDto).toList())
                        .otherUnits(otherUnits)
                        .build())
                .build();
    }

    // Vật cố định ngay trước cửa ô (dải 1 ô lưới sát cạnh có cửa), thường là lối đi
    static FloorFixture fixtureInFrontOfDoor(StorageUnit u, List<FloorFixture> fixtures) {
        String door = u.getMapDoor() != null ? u.getMapDoor() : "BOTTOM";
        Rect strip = switch (door) {
            case "TOP" -> new Rect(u.getMapX(), u.getMapY() - 1, u.getMapW(), 1);
            case "LEFT" -> new Rect(u.getMapX() - 1, u.getMapY(), 1, u.getMapH());
            case "RIGHT" -> new Rect(u.getMapX() + u.getMapW(), u.getMapY(), 1, u.getMapH());
            default -> new Rect(u.getMapX(), u.getMapY() + u.getMapH(), u.getMapW(), 1);
        };
        return fixtures.stream().filter(f -> strip.overlaps(rectOf(f))).findFirst().orElse(null);
    }

    // "Tầng 1 · Khu A · Phòng 103 · cửa quay ra Lối đi A – B"
    static String locationHint(StorageUnit u, FloorFixture inFront) {
        List<String> parts = new ArrayList<>();
        if (u.getFloor() != null && !u.getFloor().isBlank()) parts.add(u.getFloor().trim());
        if (u.getZone() != null && !u.getZone().isBlank()) parts.add("Khu " + u.getZone().trim());
        if (u.getRoomNumber() != null && !u.getRoomNumber().isBlank()) parts.add("Phòng " + u.getRoomNumber().trim());
        if (inFront != null) {
            String name = inFront.getLabel() != null ? inFront.getLabel() : fixtureName(inFront);
            parts.add("cửa quay ra " + name);
        }
        return String.join(" · ", parts);
    }

    private static UnitLocationResponse.Rect toLocationRect(StorageUnit u) {
        return UnitLocationResponse.Rect.builder().x(u.getMapX()).y(u.getMapY()).w(u.getMapW()).h(u.getMapH()).build();
    }

    // Đặt vị trí cho ô (kích thước bỏ trống = mặc định theo loại kho, cửa bỏ trống = giữ cũ hoặc BOTTOM)
    void applyPlacement(StorageUnit unit, UnitPlacementDto p, String floorName) {
        int[] size = defaultSize(unit.getUnitType());
        int w = p.getW() != null ? p.getW() : size[0];
        int h = p.getH() != null ? p.getH() : size[1];
        if (p.getY() == null) {
            throw new FacilityException(HttpStatus.BAD_REQUEST, "INVALID_POSITION", "Ô kho " + unit.getId() + " thiếu toạ độ y");
        }
        if (w < 1 || h < 1 || w > MAX_ITEM_CELLS || h > MAX_ITEM_CELLS) {
            throw new FacilityException(HttpStatus.BAD_REQUEST, "INVALID_SIZE", "Kích thước ô kho " + unit.getId() + " không hợp lệ");
        }
        String door = p.getDoor() != null ? p.getDoor().trim().toUpperCase()
                : (unit.getMapDoor() != null ? unit.getMapDoor() : "BOTTOM");
        if (!DOOR_SIDES.contains(door)) {
            throw new FacilityException(HttpStatus.BAD_REQUEST, "INVALID_DOOR_SIDE", "Phía cửa phải là TOP / BOTTOM / LEFT / RIGHT");
        }
        unit.setFloor(floorName);
        unit.setMapX(p.getX());
        unit.setMapY(p.getY());
        unit.setMapW(w);
        unit.setMapH(h);
        unit.setMapDoor(door);
    }

    private FloorFixture toFixture(FloorFixtureDto dto, FacilityFloor floor) {
        String type = dto.getType().trim().toUpperCase();
        if (!FIXTURE_TYPES.contains(type)) {
            throw new FacilityException(HttpStatus.BAD_REQUEST, "INVALID_FIXTURE_TYPE",
                    "Loại vật cố định không hợp lệ: " + dto.getType());
        }
        if (dto.getW() < 1 || dto.getH() < 1 || dto.getW() > 200 || dto.getH() > 200) {
            throw new FacilityException(HttpStatus.BAD_REQUEST, "INVALID_SIZE", "Kích thước vật cố định không hợp lệ");
        }
        String label = dto.getLabel() != null && !dto.getLabel().isBlank() ? dto.getLabel().trim() : null;
        if (label != null && label.length() > 50) {
            label = label.substring(0, 50);
        }
        return FloorFixture.builder()
                .floor(floor)
                .fixtureType(type)
                .label(label)
                .mapX(dto.getX())
                .mapY(dto.getY())
                .mapW(dto.getW())
                .mapH(dto.getH())
                .build();
    }

    // Liệt kê lỗi: ô / vật cố định ra ngoài mặt bằng, 2 ô chồng nhau, ô đè lên vật cố định
    List<String> findConflicts(FacilityFloor floor, List<StorageUnit> units, List<FloorFixture> fixtures) {
        List<String> conflicts = new ArrayList<>();
        int gw = floor.getGridWidth();
        int gh = floor.getGridHeight();

        for (FloorFixture f : fixtures) {
            if (!rectOf(f).inside(gw, gh)) {
                conflicts.add(fixtureName(f) + " nằm ngoài mặt bằng");
            }
        }
        for (int i = 0; i < units.size(); i++) {
            StorageUnit a = units.get(i);
            Rect ra = rectOf(a);
            if (!ra.inside(gw, gh)) {
                conflicts.add(a.getId() + " nằm ngoài mặt bằng");
            }
            for (int j = i + 1; j < units.size(); j++) {
                StorageUnit b = units.get(j);
                if (ra.overlaps(rectOf(b))) {
                    conflicts.add(a.getId() + " chồng lên " + b.getId());
                }
            }
            for (FloorFixture f : fixtures) {
                if (ra.overlaps(rectOf(f))) {
                    conflicts.add(a.getId() + " đè lên " + fixtureName(f));
                }
            }
        }
        return conflicts;
    }

    // ──────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────

    private FacilityFloor findFloor(Integer floorId) {
        return facilityFloorRepository.findById(floorId)
                .orElseThrow(() -> new FacilityException(HttpStatus.NOT_FOUND, "FLOOR_NOT_FOUND", "Không tìm thấy mặt bằng ID: " + floorId));
    }

    private List<StorageUnit> unitsOnFloor(Integer facilityId, String floorName) {
        return storageUnitRepository.findByFacility_Id(facilityId).stream()
                .filter(u -> sameFloor(u.getFloor(), floorName))
                .toList();
    }

    private static boolean sameFloor(String unitFloor, String floorName) {
        return unitFloor != null && unitFloor.trim().equalsIgnoreCase(floorName.trim());
    }

    private static Rect rectOf(StorageUnit u) {
        return new Rect(u.getMapX(), u.getMapY(), u.getMapW(), u.getMapH());
    }

    private static Rect rectOf(FloorFixture f) {
        return new Rect(f.getMapX(), f.getMapY(), f.getMapW(), f.getMapH());
    }

    private static String fixtureName(FloorFixture f) {
        String typeName = switch (f.getFixtureType()) {
            case "AISLE" -> "lối đi";
            case "ENTRANCE" -> "cửa vào";
            case "STAIRS" -> "thang bộ";
            case "ELEVATOR" -> "thang máy";
            case "OFFICE" -> "văn phòng";
            default -> f.getFixtureType();
        };
        return f.getLabel() != null ? typeName + " \"" + f.getLabel() + "\"" : typeName;
    }

    private static List<String> limit(List<String> items) {
        if (items.size() <= 5) {
            return items;
        }
        List<String> head = new ArrayList<>(items.subList(0, 5));
        head.add("và " + (items.size() - 5) + " lỗi khác");
        return head;
    }

    private static String meters(int cells) {
        double m = cells * CELL_METERS;
        return m == Math.floor(m) ? String.valueOf((int) m) : String.valueOf(m);
    }

    private FloorLayoutResponse toFloorResponse(FacilityFloor floor, List<FloorFixture> fixtures) {
        return FloorLayoutResponse.builder()
                .id(floor.getId())
                .name(floor.getName())
                .gridWidth(floor.getGridWidth())
                .gridHeight(floor.getGridHeight())
                .sortOrder(floor.getSortOrder())
                .fixtures(fixtures.stream().map(FloorPlanService::toFixtureDto).toList())
                .build();
    }

    private static FloorFixtureDto toFixtureDto(FloorFixture f) {
        return FloorFixtureDto.builder()
                .id(f.getId())
                .type(f.getFixtureType())
                .label(f.getLabel())
                .x(f.getMapX())
                .y(f.getMapY())
                .w(f.getMapW())
                .h(f.getMapH())
                .build();
    }
}
