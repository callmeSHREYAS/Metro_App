# Metro Ticketing App — Complete Codebase Guide (Viva Edition)

This guide explains the **current simplified codebase**: no Lombok, no DTO folder, no service layer, no JWT. Use it to answer any question an external evaluator asks.

Stack: Java 21, Spring Boot 4.1, Spring Web MVC, Spring Data JPA + Hibernate, Spring Security (HTTP Basic), PostgreSQL, Flyway, SpringDoc OpenAPI, Maven.

---

## 1. The 30-second answer

This is a **Spring Boot REST API with an integrated browser dashboard**. The dashboard is served by the same application, calls the existing API routes, and adapts its navigation to the signed-in user's role.

```
Client (Swagger / curl / browser)
   -- HTTP Basic username:password -->
Security filter chain
   --> Controller (validation, @PreAuthorize, business logic, @Transactional)
   --> Repository (Spring Data JPA)
   --> PostgreSQL
```

- `controller/` — all business logic and HTTP endpoints
- `entity/` — JPA table mappings, also used as request/response bodies
- `repository/` — database access only
- `config/` — security, seeding, Flyway, OpenAPI
- `exception/` — one global JSON error handler
- `db/migration/` — Flyway schema versions

Entry point: `src/main/java/com/metro/ticketing/TicketingApplication.java` — `@SpringBootApplication` + `SpringApplication.run(...)`.

Live API: `http://localhost:8081`
Dashboard: `http://localhost:8081/`
Swagger: `http://localhost:8081/swagger-ui/index.html`

---

## 2. Folder and file tour

```
src/main/java/com/metro/ticketing/
├── TicketingApplication.java        Startup class
├── config/
│   ├── SecurityConfig.java          HTTP Basic, URL rules, BCrypt, method security
│   ├── DbUserDetailsService.java    Loads a User row and converts it to Spring's UserDetails
│   ├── DataSeeder.java              Creates admin if missing + demo data if DB is empty
│   ├── FlywayConfig.java            Runs Flyway migrations before JPA starts
│   └── OpenApiConfig.java           Swagger title + Basic Auth scheme
├── controller/                      10 REST controllers (business logic lives here)
│   ├── AuthController.java          Register passenger, hire employee, current user
│   ├── StationController.java       Stations CRUD
│   ├── TrainController.java         Trains CRUD
│   ├── RouteController.java         Routes + ordered route stops
│   ├── ScheduleController.java      Timetables + overlap check
│   ├── FareController.java          Fare CRUD + source/destination lookup
│   ├── TicketController.java        Book/read/use/delete tickets + ownership
│   ├── MetroCardController.java     Issue/top-up/read/deactivate cards
│   ├── PaymentController.java       Pay for a ticket + ownership
│   └── MaintenanceIssueController.java  Report/update/resolve faults
├── entity/                          11 JPA entities + Role enum
│   ├── User.java, Role.java
│   ├── Station.java, Train.java
│   ├── Route.java, RouteStation.java
│   ├── Schedule.java, Fare.java, Ticket.java
│   ├── Payment.java, MetroCard.java, MaintenanceIssue.java
├── repository/                      11 interfaces extending JpaRepository
└── exception/
    └── GlobalExceptionHandler.java  Converts exceptions to JSON + HTTP status

src/main/resources/
├── application.properties           DB, JPA, admin bootstrap
├── static/
│   ├── index.html                    Responsive MetroFlow dashboard
│   └── assets/                       Dashboard styles and API client
└── db/migration/
    ├── V1__create_metro_ticketing_schema.sql
    ├── V2__prevent_duplicate_fare_station_pairs.sql
    ├── V3__add_auth_lifecycle_tables.sql        (historical JWT tables)
    ├── V4__widen_auth_token_columns.sql         (historical JWT tables)
    ├── V5__drop_unused_auth_token_tables.sql
    └── V6__replace_route_station_composite_key.sql
```

**What each layer is responsible for**

| Layer | Responsibility | Must NOT do |
| --- | --- | --- |
| Controller | URL mapping, validation, role check, business rules, transactions | Write SQL |
| Entity | Table/column mapping, field validation | Call repositories |
| Repository | Find/save/delete/count queries | Business decisions |
| Config | Startup wiring | Handle HTTP requests |
| Exception handler | Uniform error JSON | Business logic |

---

## 3. Spring Boot concepts used and why

### 3.1 `@SpringBootApplication` and auto-configuration

`TicketingApplication.java:6` combines:

- `@Configuration` — this class can define beans
- `@EnableAutoConfiguration` — Boot configures Tomcat, DataSource, Hibernate, Security, JSON, Swagger from the classpath
- `@ComponentScan` — finds `@RestController`, `@Service`, `@Configuration`, `@Entity`

Why: we do not manually create a server, connection pool or `EntityManagerFactory`.

### 3.2 Dependency injection

No class does `new StationRepository()`. Spring creates one instance and passes it through the constructor.

Example `TicketController`:

```java
public TicketController(TicketRepository ticketRepository,
                        UserRepository userRepository,
                        StationRepository stationRepository,
                        FareRepository fareRepository) { ... }
```

Why constructor injection: the object is always fully initialized, fields are `final`, and dependencies are explicit.

### 3.3 Spring Web MVC

- `@RestController` = controller + JSON response body.
- `@RequestMapping("/api/tickets")` = base path.
- `@GetMapping`, `@PostMapping`, `@PutMapping`, `@PatchMapping`, `@DeleteMapping` = HTTP methods.
- `@PathVariable` reads `/api/tickets/{id}`.
- `@RequestParam` reads query values, e.g. fare lookup and card top-up.
- `@RequestBody` converts JSON to an entity.
- `@Valid` triggers Bean Validation before the method body runs.
- `ResponseEntity<T>` controls status: `200`, `201 Created`, `204 No Content`.

Why MVC: standard HTTP semantics; Swagger can read the annotations and generate documentation automatically.

### 3.4 Bean Validation

Validation annotations live on entity fields:

- `@NotBlank` — required text: names, contact, station code, train number, ticket type, issue type, description
- `@NotNull` — required numbers/dates: fare, amount, schedule times
- `@DecimalMin("0.01")` — positive money values

`@Valid` on a controller parameter triggers validation. A failure throws `MethodArgumentNotValidException`, caught by `GlobalExceptionHandler`, which returns `400` with `{field: message}`.

Important viva point: Hibernate validates entities again at persist time. Therefore **request-only `@Transient` fields must not carry `@NotBlank`**, otherwise saving fails because those fields are null on the entity. Those checks are done manually in the controller.

### 3.5 Spring Data JPA + Hibernate

- `@Entity` + `@Table(name = "\"Stations\"")` maps a class to a table.
- Quoted names preserve exact uppercase/camel-case column names, together with `PhysicalNamingStrategyStandardImpl`.
- `@Id` is a `String` generated by the controller (`"STN-" + UUID`), not by the database. Why: readable IDs in logs and demos.
- `@ManyToOne(fetch = FetchType.LAZY)` models foreign keys: `Ticket -> User`, `Ticket -> Fare`, `Ticket -> Station`, `Route -> Station`, etc.
- `RouteStation` uses a generated `RouteStationID` primary key and a unique constraint on `(RouteID, StationID)` for ordered route stops.
- `@Transient` fields (`passengerId`, `sourceStationId`, `trainId`, `stationId`, `stationIds`) carry IDs in JSON but are **not columns**. This keeps request JSON flat.
- `@JsonProperty(access = WRITE_ONLY)` on `User.password` accepts a password but never returns it.
- `@JsonProperty(access = READ_ONLY)` on relations prevents clients from overwriting associations with nested objects.
- `@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})` prevents Hibernate proxy internals from appearing in JSON.

Repositories extend `JpaRepository<Entity, IdType>` and get `save`, `findById`, `findAll`, `existsById`, `deleteById` for free. Custom queries use derived method names:

- `UserRepository.findByContact`
- `FareRepository.findBySourceStation_StationIdAndDestStation_StationId`
- `TicketRepository.findByPassenger_UserId`
- `MetroCardRepository.findByPassenger_UserIdAndIsActiveTrue`
- `MaintenanceIssueRepository.findByStatus`
- `RouteStationRepository.findByRoute_RouteIdOrderBySequenceNumberAsc`
- `ScheduleRepository.hasOverlappingSchedule` — the only explicit `@Query`

Why: no SQL strings, no manual mapping, less code to explain.

#### How `RouteStation` identifies a row

`RouteStations` is the ordered list of stations on a route. Each row has:

- `RouteStationID` — a generated primary key (`RS-<uuid>`)
- `RouteID` — foreign key to `Route`
- `StationID` — foreign key to `Station`
- `SequenceNumber` — the stop order

The original schema used a composite primary key `(RouteID, StationID)` and required a separate `@Embeddable` key class. Migration `V6` replaced that with the single `RouteStationID` key, so the extra key class was deleted.

The rule “one station cannot appear twice on the same route” is still enforced, now by a unique constraint on `(RouteID, StationID)`.

```sql
CONSTRAINT "uq_route_station" UNIQUE ("RouteID", "StationID")
```

This is simpler to follow: one class, one ID, plus a database-level uniqueness rule.

### 3.6 Transactions

`@Transactional` is on controller write methods; read methods use `@Transactional(readOnly = true)`.

Example `TicketController.createTicket`:

1. Validate source/destination.
2. Resolve passenger, stations and fare.
3. Save the ticket.
4. If any step throws, the whole operation rolls back.

`readOnly = true` tells Hibernate no dirty checking is needed, which is a small optimization. `open-in-view=true` keeps the Hibernate session open while Jackson serializes lazy relations, so responses do not crash with `LazyInitializationException`.

### 3.7 Spring Security with HTTP Basic

`SecurityConfig.java`:

- `@EnableWebSecurity` — activates the filter chain.
- `@EnableMethodSecurity` — enables `@PreAuthorize`.
- `csrf` disabled — this is a stateless API, no browser cookies/sessions.
- `permitAll` — passenger registration, Swagger, OpenAPI, `/error`.
- `hasRole("ADMIN")` — hiring employees at the URL level.
- `anyRequest().authenticated()` — everything else requires a login.
- `httpBasic(...)` — browser/Swagger/curl prompt for username and password.
- `SessionCreationPolicy.STATELESS` — no `JSESSIONID`; credentials are sent on each request.
- `DaoAuthenticationProvider` + `BCryptPasswordEncoder` — loads the user and compares the BCrypt hash.

`DbUserDetailsService.java`:

```java
User user = userRepository.findByContact(contact).orElseThrow(...);
return User.withUsername(user.getContact())
        .password(user.getPassword())
        .roles(user.getRole().name())
        .disabled(!Boolean.TRUE.equals(user.getIsActive()))
        .build();
```

`roles("ADMIN")` automatically creates the authority `ROLE_ADMIN`, which is what `@PreAuthorize("hasRole('ADMIN')")` expects.

Why Basic auth: it preserves database users, password hashing and roles without JWT classes, filters, refresh tokens or password-reset tables.

### 3.8 `@PreAuthorize` rules

Examples:

- `hasRole('ADMIN')` — create/update/delete stations, trains, routes, schedules, fares, hiring.
- `hasAnyRole('PASSENGER', 'TICKET_AGENT', 'ADMIN')` — book tickets, use tickets, create/top up cards.
- `hasAnyRole('ADMIN', 'TICKET_AGENT')` — list all tickets/cards/payments.
- `hasAnyRole('ADMIN', 'MAINTENANCE_STAFF')` — resolve maintenance issues.

URL rules in `SecurityConfig` are the coarse gate; `@PreAuthorize` is the per-method rule.

### 3.9 Ownership checks

Role is not always enough. A `PASSENGER` must only see their own data. Controllers use the injected `Authentication`:

```java
private boolean isPassenger(Authentication authentication) {
    return authentication.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_PASSENGER"));
}

private User currentUser(Authentication authentication) {
    return userRepository.findByContact(authentication.getName()).orElseThrow(...);
}
```

Then:

```java
if (isPassenger(authentication) && !ticket.getPassenger().getUserId().equals(currentUser(authentication).getUserId())) {
    throw new AccessDeniedException("You can only access your own tickets");
}
```

This is used in `TicketController`, `MetroCardController` and `PaymentController`.

### 3.10 Global exception handling

`GlobalExceptionHandler` uses `@ControllerAdvice` and `@ExceptionHandler`:

| Exception | HTTP | Body |
| --- | --- | --- |
| `MethodArgumentNotValidException` | 400 | `{field: message}` |
| `IllegalArgumentException` | 400 | `{error: message}` |
| `BadCredentialsException` | 401 | `{error: "Invalid contact or password"}` |
| `DisabledException` | 401 | `{error: "Account is inactive"}` |
| `AccessDeniedException` | 403 | `{error: "You do not have permission..."}` |
| `Exception` | 500 | `{error: "An unexpected error occurred: ..."}` |

Why: every failure looks the same to the client; controllers stay free of try/catch blocks.

### 3.11 Flyway

`FlywayConfig` runs `flyway.migrate()` at startup and registers `EntityManagerFactoryDependsOnPostProcessor`, which forces JPA to wait until migrations finish.

- `V1` creates the base schema.
- `V2` prevents duplicate fare station pairs.
- `V3`/`V4` were used by the old JWT refresh/reset tables. They are kept so Flyway validation still matches the existing database; those tables are simply unused now.
- `spring.jpa.hibernate.ddl-auto=validate` means Hibernate checks entities against the schema but never creates or alters tables.

Why Flyway: reproducible schema, version history, safe on a new machine.

### 3.12 Data seeding

`DataSeeder` implements `ApplicationRunner`, so it runs after the context is ready:

1. If the bootstrap admin contact does not exist, create it (`admin` / `admin123` by default).
2. If `stationRepository.count() > 0`, skip demo data.
3. Otherwise insert demo users, 18 Mumbai stations, 8 trains, 3 routes, 8 schedules, fares, cards, tickets, payments and maintenance issues.

Why: the evaluator can demo immediately, and the second startup is idempotent.

### 3.13 Swagger / OpenAPI

`OpenApiConfig` defines an HTTP Basic security scheme. SpringDoc scans controller annotations and generates `/v3/api-docs`; Swagger UI reads it and shows the **Authorize** button.

The resource controllers for users, stations, trains, routes, schedules, fares, and maintenance issues support partial updates with `PATCH /{id}`. Fields omitted from the request remain unchanged. Ticket use, metro-card deactivation, and maintenance resolution are action-specific PATCH operations; card top-up remains a POST action. Auth registration and payment records are not generic update resources.

---

## 4. Why the "missing" folders are missing

These are the answers to use if the external evaluator questions the design.

### "Why is there no DTO folder?"

> Repositories handle database access, and entities map tables. Since this project is intentionally kept to the concepts covered in class, entities are also used as request/response bodies. We keep it safe by making `User.password` write-only, making relations read-only, and using `@Transient` fields for foreign-key IDs that are not columns.

Trade-off to admit honestly: the API is coupled to the database model, and responses contain nested objects. For a larger production system, DTOs would be better.

### "Why is there no service layer?"

> The professor asked us to avoid layers outside the syllabus. Business logic is in the controllers, and `@Transactional` is applied on controller methods. Repositories still isolate all database access, so controllers do not contain SQL.

Trade-off: controllers are longer. For a bigger system, services would separate HTTP concerns from business rules.

### "Why no Lombok?"

> Getters, setters and constructors are written explicitly so we can explain every line. Removing Lombok also removes an annotation processor from the build.

### "Why HTTP Basic and not JWT?"

> Authentication is not part of the current syllabus. Basic auth keeps the same database users, BCrypt hashes and role checks without JWT filters, token expiry, refresh tokens or revocation.

### "Why are entities returned directly? Is that not bad practice?"

> It is a deliberate simplification for this project size. We protect sensitive data with Jackson annotations and rely on `open-in-view` for lazy relations. We would use DTOs in a production system.

---

## 5. Technical request flow

Example: `POST /api/tickets` as `priya`.

1. **Tomcat** accepts the request on port 8080.
2. **Spring Security filter chain**
   - Reads `Authorization: Basic base64(priya:Passw0rd!)`.
   - `DaoAuthenticationProvider` calls `DbUserDetailsService.loadUserByUsername("priya")`.
   - BCrypt compares the raw password with `User.password`.
   - On success, an `Authentication` with `ROLE_PASSENGER` is placed in the `SecurityContext`.
3. **URL authorization**
   - `/api/tickets` is not public, so a valid authentication is required. Without it: `401`.
4. **Method security**
   - `@PreAuthorize("hasAnyRole('PASSENGER','TICKET_AGENT','ADMIN')")` passes. A different role gets `403`.
5. **`@Valid @RequestBody Ticket`**
   - Bean Validation checks `ticketType` and other annotated entity fields. Invalid input: `400`.
6. **`TicketController.createTicket`**
   - Checks source and destination are present and different.
   - Because the caller is a passenger, the passenger ID is taken from the authenticated user.
   - Loads passenger, source station, destination station.
   - Looks up the fare by station pair.
   - Builds the `Ticket`, generates `TKT-<uuid>`, sets times and `isUsed=false`.
   - `ticketRepository.save(ticket)`.
7. **Transaction commit**
   - `@Transactional` commits. Any exception rolls the whole operation back.
8. **Jackson**
   - Converts the entity to JSON. `open-in-view=true` allows lazy relations to load.
   - `User.password` is skipped because it is write-only.
9. **Response**
   - `201 Created` with the ticket JSON.

Error path: any `IllegalArgumentException`, validation error or access denial is converted by `GlobalExceptionHandler` into a clean JSON response.

---

## 6. Authentication flow

### Register a passenger

`POST /api/auth/passenger/register` (public):

```json
{
  "firstName": "Priya",
  "lastName": "Sharma",
  "contact": "priya2",
  "password": "Passw0rd!"
}
```

`AuthController` checks the contact is unique, BCrypt-encodes the password, forces `Role.PASSENGER`, sets dates and saves. The response never contains the password.

### Hire an employee

`POST /api/auth/employee/hire` as `admin`:

```json
{
  "firstName": "Rahul",
  "lastName": "Mehta",
  "contact": "agent2",
  "password": "Passw0rd!",
  "role": "TICKET_AGENT",
  "stationId": "STN-AND"
}
```

`@PreAuthorize("hasRole('ADMIN')")` plus the URL rule protect it. The controller validates the role and station, generates an `EMP-<uuid>` ID and saves.

### Every other request

Send Basic credentials. There is no login endpoint, no token, no session. The server checks the BCrypt hash on every request.

`GET /api/auth/me` returns the current database user.

---

## 7. Story workflow (narrate this in viva)

> "Imagine a day on the Mumbai Metro. Our API is the backend clerk behind every counter."

**Morning — the network is prepared.**
`DataSeeder` has already created the admin account and demo data. Admin logs into Swagger with Basic auth (`admin` / `admin123`). Using the same credentials, admin creates stations, trains, routes with ordered stops, schedules and the fare matrix. These write endpoints are protected by `@PreAuthorize("hasRole('ADMIN')")`; a passenger trying them receives `403`.

**Late morning — staff are hired.**
Admin calls `POST /api/auth/employee/hire` to create `agent1` (TICKET_AGENT) and `maint1` (MAINTENANCE_STAFF). Passwords are BCrypt-hashed before saving, so nobody can read them back.

**Afternoon — Priya travels.**
Priya registers with `POST /api/auth/passenger/register`, then authenticates with Basic auth. She checks the fare with `GET /api/fares/lookup?sourceStationId=...&destStationId=...`, books a ticket with `POST /api/tickets`, and pays with `POST /api/payments`. She can also use a metro card: `POST /api/cards` then `POST /api/cards/{id}/topup?amount=100`. At the gate, `PATCH /api/tickets/{id}/use` marks the ticket used; a second attempt returns `400 "Ticket already used"`, and an expired ticket is rejected.

**Afternoon — privacy is enforced.**
If Priya calls `GET /api/tickets` (all tickets), she gets `403`. If she calls another passenger's ticket ID, the ownership check throws `AccessDeniedException` and she gets `403`. Ticket, card and payment controllers all do this using the authenticated `Authentication`.

**Evening — something breaks.**
Maintenance staff report a fault with `POST /api/maintenance` (train or station, priority, description). Later they call `PATCH /api/maintenance/{id}/resolve`, which sets `status = Closed` and `resolvedAt = now`. A ticket agent can report an issue but cannot resolve it.

**Night — the system stays consistent.**
Every write is inside a transaction. If a ticket save, payment or route-stop update fails halfway, the database rolls back. Validation failures, missing records and permission errors all return clean JSON through `GlobalExceptionHandler`. Swagger documents every endpoint, and Flyway guarantees the schema is the same on every machine.

That is the whole project in one day.

---

## 8. Evaluator rapid Q&A

- **What does `@SpringBootApplication` do?** Combines configuration, auto-configuration and component scanning; `SpringApplication.run` starts Tomcat and the context.
- **Where is the main method?** `TicketingApplication.java`.
- **How does a request reach a controller?** Tomcat -> security filters -> `DispatcherServlet` -> handler mapping -> controller method.
- **What is a repository?** A Spring Data JPA interface that generates database access code.
- **What is an entity?** A class mapped to a table.
- **Why `@ManyToOne(fetch = LAZY)`?** Load related rows only when needed instead of joining everything.
- **Why `open-in-view=true`?** Keeps the session open while JSON is written, so lazy relations can be serialized.
- **What does `@Transactional` do?** Wraps the method in one database transaction; commit on success, rollback on exception.
- **How are passwords stored?** BCrypt hash via `PasswordEncoder`; never plain text.
- **How does Basic auth work?** Client sends `Authorization: Basic base64(username:password)`; Spring decodes it, loads the user and compares the BCrypt hash.
- **Where are roles checked?** `SecurityConfig` URL rules and `@PreAuthorize` on controller methods.
- **What does `hasRole('ADMIN')` expect?** An authority named `ROLE_ADMIN`; Spring adds the `ROLE_` prefix from `.roles("ADMIN")`.
- **How is a passenger restricted to own data?** `isPassenger(...)` + `currentUser(...)` + an ownership comparison in ticket/card/payment controllers.
- **Why `@Transient` fields on entities?** To accept foreign-key IDs in JSON without creating extra columns.
- **Why is `password` write-only?** `@JsonProperty(access = WRITE_ONLY)` lets registration accept it but never returns it.
- **Why are relations read-only in JSON?** To stop clients from sending nested objects that overwrite associations.
- **What happens on validation failure?** `MethodArgumentNotValidException` -> `GlobalExceptionHandler` -> `400` field map.
- **How is the schema created?** Flyway migrations V1–V6; Hibernate `ddl-auto=validate` only checks.
- **Why keep V3/V4 if JWT was removed?** They are already recorded in Flyway history on existing databases; deleting files would fail validation. V5 drops the now-unused token tables.
- **Why did RouteStations change in V6?** The composite key was replaced by a single generated `RouteStationID`; the unique constraint on `(RouteID, StationID)` keeps the old rule.
- **How is the admin created?** `DataSeeder.ensureAdminExists()` uses `app.bootstrap.admin.*` and skips if the contact exists.
- **How is demo data kept idempotent?** It skips when `stationRepository.count() > 0`.
- **How are IDs generated?** Prefix + `UUID.randomUUID()` in the controller, e.g. `TKT-...`, `PAY-...`, `CARD-...`.
- **Why use `BigDecimal` for money?** Avoids floating-point rounding errors.
- **Why compile-time error on duplicate fare?** The controller checks the repository before saving, and V2 adds a database uniqueness guarantee.
- **How would you add a new module?** Entity -> migration -> repository -> controller with `@PreAuthorize` -> seed/demo data.
- **What is the biggest trade-off?** Controllers are larger and API JSON is coupled to entities; acceptable for this project size.

---

## 9. Two-minute demo script

1. Start PostgreSQL and run `./mvnw spring-boot:run`.
2. Show `Tomcat started on port 8080`, `Flyway ... validated`, `DataSeeder ...`.
3. Open `http://localhost:8081/swagger-ui/index.html`.
4. Authorize as `admin` / `admin123`.
5. `GET /api/stations` -> data; `POST /api/stations` -> 201.
6. Re-authorize as `priya` / `Passw0rd!` in an incognito window.
7. `POST /api/tickets` -> 201; `GET /api/tickets` -> 403 to show role rules.
8. `PATCH /api/tickets/{id}/use` -> used; second call -> 400.
9. `POST /api/cards/CARD-SEED1/topup?amount=100` -> balance updated.
10. Show `src/main/resources/db/migration/` and explain Flyway + `ddl-auto=validate`.

---

## 10. Commands cheat sheet

```bash
# Run
./mvnw spring-boot:run

# Build jar
./mvnw clean package

# Admin request
curl -u admin:admin123 http://localhost:8081/api/stations

# Passenger request
curl -u priya:Passw0rd! http://localhost:8081/api/tickets/passenger/PASS-SEED1

# Register a passenger
curl -X POST http://localhost:8081/api/auth/passenger/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","contact":"test1","password":"Passw0rd!"}'
```
