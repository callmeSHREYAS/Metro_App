package com.metro.ticketing.controller;

import com.metro.ticketing.entity.Role;
import com.metro.ticketing.entity.Station;
import com.metro.ticketing.entity.User;
import com.metro.ticketing.exception.ResourceNotFoundException;
import com.metro.ticketing.repository.StationRepository;
import com.metro.ticketing.repository.UserRepository;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@Tag(name = "User Management", description = "APIs for User CRUD operations")
@SecurityRequirement(name = "basicAuth")
public class UserController {

    private final UserRepository userRepository;
    private final StationRepository stationRepository;
    private final PasswordEncoder passwordEncoder;

    public UserController(UserRepository userRepository,
                          StationRepository stationRepository,
                          PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.stationRepository = stationRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<User> createUser(@Valid @RequestBody User request) {
        if (request.getContact() != null && userRepository.findByContact(request.getContact()).isPresent()) {
            throw new IllegalArgumentException("User with this contact already exists.");
        }
        if (request.getRole() == null) {
            throw new IllegalArgumentException("Role is required.");
        }
        if (request.getPassword() == null || request.getPassword().isBlank()) {
            throw new IllegalArgumentException("Password is required.");
        }

        User user = new User();
        String prefix = switch (request.getRole()) {
            case PASSENGER -> "PASS";
            case ADMIN -> "ADMIN";
            case TICKET_AGENT, MAINTENANCE_STAFF -> "EMP";
        };
        user.setUserId(prefix + "-" + UUID.randomUUID());
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setContact(request.getContact());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(request.getRole());
        user.setRegistrationDate(request.getRegistrationDate() != null ? request.getRegistrationDate() : LocalDate.now());
        if (request.getIsActive() != null) {
            user.setIsActive(request.getIsActive());
        } else {
            user.setIsActive(true);
        }
        user.setHireDate(request.getHireDate());

        if (request.getStationId() != null && !request.getStationId().isBlank()) {
            Station station = stationRepository.findById(request.getStationId())
                    .orElseThrow(() -> new IllegalArgumentException("Station not found with id: " + request.getStationId()));
            user.setStation(station);
        }

        User saved = userRepository.save(user);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional(readOnly = true)
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userRepository.findAll());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional(readOnly = true)
    public ResponseEntity<User> getUserById(@PathVariable String id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
        return ResponseEntity.ok(user);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<User> updateUser(@PathVariable String id, @RequestBody User request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));

        if (request.getFirstName() != null && !request.getFirstName().isBlank()) {
            user.setFirstName(request.getFirstName());
        }
        if (request.getLastName() != null && !request.getLastName().isBlank()) {
            user.setLastName(request.getLastName());
        }
        if (request.getContact() != null && !request.getContact().isBlank()) {
            if (!request.getContact().equals(user.getContact()) && userRepository.findByContact(request.getContact()).isPresent()) {
                throw new IllegalArgumentException("User with this contact already exists.");
            }
            user.setContact(request.getContact());
        }
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            user.setPassword(passwordEncoder.encode(request.getPassword()));
        }
        if (request.getRole() != null) {
            user.setRole(request.getRole());
        }
        if (request.getIsActive() != null) {
            user.setIsActive(request.getIsActive());
        }
        if (request.getHireDate() != null) {
            user.setHireDate(request.getHireDate());
        }
        if (request.getStationId() != null) {
            if (request.getStationId().isBlank()) {
                user.setStation(null);
            } else {
                Station station = stationRepository.findById(request.getStationId())
                        .orElseThrow(() -> new IllegalArgumentException("Station not found with id: " + request.getStationId()));
                user.setStation(station);
            }
        }

        User updated = userRepository.save(user);
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<User> patchUser(@PathVariable String id, @RequestBody User request) {
        return updateUser(id, request);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<Void> deleteUser(@PathVariable String id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
        userRepository.delete(user);
        return ResponseEntity.noContent().build();
    }
}
