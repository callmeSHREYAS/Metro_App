<div align="center">

# 🚇 Metro Ticketing System

**A role-based metro operations dashboard and REST API for transit management and digital ticketing.**

Manage stations, trains, routes, timetables, fares, smart cards, tickets and maintenance incidents, secured with HTTP Basic authentication and documented with live Swagger UI.

[![Java](https://img.shields.io/badge/Java-21-orange?logo=openjdk&logoColor=white)](https://openjdk.org/projects/jdk/21/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1-6DB33F?logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Flyway](https://img.shields.io/badge/Flyway-migrations-CC0200?logo=flyway&logoColor=white)](https://flywaydb.org/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3-85EA2D?logo=swagger&logoColor=black)](http://localhost:8081/swagger-ui/index.html)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

</div>

---

## 📌 Overview

The Metro Ticketing System is a **Spring Boot application with a responsive web dashboard and REST API** for day-to-day metro operations:

- **Passengers** book tickets, hold smart cards and check timetables.
- **Ticket agents** issue tickets and top up cards at the counter.
- **Maintenance staff** report and resolve faults on trains and stations.
- **Admins** manage the whole network, fares and staff.

It uses a deliberately simple layered design:

```
HTTP Basic Auth -> Controller (business logic) -> Repository -> PostgreSQL
```

- Controllers contain the business logic and transactions.
- Repositories handle all database access through Spring Data JPA.
- Entities are used directly as request and response bodies.
- Flyway creates the schema; a seeder loads demo data on first boot.

---

## ✨ Features

| Area | What you get |
| --- | --- |
| 🔐 **Authentication** | HTTP Basic authentication, BCrypt password hashing, database-backed users |
| 👥 **Role-Based Access Control** | `@PreAuthorize` rules for `ADMIN`, `TICKET_AGENT`, `MAINTENANCE_STAFF`, `PASSENGER` |
| 🚉 **Network & Fleet** | CRUD for stations (coordinates, line colours), trains (capacity, coaches), routes and ordered stops |
| 🕒 **Timetables** | Schedules linked to routes and trains, with overlap detection |
| 🎫 **Fares & Tickets** | Origin–destination fare lookup, digital tickets, use/validate lifecycle |
| 💳 **Smart Cards** | Card issuance, balance tracking and top-ups |
| 🛠️ **Maintenance** | Incident reporting for stations and trains with priority and resolution tracking |
| 📖 **API Docs** | Swagger UI with Basic Auth support |
| 🖥️ **Operations dashboard** | Responsive, role-aware interface for managing network data and running API operations |
| 🗄️ **Database** | Flyway migrations (`V1`–`V6`) and demo data seeding |

---

## 🧰 Tech Stack

| Layer | Technology |
| --- | --- |
| Language | Java 21 (LTS) |
| Framework | Spring Boot 4.1 (Web MVC, Data JPA, Security, Validation) |
| Database | PostgreSQL 15+ |
| Migrations | Flyway |
| Security | Spring Security HTTP Basic, BCrypt |
| API Docs | SpringDoc OpenAPI |
| Build | Maven 3.9+ (Maven Wrapper included) |

---

## 🚀 Quick Start

### Prerequisites

- **JDK 21** — check with `java -version`
- **Docker Compose** — to start PostgreSQL locally
- **Maven is optional**; use the included wrapper
- **Node.js 18+** — optional, for the end-to-end API test suite

### 1. Clone the repository

```bash
git clone https://github.com/arjunrhetoric/metro-app.git
cd metro-app
```

### 2. Database

Start the local PostgreSQL database with Docker Compose:

```bash
docker compose up -d postgres
```

The Compose service creates database `metro_db`, user `metro_user`, and uses the development password `metro_password` by default. These values match the application defaults. Flyway creates the schema on the first application startup. PostgreSQL stores its initialized data in a named volume, so changing `POSTGRES_*` later does not change the credentials of an already-created database.

To customize the database credentials on a fresh database, set `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` before starting Compose, and set the matching `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD` for the application. The Compose service maps host port `5433` to PostgreSQL's container port `5432` to avoid colliding with a local PostgreSQL installation. For example, in PowerShell:

```powershell
$env:POSTGRES_DB = "metro_db"
$env:POSTGRES_USER = "metro_user"
$env:POSTGRES_PASSWORD = "your_local_password"
$env:DB_URL = "jdbc:postgresql://localhost:5433/metro_db"
$env:DB_USERNAME = "metro_user"
$env:DB_PASSWORD = "your_local_password"
docker compose up -d postgres
```

The development password is intended for local use only; choose a strong password for any shared or deployed environment.

If you changed the Compose password after the database was already initialized, update the existing PostgreSQL role without deleting the data volume:

```powershell
docker compose exec postgres psql -U metro_user -d metro_db -c "ALTER USER metro_user WITH PASSWORD 'metro_password';"
```

Replace `metro_password` in the command with the value used for `DB_PASSWORD`.

### 3. Start the application

```bash
./mvnw spring-boot:run          # Git Bash / Linux / macOS
.\mvnw.cmd spring-boot:run      # PowerShell / CMD
```

The app listens on port `8081` by default (`server.port` in `application.properties`).

API: **http://localhost:8081**
Operations dashboard: **http://localhost:8081/**
Swagger UI: **http://localhost:8081/swagger-ui/index.html**

Open the dashboard in a browser and sign in with one of the demo accounts below. Use the sidebar to manage network, service, and user records, or open **API explorer** to run any of the documented API operations. The dashboard and REST API share the same Spring Boot server and authentication.

---

## 🔐 Authentication

Sign in to the dashboard with your account's `Contact` value as the username and its password. The same credentials work in Swagger UI through its **Authorize** button and with HTTP Basic authentication on API requests.

The dashboard checks credentials through `GET /api/auth/me`. Credentials stay in memory while the page is open; refresh the page and sign in again.

### Demo accounts

Seeded automatically on first startup:

| Role | Username | Password | Can do |
| --- | --- | --- | --- |
| `ADMIN` | `admin` | `admin123` | Everything |
| `TICKET_AGENT` | `agent1` | `Passw0rd!` | Issue tickets, top up cards |
| `MAINTENANCE_STAFF` | `maint1` | `Passw0rd!` | Report/resolve faults |
| `PASSENGER` | `priya` | `Passw0rd!` | Book tickets, own cards/payments |
| `PASSENGER` | `arjun` | `Passw0rd!` | Book tickets, own cards/payments |

Register a new passenger with `POST /api/auth/passenger/register`, then use the same contact and password as Basic credentials.

### Swagger UI

1. Open http://localhost:8081/swagger-ui/index.html
2. Click **Authorize**.
3. Enter username and password (for example `admin` / `admin123`).
4. Call any endpoint.

To verify the credentials, call `GET /api/auth/me` after authorizing. It should return the signed-in user. If Swagger still rejects credentials that were previously entered, click **Logout** in the Authorize dialog and authorize again; Swagger UI persists Basic credentials between visits.

### cURL

```bash
# Admin
curl -u admin:admin123 http://localhost:8081/api/stations

# Passenger
curl -u priya:Passw0rd! http://localhost:8081/api/tickets/passenger/PASS-SEED1
```

Use an incognito window or restart the browser to switch users, because browsers cache Basic credentials.

---

## 📖 API Documentation

| Resource | URL |
| --- | --- |
| Swagger UI | http://localhost:8081/swagger-ui/index.html |
| OpenAPI JSON | http://localhost:8081/v3/api-docs |

### Main endpoints

| Area | Base path |
| --- | --- |
| Auth (register/hire/me) | `/api/auth` |
| Stations | `/api/stations` |
| Trains | `/api/trains` |
| Routes | `/api/routes` |
| Schedules | `/api/schedules` |
| Fares | `/api/fares` |
| Tickets | `/api/tickets` |
| Metro cards | `/api/cards` |
| Payments | `/api/payments` |
| Maintenance | `/api/maintenance` |

`PATCH /{id}` partial-update operations are available for users, stations, trains, routes, schedules, fares, and maintenance issues. Omitted fields keep their current values. Swagger also lists the existing ticket-use, card-deactivation, card-top-up, and maintenance-resolution operations. Authentication is registration/current-user access, and payments are treated as immutable records.

Example ticket request (passenger is taken from the authenticated user):

```bash
curl -u priya:Passw0rd! -X POST http://localhost:8081/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"sourceStationId":"STN-VSV","destStationId":"STN-GHP","ticketType":"SINGLE"}'
```

Top-up uses a query parameter:

```bash
curl -u priya:Passw0rd! -X POST \
  "http://localhost:8081/api/cards/CARD-SEED1/topup?amount=100"
```

---

## 🏛️ Project Structure

```text
metro-ticketing-app/
├── pom.xml
├── mvnw / mvnw.cmd
└── src/
    ├── main/
    │   ├── java/com/metro/ticketing/
    │   │   ├── TicketingApplication.java
    │   │   ├── config/
    │   │   │   ├── SecurityConfig.java          HTTP Basic, roles, BCrypt
    │   │   │   ├── DbUserDetailsService.java    loads users from the database
    │   │   │   ├── DataSeeder.java              admin + demo data
    │   │   │   ├── FlywayConfig.java            runs migrations before JPA
    │   │   │   └── OpenApiConfig.java           Swagger Basic Auth scheme
    │   │   ├── controller/                      10 controllers (business logic)
    │   │   ├── entity/                          11 entities + Role enum
    │   │   ├── repository/                      11 Spring Data repositories
    │   │   └── exception/
    │   │       └── GlobalExceptionHandler.java  JSON error responses
    │   └── resources/
    │       ├── application.properties
    │       └── db/migration/                    Flyway V1–V6
```

### Request flow

1. Spring Security reads the `Authorization: Basic ...` header.
2. `DbUserDetailsService` loads the user by `Contact` and BCrypt checks the password.
3. The controller method runs; `@PreAuthorize` checks the role.
4. The controller executes business logic inside `@Transactional`.
5. Repositories read/write PostgreSQL through Hibernate.
6. `GlobalExceptionHandler` converts errors to JSON.

---

## ⚙️ Configuration

| Property | Environment variable | Default |
| --- | --- | --- |
| `spring.datasource.url` | `DB_URL` | `jdbc:postgresql://localhost:5433/metro_db` |
| `spring.datasource.username` | `DB_USERNAME` | `metro_user` |
| `spring.datasource.password` | `DB_PASSWORD` | `metro_password` |
| `app.bootstrap.admin.contact` | `ADMIN_CONTACT` | `admin` |
| `app.bootstrap.admin.password` | `ADMIN_PASSWORD` | `admin123` |
| `app.bootstrap.admin.first-name` | `ADMIN_FIRST_NAME` | `System` |
| `app.bootstrap.admin.last-name` | `ADMIN_LAST_NAME` | `Administrator` |

JPA is set to `ddl-auto=validate`; Flyway owns the schema. `open-in-view=true` allows entities with lazy relations to be serialized safely.

---

## 🔒 Security Notes

Before deploying publicly:

- [ ] Change the demo passwords and the bootstrap admin password.
- [ ] Use a dedicated database user with limited privileges.
- [ ] Enable HTTPS; Basic credentials are only safe over TLS.
- [ ] Remove or disable the demo data seeder.
- [ ] Set `spring.jpa.show-sql=false`.

---

## 🩺 Troubleshooting

| Problem | Fix |
| --- | --- |
| `Connection refused` | Start PostgreSQL with `docker compose up -d postgres` and check `DB_URL` (Compose maps it to port `5433`). |
| `password authentication failed` | Ensure `DB_PASSWORD` matches the existing PostgreSQL user's password. Changing Compose `POSTGRES_PASSWORD` does not update an initialized database; use the password repair command in the Database section. |
| `database "metro_db" does not exist` | Check `POSTGRES_DB` and `DB_URL`, then start the Compose service. |
| `Unsupported class file major version` | Use JDK 21. Check `java -version` and `JAVA_HOME`. |
| `401 Unauthorized` | Check that you are using port `8081`, the account's `Contact` as username, and its correct password. For Swagger, log out of any saved credentials and authorize again. |
| `403 Forbidden` | The authenticated role is not allowed to call that endpoint. |
| Port `8081` already in use | Change `server.port` in `application.properties` or run with `--server.port=9090`. |
| Browser keeps old credentials | Use an incognito window or clear the site's auth cache. |

### End-to-end API tests

Keep PostgreSQL and the application running, then run:

```powershell
node --test src\test\js\*.test.js
```

The tests verify dashboard access and authentication, ensure the API explorer covers every OpenAPI operation, and exercise station, ticket/payment, and maintenance workflows with temporary test data that is cleaned up afterward. Use `BASE_URL`, `ADMIN_CONTACT`, or `ADMIN_PASSWORD` environment variables if your local settings differ from the defaults.

---

## 📄 License

Distributed under the Apache License 2.0. See [`LICENSE`](LICENSE).
