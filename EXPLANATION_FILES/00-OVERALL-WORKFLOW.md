# 00 — Overall Project Workflow (Read This First)

This is the master explanation file. It explains the complete project, how the layers connect, how a request travels, how authentication works, and how all 12 groups fit together. Read this first, then read the file for your assigned group.

---

## 1. What the project is

A **Metro Ticketing REST API** built with Spring Boot. It manages:

- users and roles
- stations
- trains
- routes and route stops
- schedules
- fares
- tickets
- payments
- metro cards
- maintenance issues

The application includes a responsive dashboard served by Spring Boot. The API can also be tested through **Swagger UI**, `curl`, or any HTTP client.

The application is deliberately simple:

```
HTTP Basic Auth
   -> Controller (validation + business logic + transaction)
   -> Repository (Spring Data JPA)
   -> PostgreSQL (Docker Compose for local development)
```

No Lombok, no DTO layer, no service layer, no JWT.

---

## 2. Technology stack

| Piece | Technology | What it does |
|---|---|---|
| Language | Java 21 | Runs the application |
| Framework | Spring Boot 4.1 | Auto-configures the app |
| Web | Spring Web MVC | REST controllers |
| Database access | Spring Data JPA + Hibernate | Repositories and entity mapping |
| Database | PostgreSQL | Stores all data |
| Migrations | Flyway | Creates/updates tables |
| Security | Spring Security HTTP Basic | Authentication and roles |
| Password hashing | BCrypt | Hashes passwords |
| API docs | SpringDoc OpenAPI | Swagger UI |
| Build | Maven Wrapper | `mvnw` / `mvnw.cmd` |

---

## 3. Complete folder map

```text
metro-ticketing-app/
├── pom.xml
├── mvnw
├── mvnw.cmd
├── README.md
├── CODEBASE_GUIDE.md
├── EXPLANATION_FILES/
│   ├── 00-OVERALL-WORKFLOW.md
│   ├── 01-USER.md
│   ├── 02-AUTH-AND-ROLE.md
│   ├── 03-STATION.md
│   ├── 04-TRAIN.md
│   ├── 05-ROUTE.md
│   ├── 06-ROUTE-STATION.md
│   ├── 07-SCHEDULE.md
│   ├── 08-FARE.md
│   ├── 09-TICKET.md
│   ├── 10-PAYMENT.md
│   ├── 11-METROCARD.md
│   └── 12-MAINTENANCE-ISSUE.md
└── src/main/
    ├── java/com/metro/ticketing/
    │   ├── TicketingApplication.java
    │   ├── config/
    │   │   ├── SecurityConfig.java
    │   │   ├── DbUserDetailsService.java
    │   │   ├── FlywayConfig.java
    │   │   ├── DataSeeder.java
    │   │   └── OpenApiConfig.java
    │   ├── controller/
    │   │   ├── AuthController.java
    │   │   ├── StationController.java
    │   │   ├── TrainController.java
    │   │   ├── RouteController.java
    │   │   ├── ScheduleController.java
    │   │   ├── FareController.java
    │   │   ├── TicketController.java
    │   │   ├── PaymentController.java
    │   │   ├── MetroCardController.java
    │   │   └── MaintenanceIssueController.java
    │   ├── entity/
    │   │   ├── User.java, Role.java
    │   │   ├── Station.java, Train.java
    │   │   ├── Route.java, RouteStation.java
    │   │   ├── Schedule.java, Fare.java
    │   │   ├── Ticket.java, Payment.java
    │   │   └── MetroCard.java, MaintenanceIssue.java
    │   ├── repository/
    │   │   └── 11 repository interfaces
    │   └── exception/
    │       └── GlobalExceptionHandler.java
    └── resources/
        ├── application.properties
        └── db/migration/
            ├── V1__create_metro_ticketing_schema.sql
            ├── V2__prevent_duplicate_fare_station_pairs.sql
            ├── V3__add_auth_lifecycle_tables.sql
            ├── V4__widen_auth_token_columns.sql
            ├── V5__drop_unused_auth_token_tables.sql
            └── V6__replace_route_station_composite_key.sql
```

---

## 4. The 12 groups

| # | Group | Main files | Responsibility |
|---|---|---|---|
| 1 | User | `User`, `UserRepository` | Stores identity, role, contact, station, active flag |
| 2 | Auth & Role | `Role`, `SecurityConfig`, `DbUserDetailsService`, `AuthController` | Login, register, hire, roles, passwords |
| 3 | Station | `Station`, `StationController`, `StationRepository` | Metro stations |
| 4 | Train | `Train`, `TrainController`, `TrainRepository` | Fleet |
| 5 | Route | `Route`, `RouteController`, `RouteRepository` | Named lines with start/end |
| 6 | Route Station | `RouteStation`, `RouteStationRepository` | Ordered stops on a route |
| 7 | Schedule | `Schedule`, `ScheduleController`, `ScheduleRepository` | Timetables and overlap check |
| 8 | Fare | `Fare`, `FareController`, `FareRepository` | Price between two stations |
| 9 | Ticket | `Ticket`, `TicketController`, `TicketRepository` | Booking and using a ticket |
| 10 | Payment | `Payment`, `PaymentController`, `PaymentRepository` | Payment record for a ticket |
| 11 | Metro Card | `MetroCard`, `MetroCardController`, `MetroCardRepository` | Smart card and balance |
| 12 | Maintenance Issue | `MaintenanceIssue`, controller, repository | Fault reporting and resolution |

---

## 5. Startup sequence

1. `TicketingApplication.main()` calls `SpringApplication.run(...)`.
2. Spring Boot scans `com.metro.ticketing` and creates all beans:
   - controllers
   - repositories
   - security configuration
   - seeder
3. `FlywayConfig` runs `flyway.migrate()`.
   - On a new database, V1–V6 create all tables.
   - On an existing database, Flyway checks which versions are already applied.
4. Hibernate starts with `spring.jpa.hibernate.ddl-auto=validate`.
   - It does **not** create tables.
   - It checks that every entity matches the database.
5. `DataSeeder` runs after the context is ready:
   - creates the bootstrap admin if it does not exist
   - if `Stations` is empty, inserts demo data
   - if data already exists, it skips
6. Tomcat listens on port `8080`.

Expected log lines:

```text
Flyway ... Successfully validated ...
Flyway ... Successfully applied ... migrations
Tomcat started on port 8080
Started TicketingApplication
DataSeeder: demo data loaded successfully.
```

---

## 6. Request lifecycle (the most important flow)

Example: `POST /api/tickets` as `priya`.

### Step 1 — HTTP request

```http
POST /api/tickets
Authorization: Basic base64(priya:Passw0rd!)
Content-Type: application/json

{"sourceStationId":"STN-VSV","destStationId":"STN-GHP","ticketType":"SINGLE"}
```

### Step 2 — Security filter chain

- Spring Security's Basic authentication filter reads the header.
- `DbUserDetailsService.loadUserByUsername("priya")` loads the user row.
- BCrypt compares the raw password with `User.Password`.
- On success, the `SecurityContext` contains an `Authentication` with `ROLE_PASSENGER`.
- Without valid credentials: `401 Unauthorized`.

### Step 3 — URL authorization

`SecurityConfig` allows public access only to:

- `POST /api/auth/passenger/register`
- Swagger / OpenAPI
- `/error`

Everything else requires authentication.

### Step 4 — Method authorization

```java
@PreAuthorize("hasAnyRole('PASSENGER','TICKET_AGENT','ADMIN')")
```

If the role is wrong: `403 Forbidden`.

### Step 5 — Controller validation

```java
@Valid @RequestBody Ticket request
```

Bean Validation checks the entity fields. Invalid input: `400 Bad Request`.

### Step 6 — Business logic in the controller

`TicketController.createTicket`:

1. Checks source and destination are present and different.
2. If the caller is a passenger, takes the passenger ID from the authenticated user.
3. Loads passenger, source station, destination station.
4. Looks up the fare for the station pair.
5. Creates `TKT-<uuid>`, sets fare, times, `isUsed=false`.
6. Sets `validUntil` to 24 hours from now if the request did not provide one.
7. Saves through `TicketRepository`.

### Step 7 — Transaction

The method has `@Transactional`.

- success: commit
- any exception: rollback

### Step 8 — JSON response

Hibernate loads the related objects, Jackson converts the entity to JSON, and Spring returns `201 Created`.

`User.password` is never included because it is write-only.

### Step 9 — Errors

`GlobalExceptionHandler` converts:

| Exception | Status | Body |
|---|---|---|
| `MethodArgumentNotValidException` | 400 | field -> message |
| `IllegalArgumentException` | 400 | `{"error": "..."}` |
| `AccessDeniedException` | 403 | permission error |
| `Exception` | 500 | generic error |

---

## 7. Authentication and authorization

### Basic auth in one line

The client sends `username:password` on every request. The server loads the user from PostgreSQL and checks the BCrypt hash. There is no session and no token.

### Role values

```java
ADMIN
TICKET_AGENT
MAINTENANCE_STAFF
PASSENGER
```

Spring authority names become `ROLE_ADMIN`, `ROLE_TICKET_AGENT`, etc.

### Role matrix

| Action | ADMIN | TICKET_AGENT | MAINTENANCE_STAFF | PASSENGER |
|---|---:|---:|---:|---:|
| Register passenger | public | public | public | public |
| Hire employee | yes | no | no | no |
| Create/update/delete station | yes | no | no | no |
| Create/update/delete train | yes | no | no | no |
| Create/update/delete route | yes | no | no | no |
| Create/update/delete schedule | yes | no | no | no |
| Create/update/delete fare | yes | no | no | no |
| Book ticket | yes | yes | no | yes |
| List all tickets | yes | yes | no | no |
| Use ticket | yes | yes | no | yes |
| Create/top-up card | yes | yes | no | yes |
| List all cards | yes | yes | no | no |
| Deactivate card | yes | yes | no | no |
| Create payment | no | yes | no | yes |
| List all payments | yes | yes | no | no |
| Report maintenance issue | yes | yes | yes | no |
| Resolve maintenance issue | yes | no | yes | no |
| Delete maintenance issue | yes | no | no | no |

### Ownership rules

Role alone is not enough. A passenger must only access their own records.

Used in:

- `TicketController.checkOwnership`
- `MetroCardController.checkOwnership`
- `PaymentController.checkOwnership`

Example:

```java
if (isPassenger(authentication)
        && !ticket.getPassenger().getUserId().equals(currentUser(authentication).getUserId())) {
    throw new AccessDeniedException("You can only access your own tickets");
}
```

---

## 8. Entity relationship map

```text
User (1) ----< (*) Ticket
User (1) ----< (*) MetroCard
User (1) ----< (*) Payment?   Payment points to Ticket, Ticket points to User
User (*) ---- (1) Station     staff assigned to a station

Ticket (*) ---- (1) User       passenger
Ticket (*) ---- (1) Fare
Ticket (*) ---- (1) Station    source
Ticket (*) ---- (1) Station    destination
Ticket (1) ----< (*) Payment

Fare (*) ---- (1) Station      source
Fare (*) ---- (1) Station      destination

Route (*) ---- (1) Station     start
Route (*) ---- (1) Station     end
Route (1) ----< (*) RouteStation
RouteStation (*) ---- (1) Station

Schedule (*) ---- (1) Train
Schedule (*) ---- (1) Route

MaintenanceIssue (*) ---- (1) Train        optional
MaintenanceIssue (*) ---- (1) Station      optional
MaintenanceIssue (*) ---- (1) User         reporter
```

Read `->` as “points to” and `1 ---< *` as “one row has many rows”.

---

## 9. Complete end-to-end story

### Morning — network setup

1. `DataSeeder` has already created `admin`.
2. Admin logs into Swagger with `admin/admin123`.
3. Admin creates stations (Station group).
4. Admin creates trains (Train group).
5. Admin creates routes and ordered stops (Route + RouteStation groups).
6. Admin creates schedules (Schedule group).
7. Admin creates fares (Fare group).

### Late morning — staff

Admin calls `POST /api/auth/employee/hire` to create `agent1` and `maint1`.

Passwords are BCrypt-hashed. The role and station are stored on the user.

### Afternoon — passenger

1. Priya registers through `POST /api/auth/passenger/register`.
2. She authorizes Swagger with `priya/Passw0rd!`.
3. She checks a fare with `GET /api/fares/lookup`.
4. She books a ticket with `POST /api/tickets`.
5. She pays with `POST /api/payments`.
6. She can use a metro card:
   - `POST /api/cards`
   - `POST /api/cards/{id}/topup?amount=100`
7. At the gate, `PATCH /api/tickets/{id}/use` marks the ticket used.
8. A second use returns `400 "Ticket already used"`.
9. An expired ticket returns `400 "Ticket has expired"`.

### Privacy

- Priya cannot list all tickets: `GET /api/tickets` -> `403`.
- Priya cannot open Arjun's ticket -> `403`.
- Priya cannot open Arjun's card or payments -> `403`.

### Evening — maintenance

1. `maint1` or `agent1` reports an issue with `POST /api/maintenance`.
2. `maint1` resolves it with `PATCH /api/maintenance/{id}/resolve`.
3. Resolution sets `Status = Closed` and `ResolvedAt = now`.

### Night — consistency

Every write is transactional. Validation and permission failures return clean JSON through `GlobalExceptionHandler`.

---

## 10. How the "no DTO / no service / no Lombok" design works

### Entities as API bodies

The same class is used for the database row and the JSON body.

Two annotations keep this safe:

- `@JsonProperty(access = WRITE_ONLY)` — JSON input only, never output.
  - passwords and transient foreign-key IDs
- `@JsonProperty(access = READ_ONLY)` — JSON output only, never input.
  - relations such as `Ticket.passenger`, `Ticket.fare`, `Ticket.sourceStation`

`@Transient` fields carry IDs in the request without becoming columns:

- `Ticket.passengerId`, `Ticket.sourceStationId`, `Ticket.destStationId`
- `Fare.sourceStationId`, `Fare.destStationId`
- `Schedule.trainId`, `Schedule.routeId`
- `Route.startStationId`, `Route.endStationId`, `Route.stationIds`
- `Payment.ticketId`
- `MetroCard.passengerId`
- `MaintenanceIssue.trainId`, `stationId`, `reportedById`
- `User.stationId`

### Business logic in controllers

Controllers call repositories directly and use `@Transactional`.

Why: the project is intentionally limited to concepts covered in class.

Trade-off: controllers are longer. In a production system, a service layer would be better.

### No Lombok

Getters, setters, and constructors are written explicitly so every line can be explained in viva.

---

## 11. JSON safety rules

| Rule | Why |
|---|---|
| `User.password` is write-only | Never expose password hashes |
| Relations are read-only | Client sends `passengerId`, not a nested `User` object |
| Transient IDs are write-only | Accept IDs without adding database columns |
| `@JsonIgnoreProperties({"hibernateLazyInitializer","handler"})` | Hide Hibernate proxy internals from JSON |
| `spring.jpa.open-in-view=true` | Keep the session open while Jackson serializes lazy relations |

---

## 12. Transaction boundaries

| Operation | Transaction |
|---|---|
| Controller write methods | `@Transactional` |
| Controller read methods | `@Transactional(readOnly = true)` |
| Repository save/delete | participates in the controller transaction |
| Seeder | each `save` runs in its own repository transaction |

If any step throws, the whole controller method rolls back.

---

## 13. ID formats

| Entity | Prefix | Example |
|---|---|---|
| User passenger | `PASS-` | `PASS-<uuid>` |
| User employee | `EMP-` | `EMP-<uuid>` |
| Admin | `ADMIN-` | `ADMIN-<uuid>` |
| Station | `STN-` | `STN-<uuid>` |
| Train | `TRN-` | `TRN-<uuid>` |
| Route | `RT-` | `RT-<uuid>` |
| Route stop | `RS-` | `RS-<uuid>` |
| Schedule | `SCH-` | `SCH-<uuid>` |
| Fare | `FARE-` | `FARE-<uuid>` |
| Ticket | `TKT-` | `TKT-<uuid>` |
| Payment | `PAY-` | `PAY-<uuid>` |
| Metro card | `CARD-` | `CARD-<uuid>` |
| Maintenance issue | `ISS-` | `ISS-<uuid>` |

The controller generates the ID. The database does not use auto-increment for these tables.

---

## 14. Flyway migration history

| Version | File | Purpose |
|---|---|---|
| V1 | `V1__create_metro_ticketing_schema.sql` | Creates all main tables and foreign keys |
| V2 | `V2__prevent_duplicate_fare_station_pairs.sql` | Unique index on `(SourceStationID, DestStationID)` |
| V3 | `V3__add_auth_lifecycle_tables.sql` | Old JWT refresh/reset tables |
| V4 | `V4__widen_auth_token_columns.sql` | Widened old token columns |
| V5 | `V5__drop_unused_auth_token_tables.sql` | Drops the old JWT tables |
| V6 | `V6__replace_route_station_composite_key.sql` | Replaces composite route-stop key with `RouteStationID` |

Why V3/V4 still exist: existing databases already recorded them in Flyway history. Deleting the files would make Flyway validation fail. V5 cleans up the tables.

---

## 15. Demo data

`DataSeeder` creates:

- 1 admin + 5 demo users
- 18 Mumbai stations
- 8 trains
- 3 routes
- 13 route stops
- 8 schedules
- 78 fares
- 4 metro cards
- 5 tickets
- 3 payments
- 4 maintenance issues

Demo accounts:

| Role | Username | Password |
|---|---|---|
| ADMIN | `admin` | `admin123` |
| TICKET_AGENT | `agent1` | `Passw0rd!` |
| MAINTENANCE_STAFF | `maint1` | `Passw0rd!` |
| PASSENGER | `priya` | `Passw0rd!` |
| PASSENGER | `arjun` | `Passw0rd!` |

The seeder checks `stationRepository.count() > 0`; if data exists, it does not duplicate it.

---

## 16. How to run and test

### Run

```bash
cd C:\Users\arjun\Desktop\metro-ticketing-app
./mvnw spring-boot:run
```

or PowerShell:

```powershell
.\mvnw.cmd spring-boot:run
```

Docker Compose starts the local PostgreSQL database and maps it to host port `5433` to avoid conflicts with a locally installed PostgreSQL service on `5432`. The app defaults to `metro_db` with user `metro_user` and password `metro_password`; environment variables `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD` override these settings. PostgreSQL keeps its data in a named Docker volume, and changing Compose `POSTGRES_*` values does not change credentials in an already-initialized volume.

### Swagger

```text
http://localhost:8081/
http://localhost:8081/swagger-ui/index.html
```

### Authorize

1. Click **Authorize**.
2. Username `admin`, password `admin123`.
3. Try `GET /api/stations`.
4. To check the authenticated account, call `GET /api/auth/me`.

### Test passenger rules

Use an incognito window, authorize as `priya` / `Passw0rd!`, then:

- `POST /api/tickets` -> 201
- `GET /api/tickets` -> 403
- `PATCH /api/tickets/{id}/use` -> 200, again -> 400

---

## 17. Top 30 viva questions

1. **What does `@SpringBootApplication` do?** Combines configuration, auto-configuration, and component scanning.
2. **What starts the app?** `TicketingApplication.main()`.
3. **What is a controller?** A class that maps HTTP requests to Java methods.
4. **What is a repository?** A Spring Data interface that generates database access.
5. **What is an entity?** A class mapped to a database table.
6. **Why no DTO?** Deliberate simplification; entities are API bodies, with safe JSON annotations.
7. **Why no service layer?** Deliberate simplification; logic is in controllers with `@Transactional`.
8. **Why no Lombok?** Explicit code is easier to explain in viva.
9. **How does Basic auth work?** Client sends `username:password`; Spring loads the user and checks BCrypt.
10. **Where is the password hashed?** `AuthController` / `DataSeeder` via `PasswordEncoder`.
11. **How are roles checked?** `SecurityConfig` URL rules and `@PreAuthorize`.
12. **What is `ROLE_ADMIN`?** The authority created from role `ADMIN`.
13. **How does a passenger see only their data?** Ownership checks using `Authentication`.
14. **What does `@Transactional` do?** Commit on success, rollback on exception.
15. **Why `readOnly = true`?** Read methods do not need dirty checking.
16. **Why `open-in-view=true`?** Lazy relations can be serialized during JSON conversion.
17. **What is `@Transient`?** A field that is not a database column.
18. **Why `WRITE_ONLY`?** Password/ID fields can be sent in but are never returned.
19. **Why `READ_ONLY`?** Relations can be returned but not overwritten by request JSON.
20. **How is the schema created?** Flyway V1–V6; Hibernate only validates.
21. **What is `ddl-auto=validate`?** Hibernate checks entities against tables without changing them.
22. **Why keep V3/V4?** Flyway history on existing databases; V5 drops the tables.
23. **What is the route-stop unique rule?** `(RouteID, StationID)` is unique.
24. **How is a ticket priced?** Look up `Fare` by source and destination.
25. **What happens if the fare is missing?** `400 "Fare not found for this station pair"`.
26. **Can a ticket be used twice?** No, second use returns 400.
27. **How is card balance stored?** `BigDecimal`, updated by top-up.
28. **Can a passenger have two active cards?** No, checked before creation.
29. **What happens on validation failure?** `MethodArgumentNotValidException` -> 400 field map.
30. **How would you add a new module?** Entity, migration, repository, controller, role rules, seed data.

---

## 18. Glossary

| Term | Meaning |
|---|---|
| Entity | Java class mapped to a table |
| Repository | Interface that generates queries |
| Bean | Object managed by Spring |
| DI | Dependency Injection |
| DTO | Data Transfer Object (removed here) |
| ORM | Object-Relational Mapping |
| JPA | Java Persistence API |
| Hibernate | JPA implementation |
| Flyway | Database migration tool |
| Basic auth | Username/password sent on every request |
| BCrypt | One-way password hashing |
| `@Transactional` | Transaction boundary |
| OSIV | Open Session In View |
| Swagger | Generated API documentation UI |

---

## 19. The one-paragraph answer

> This is a Spring Boot metro-ticketing application with a browser dashboard and REST API. The dashboard uses the same HTTP Basic authentication as the API. Security loads users from PostgreSQL; requests go to controllers, which validate input, check roles with `@PreAuthorize`, enforce ownership, and run business logic inside `@Transactional`. Controllers use Spring Data JPA repositories to read and write entities. Entities are mapped to PostgreSQL tables and are also used as JSON bodies, with transient ID fields and read/write-only annotations for safety. Flyway creates the schema, Hibernate validates it, and a seeder loads demo data. Errors are converted to clean JSON by a global exception handler. Swagger documents and tests the API.
