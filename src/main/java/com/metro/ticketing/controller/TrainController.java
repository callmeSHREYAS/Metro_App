package com.metro.ticketing.controller;

import com.metro.ticketing.entity.Train;
import com.metro.ticketing.repository.TrainRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/trains")
public class TrainController {

    private final TrainRepository trainRepository;

    public TrainController(TrainRepository trainRepository) {
        this.trainRepository = trainRepository;
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<Train> createTrain(@Valid @RequestBody Train request) {
        Train train = new Train();
        train.setTrainId("TRN-" + UUID.randomUUID());
        copyTrainFields(request, train);
        return ResponseEntity.status(HttpStatus.CREATED).body(trainRepository.save(train));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<Train> updateTrain(@PathVariable String id, @Valid @RequestBody Train request) {
        Train train = trainRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Train not found"));
        copyTrainFields(request, train);
        return ResponseEntity.ok(trainRepository.save(train));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<Train> patchTrain(@PathVariable String id, @RequestBody Train request) {
        Train train = trainRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Train not found"));
        if (request.getTrainNumber() != null) {
            if (request.getTrainNumber().isBlank()) {
                throw new IllegalArgumentException("Train number cannot be blank");
            }
            train.setTrainNumber(request.getTrainNumber());
        }
        if (request.getCapacity() != null) {
            train.setCapacity(request.getCapacity());
        }
        if (request.getTotalCoaches() != null) {
            train.setTotalCoaches(request.getTotalCoaches());
        }
        if (request.getManufactureYear() != null) {
            train.setManufactureYear(request.getManufactureYear());
        }
        if (request.getIsActive() != null) {
            train.setIsActive(request.getIsActive());
        }
        return ResponseEntity.ok(trainRepository.save(train));
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<Train> getTrainById(@PathVariable String id) {
        Train train = trainRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Train not found"));
        return ResponseEntity.ok(train);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Train>> getAllTrains() {
        return ResponseEntity.ok(trainRepository.findAll());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<Void> deleteTrain(@PathVariable String id) {
        if (!trainRepository.existsById(id)) {
            throw new IllegalArgumentException("Train not found");
        }
        trainRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private void copyTrainFields(Train request, Train train) {
        train.setTrainNumber(request.getTrainNumber());
        train.setCapacity(request.getCapacity());
        train.setTotalCoaches(request.getTotalCoaches());
        train.setManufactureYear(request.getManufactureYear());
        if (request.getIsActive() != null) {
            train.setIsActive(request.getIsActive());
        }
    }
}
