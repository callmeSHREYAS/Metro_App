package com.metro.ticketing.controller;

import com.metro.ticketing.entity.Route;
import com.metro.ticketing.entity.Schedule;
import com.metro.ticketing.entity.Train;
import com.metro.ticketing.repository.RouteRepository;
import com.metro.ticketing.repository.ScheduleRepository;
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
@RequestMapping("/api/schedules")
public class ScheduleController {

    private final ScheduleRepository scheduleRepository;
    private final RouteRepository routeRepository;
    private final TrainRepository trainRepository;

    public ScheduleController(ScheduleRepository scheduleRepository,
                              RouteRepository routeRepository,
                              TrainRepository trainRepository) {
        this.scheduleRepository = scheduleRepository;
        this.routeRepository = routeRepository;
        this.trainRepository = trainRepository;
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<Schedule> createSchedule(@Valid @RequestBody Schedule request) {
        validateTimes(request);
        if (scheduleRepository.hasOverlappingSchedule(
                request.getTrainId(), request.getScheduledDeparture(), request.getScheduledArrival(), null)) {
            throw new IllegalArgumentException("Train is already scheduled during this time period");
        }

        Schedule schedule = new Schedule();
        schedule.setScheduleId("SCH-" + UUID.randomUUID());
        copyScheduleFields(request, schedule);
        return ResponseEntity.status(HttpStatus.CREATED).body(scheduleRepository.save(schedule));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<Schedule> updateSchedule(@PathVariable String id, @Valid @RequestBody Schedule request) {
        Schedule schedule = scheduleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Schedule not found"));

        validateTimes(request);
        if (scheduleRepository.hasOverlappingSchedule(
                request.getTrainId(), request.getScheduledDeparture(), request.getScheduledArrival(), id)) {
            throw new IllegalArgumentException("Train is already scheduled during this time period");
        }

        copyScheduleFields(request, schedule);
        return ResponseEntity.ok(scheduleRepository.save(schedule));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<Schedule> patchSchedule(@PathVariable String id, @RequestBody Schedule request) {
        Schedule schedule = scheduleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Schedule not found"));

        Schedule patch = new Schedule();
        patch.setTrainId(request.getTrainId() != null
                ? request.getTrainId() : schedule.getTrain().getTrainId());
        patch.setRouteId(request.getRouteId() != null
                ? request.getRouteId() : schedule.getRoute().getRouteId());
        patch.setScheduledDeparture(request.getScheduledDeparture() != null
                ? request.getScheduledDeparture() : schedule.getScheduledDeparture());
        patch.setScheduledArrival(request.getScheduledArrival() != null
                ? request.getScheduledArrival() : schedule.getScheduledArrival());
        patch.setDayOfWeek(request.getDayOfWeek() != null ? request.getDayOfWeek() : schedule.getDayOfWeek());
        patch.setValidFrom(request.getValidFrom() != null ? request.getValidFrom() : schedule.getValidFrom());
        patch.setValidTo(request.getValidTo() != null ? request.getValidTo() : schedule.getValidTo());
        patch.setIsActive(request.getIsActive() != null ? request.getIsActive() : schedule.getIsActive());

        validateTimes(patch);
        if (scheduleRepository.hasOverlappingSchedule(
                patch.getTrainId(), patch.getScheduledDeparture(), patch.getScheduledArrival(), id)) {
            throw new IllegalArgumentException("Train is already scheduled during this time period");
        }

        copyScheduleFields(patch, schedule);
        if (request.getValidFrom() != null) {
            schedule.setValidFrom(request.getValidFrom());
        }
        if (request.getValidTo() != null) {
            schedule.setValidTo(request.getValidTo());
        }
        return ResponseEntity.ok(scheduleRepository.save(schedule));
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<Schedule> getScheduleById(@PathVariable String id) {
        Schedule schedule = scheduleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Schedule not found"));
        return ResponseEntity.ok(schedule);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Schedule>> getAllSchedules() {
        return ResponseEntity.ok(scheduleRepository.findAll());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<Void> deleteSchedule(@PathVariable String id) {
        if (!scheduleRepository.existsById(id)) {
            throw new IllegalArgumentException("Schedule not found");
        }
        scheduleRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private void validateTimes(Schedule request) {
        if (request.getScheduledArrival().isBefore(request.getScheduledDeparture())) {
            throw new IllegalArgumentException("Arrival time cannot be before departure time");
        }
    }

    private void copyScheduleFields(Schedule request, Schedule schedule) {
        if (request.getRouteId() == null || request.getTrainId() == null) {
            throw new IllegalArgumentException("Train and route are required");
        }
        Route route = routeRepository.findById(request.getRouteId())
                .orElseThrow(() -> new IllegalArgumentException("Route not found"));
        Train train = trainRepository.findById(request.getTrainId())
                .orElseThrow(() -> new IllegalArgumentException("Train not found"));

        schedule.setRoute(route);
        schedule.setTrain(train);
        schedule.setScheduledDeparture(request.getScheduledDeparture());
        schedule.setScheduledArrival(request.getScheduledArrival());
        schedule.setDayOfWeek(request.getDayOfWeek());
        if (request.getIsActive() != null) {
            schedule.setIsActive(request.getIsActive());
        }
    }
}
