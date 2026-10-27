package com.metro.ticketing.controller;

import com.metro.ticketing.entity.Fare;
import com.metro.ticketing.entity.Station;
import com.metro.ticketing.repository.FareRepository;
import com.metro.ticketing.repository.StationRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/fares")
public class FareController {

    private final FareRepository fareRepository;
    private final StationRepository stationRepository;

    public FareController(FareRepository fareRepository, StationRepository stationRepository) {
        this.fareRepository = fareRepository;
        this.stationRepository = stationRepository;
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<Fare> createFare(@Valid @RequestBody Fare request) {
        validateStationPair(request.getSourceStationId(), request.getDestStationId());

        if (fareRepository.existsBySourceStation_StationIdAndDestStation_StationId(
                request.getSourceStationId(), request.getDestStationId())) {
            throw new IllegalArgumentException("A fare for this station pair already exists");
        }

        Fare fare = new Fare();
        fare.setFareId("FARE-" + UUID.randomUUID());
        copyFareFields(request, fare);
        return ResponseEntity.status(HttpStatus.CREATED).body(fareRepository.save(fare));
    }

    @GetMapping("/lookup")
    @Transactional(readOnly = true)
    public ResponseEntity<Fare> getFareByStations(@RequestParam String sourceStationId,
                                                  @RequestParam String destStationId) {
        validateStationPair(sourceStationId, destStationId);
        Fare fare = fareRepository.findBySourceStation_StationIdAndDestStation_StationId(
                        sourceStationId, destStationId)
                .orElseThrow(() -> new IllegalArgumentException("Fare not found for this station pair"));
        return ResponseEntity.ok(fare);
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<Fare> getFareById(@PathVariable String id) {
        Fare fare = fareRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Fare not found"));
        return ResponseEntity.ok(fare);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Fare>> getAllFares() {
        return ResponseEntity.ok(fareRepository.findAll());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<Fare> updateFare(@PathVariable String id, @Valid @RequestBody Fare request) {
        Fare fare = fareRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Fare not found"));

        validateStationPair(request.getSourceStationId(), request.getDestStationId());

        if (fareRepository.existsBySourceStation_StationIdAndDestStation_StationIdAndFareIdNot(
                request.getSourceStationId(), request.getDestStationId(), id)) {
            throw new IllegalArgumentException("A fare for this station pair already exists");
        }

        copyFareFields(request, fare);
        return ResponseEntity.ok(fareRepository.save(fare));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<Fare> patchFare(@PathVariable String id, @RequestBody Fare request) {
        Fare fare = fareRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Fare not found"));
        String sourceStationId = request.getSourceStationId() != null
                ? request.getSourceStationId() : fare.getSourceStation().getStationId();
        String destStationId = request.getDestStationId() != null
                ? request.getDestStationId() : fare.getDestStation().getStationId();

        validateStationPair(sourceStationId, destStationId);
        if (fareRepository.existsBySourceStation_StationIdAndDestStation_StationIdAndFareIdNot(
                sourceStationId, destStationId, id)) {
            throw new IllegalArgumentException("A fare for this station pair already exists");
        }

        Fare patch = new Fare();
        patch.setSourceStationId(sourceStationId);
        patch.setDestStationId(destStationId);
        patch.setBaseFare(request.getBaseFare() != null ? request.getBaseFare() : fare.getBaseFare());
        if (patch.getBaseFare().signum() <= 0) {
            throw new IllegalArgumentException("Base fare must be greater than zero");
        }
        copyFareFields(patch, fare);
        return ResponseEntity.ok(fareRepository.save(fare));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<Void> deleteFare(@PathVariable String id) {
        if (!fareRepository.existsById(id)) {
            throw new IllegalArgumentException("Fare not found");
        }
        fareRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private void validateStationPair(String sourceStationId, String destStationId) {
        if (sourceStationId == null || destStationId == null) {
            throw new IllegalArgumentException("Source and destination stations are required");
        }
        if (sourceStationId.equals(destStationId)) {
            throw new IllegalArgumentException("Source and destination stations must be different");
        }
    }

    private void copyFareFields(Fare request, Fare fare) {
        Station source = stationRepository.findById(request.getSourceStationId())
                .orElseThrow(() -> new IllegalArgumentException("Source station not found"));
        Station destination = stationRepository.findById(request.getDestStationId())
                .orElseThrow(() -> new IllegalArgumentException("Destination station not found"));

        fare.setSourceStation(source);
        fare.setDestStation(destination);
        fare.setBaseFare(request.getBaseFare());
    }
}
