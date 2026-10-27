# 02 — Authentication, Role and Security Group

**Files**

| File | Path |
|---|---|
| Role enum | `src/main/java/com/metro/ticketing/entity/Role.java` |
| Security config | `src/main/java/com/metro/ticketing/config/SecurityConfig.java` |
| User loader | `src/main/java/com/metro/ticketing/config/DbUserDetailsService.java` |
| Auth controller | `src/main/java/com/metro/ticketing/controller/AuthController.java` |
| Password encoder | Bean in `SecurityConfig.java` |
| User repository | `src/main/java/com/metro/ticketing/repository/UserRepository.java` |

---

## 1. What this group does

This group answers two questions for every request:

1. **Who are you?** → authentication with HTTP Basic.
2. **What are you allowed to do?** → roles and `@PreAuthorize`.

There is no JWT and no login endpoint. The browser, Swagger, or `curl` sends:

```http
Authorization: Basic base64(contact:password)
```

Spring Security decodes it, loads the user from PostgreSQL, compares the BCrypt hash, and stores the authenticated user in the `SecurityContext` for that request only.

The session is stateless: no `JSESSIONID`, no server-side login state.

---

## 2. Role enum

```java
public enum Role {
    ADMIN,
    TICKET_AGENT,
    MAINTENANCE_STAFF,
    PASSENGER
}
```

| Role | Purpose |
|---|---|
| `ADMIN` | Full network management |
| `TICKET_AGENT` | Book tickets, issue cards, top up, report issues |
| `MAINTENANCE_STAFF` | Report and resolve faults |
| `PASSENGER` | Book tickets, use own cards/payments |

`DbUserDetailsService` converts the role to a Spring authority:

```java
.roles(user.getRole().name())
```

`roles("ADMIN")` internally produces `ROLE_ADMIN`. That is why the annotations use:

```java
@PreAuthorize("hasRole('ADMIN')")
```

`hasRole` adds the `ROLE_` prefix automatically. `hasAnyRole('ADMIN','TICKET_AGENT')` works the same way.

---

## 3. `SecurityConfig` walkthrough

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {
```

- `@Configuration` — declares beans.
- `@EnableWebSecurity` — activates the servlet security filter chain.
- `@EnableMethodSecurity` — activates `@PreAuthorize` on controller methods.

### Constructor injection

```java
private final DbUserDetailsService userDetailsService;

public SecurityConfig(DbUserDetailsService userDetailsService) {
    this.userDetailsService = userDetailsService;
}
```

### Filter chain

```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http
        .csrf(AbstractHttpConfigurer::disable)
        ...
}
```

#### CSRF disabled

CSRF protection is for cookie/session-based browser forms. This API is stateless and uses Basic auth, so CSRF is disabled.

#### Public paths

```java
.requestMatchers(
    "/api/auth/passenger/register",
    "/v3/api-docs/**",
    "/swagger-ui/**",
    "/swagger-ui.html",
    "/error"
).permitAll()
```

| Path | Why public |
|---|---|
| `POST /api/auth/passenger/register` | New passengers have no account yet |
| `/v3/api-docs/**` | OpenAPI JSON |
| `/swagger-ui/**` | Swagger UI assets |
| `/swagger-ui.html` | Swagger redirect |
| `/error` | Spring Boot error dispatch |

Everything else requires authentication.

#### Admin-only URL rule

```java
.requestMatchers("/api/auth/employee/hire").hasRole("ADMIN")
```

This is a second layer. The method also has `@PreAuthorize("hasRole('ADMIN')")`.

#### Everything else authenticated

```java
.anyRequest().authenticated()
```

#### HTTP Basic

```java
.httpBasic(Customizer.withDefaults())
```

This adds the Basic authentication filter and a `WWW-Authenticate` response for unauthenticated requests.

#### Stateless

```java
.sessionManagement(session ->
    session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
```

No HTTP session is created. Every request must carry credentials.

#### Authentication provider

```java
.authenticationProvider(authenticationProvider());
```

```java
private AuthenticationProvider authenticationProvider() {
    DaoAuthenticationProvider authProvider =
        new DaoAuthenticationProvider(userDetailsService);
    authProvider.setPasswordEncoder(passwordEncoder());
    return authProvider;
}
```

`DaoAuthenticationProvider`:

1. calls `loadUserByUsername`
2. compares the raw password with the stored hash using the encoder
3. throws `BadCredentialsException` on mismatch
4. throws `DisabledException` if the user is disabled

#### Password encoder bean

```java
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
}
```

BCrypt:

- generates a random salt per password
- is intentionally slow
- is one-way
- produces hashes like `$2a$10$...`

The same bean is injected into `AuthController` and `DataSeeder`.

---

## 4. `DbUserDetailsService` walkthrough

```java
@Service
public class DbUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String contact) {
        User user = userRepository.findByContact(contact)
            .orElseThrow(() -> new UsernameNotFoundException(
                "User not found: " + contact));

        return org.springframework.security.core.userdetails.User
            .withUsername(user.getContact())
            .password(user.getPassword())
            .roles(user.getRole().name())
            .disabled(!Boolean.TRUE.equals(user.getIsActive()))
            .build();
    }
}
```

| Line | Meaning |
|---|---|
| `findByContact` | `Contact` is the login username |
| `withUsername` | sets the principal name |
| `password` | BCrypt hash from the database |
| `roles` | creates `ROLE_<name>` |
| `disabled` | inactive user cannot log in |

Note: there are two `User` classes in this method:

- `com.metro.ticketing.entity.User` (our database entity)
- `org.springframework.security.core.userdetails.User` (Spring's user details)

The Spring one is written with its full package name to avoid ambiguity.

---

## 5. `AuthController` endpoints

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/passenger/register` | public | Create a passenger |
| POST | `/api/auth/employee/hire` | ADMIN | Create staff |
| GET | `/api/auth/me` | authenticated | Return current user |

All three return `ResponseEntity<User>`.

---

## 6. Register passenger — step by step

```java
@PostMapping("/passenger/register")
@Transactional
public ResponseEntity<User> registerPassenger(@Valid @RequestBody User request) {
```

1. Duplicate check:

```java
if (userRepository.findByContact(request.getContact()).isPresent()) {
    throw new IllegalArgumentException("User with this contact already exists.");
}
```

2. Create a new entity:

```java
User user = new User();
user.setUserId("PASS-" + UUID.randomUUID());
```

3. Copy names and contact.

4. Hash the password:

```java
user.setPassword(passwordEncoder.encode(request.getPassword()));
```

5. Force the role:

```java
user.setRole(Role.PASSENGER);
```

A client cannot register itself as admin through this endpoint.

6. Set registration date and active flag, then save.

7. Return `200 OK` with the entity. The password is hidden by `WRITE_ONLY`.

### Example

```json
{
  "firstName": "Priya",
  "lastName": "Sharma",
  "contact": "priya2",
  "password": "Passw0rd!"
}
```

### Validation

`@Valid` checks:

- firstName not blank
- lastName not blank
- contact not blank
- password not blank

The unique index on `Contact` is the final duplicate guard.

---

## 7. Hire employee — step by step

```java
@PostMapping("/employee/hire")
@PreAuthorize("hasRole('ADMIN')")
@Transactional
public ResponseEntity<User> hireEmployee(@Valid @RequestBody User request) {
```

1. Duplicate contact check.
2. Role must be provided:

```java
if (request.getRole() == null) {
    throw new IllegalArgumentException("Role is required.");
}
```

3. Station must be provided:

```java
if (request.getStationId() == null) {
    throw new IllegalArgumentException("Station is required.");
}
```

4. Load the station:

```java
Station station = stationRepository.findById(request.getStationId())
    .orElseThrow(() -> new IllegalArgumentException("Station not found."));
```

5. Create `EMP-<uuid>`.
6. Copy names, contact, role.
7. Hash the password.
8. Set `hireDate`, `registrationDate`, `station`, `isActive`.
9. Save.

### Example

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

If a non-admin calls it:

```text
403 Forbidden
```

The URL rule in `SecurityConfig` and `@PreAuthorize` both enforce this.

---

## 8. Current user — step by step

```java
@GetMapping("/me")
@Transactional(readOnly = true)
public ResponseEntity<User> getCurrentUser(Authentication authentication) {
    User user = userRepository.findByContact(authentication.getName())
        .orElseThrow(() -> new IllegalArgumentException("Current user not found"));
    return ResponseEntity.ok(user);
}
```

- `Authentication` is injected by Spring.
- `authentication.getName()` is the contact (the Basic username).
- The user row is loaded and returned.

Why `readOnly = true`: no data is modified.

This endpoint is useful for verifying which user Swagger is currently using.

---

## 9. Basic auth flow in detail

### Request

```http
GET /api/tickets
Authorization: Basic cHJpeWE6UGFzc3cwcmQh
```

`cHJpeWE6UGFzc3cwcmQh` is Base64 for `priya:Passw0rd!`.

### Server

1. Basic filter decodes the header.
2. Calls `DbUserDetailsService.loadUserByUsername("priya")`.
3. Loads the row with `findByContact`.
4. `DaoAuthenticationProvider` compares the raw password with the BCrypt hash.
5. On success:
   - creates an `Authentication`
   - sets authority `ROLE_PASSENGER`
   - stores it in `SecurityContextHolder` for this request
6. `AuthorizationFilter` allows the URL.
7. `@PreAuthorize` checks the method.
8. Controller runs.

### Failure

| Situation | Result |
|---|---|
| No `Authorization` header | `401 Unauthorized` |
| Wrong password | `401 Unauthorized` |
| Unknown contact | `401 Unauthorized` |
| Inactive user | `401 Unauthorized` |
| Valid user, wrong role | `403 Forbidden` |

`401` = "I don't know who you are."  
`403` = "I know who you are, but you cannot do this."

---

## 10. URL security vs method security

### URL security

In `SecurityConfig`:

```java
.requestMatchers("/api/auth/employee/hire").hasRole("ADMIN")
.anyRequest().authenticated()
```

This runs before the controller.

### Method security

On controller methods:

```java
@PreAuthorize("hasAnyRole('PASSENGER','TICKET_AGENT','ADMIN')")
```

This runs when the method is invoked.

Both must pass.

Why both? URL rules are a coarse gate; `@PreAuthorize` documents and enforces the exact operation.

---

## 11. Password storage

### Raw password

Only exists in the request body and for a moment in memory.

### Hash

```java
passwordEncoder.encode(rawPassword)
```

Produces a BCrypt hash. The database stores only the hash.

### Login

```java
passwordEncoder.matches(rawPassword, storedHash)
```

Spring's `DaoAuthenticationProvider` performs this comparison.

### Why hashing is not encryption

Encryption is reversible. Hashing is one-way. Even if the database leaks, the original password is not directly available.

---

## 12. Dashboard and Swagger testing

1. Open the dashboard at `http://localhost:8081/`.
2. Sign in with username `admin` and password `admin123`.
3. The dashboard verifies the account with `GET /api/auth/me` and shows the navigation available to that role.
4. Alternatively, open `http://localhost:8081/swagger-ui/index.html` and authorize with the same credentials.

1. In Swagger, click **Authorize**.
2. Enter:
   - username `admin`
   - password `admin123`
3. Call `GET /api/auth/me` -> returns admin.
4. Call `POST /api/auth/employee/hire` -> succeeds.
5. Click **Authorize** again and switch to `priya` / `Passw0rd!`.
6. Call `GET /api/auth/me` -> returns Priya.
7. Call `POST /api/auth/employee/hire` -> `403`.

Browsers cache Basic credentials. If switching users does not work, use an incognito window.

---

## 13. cURL testing

```bash
# Admin
curl -u admin:admin123 http://localhost:8081/api/auth/me

# Passenger
curl -u priya:Passw0rd! http://localhost:8081/api/auth/me

# Register
curl -X POST http://localhost:8081/api/auth/passenger/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"New","lastName":"User","contact":"newuser","password":"Passw0rd!"}'

# Hire (admin only)
curl -u admin:admin123 -X POST http://localhost:8081/api/auth/employee/hire \
  -H "Content-Type: application/json" \
  -d '{"firstName":"New","lastName":"Agent","contact":"agent9","password":"Passw0rd!","role":"TICKET_AGENT","stationId":"STN-AND"}'
```

---

## 14. Viva questions

**Q: Why HTTP Basic instead of JWT?**
A: Authentication is out of the current syllabus and Basic auth keeps the same database users, BCrypt hashes, and roles without token classes, filters, expiry, or refresh tokens.

**Q: Is Basic auth secure?**
A: Only over HTTPS. The credentials are Base64, not encrypted. For local/demo use it is fine; production must use TLS.

**Q: Where is the session?**
A: There is none. `SessionCreationPolicy.STATELESS` and no `JSESSIONID`. Credentials are sent on every request.

**Q: What is the difference between authentication and authorization?**
A: Authentication proves identity. Authorization checks permissions. Basic auth does authentication; `@PreAuthorize` and URL rules do authorization.

**Q: Where is the password checked?**
A: `DaoAuthenticationProvider` with `BCryptPasswordEncoder`, using the user loaded by `DbUserDetailsService`.

**Q: Why does `DbUserDetailsService` use `contact`?**
A: `Contact` is the unique login identity in the `User` table.

**Q: What does `.roles("ADMIN")` do?**
A: It creates the authority `ROLE_ADMIN`, which matches `hasRole('ADMIN')`.

**Q: Why is CSRF disabled?**
A: There are no cookies or sessions; this is a stateless API.

**Q: Why is `register` public?**
A: A new passenger has no credentials yet, so registration cannot require authentication.

**Q: Why can't register create an admin?**
A: The controller forces `Role.PASSENGER`. Only an authenticated admin can use `/employee/hire`.

**Q: What happens if an inactive user tries to log in?**
A: `disabled(true)` is set in `DbUserDetailsService`; Spring rejects the login with `401`.

**Q: Why is `@Transactional` on register/hire?**
A: They read and write the database; a failure must roll back the whole operation.

**Q: Why is `/me` read-only?**
A: It only reads the current user.

**Q: How does Swagger know about Basic auth?**
A: `OpenApiConfig` defines an HTTP Basic security scheme, and the `Authorize` button collects the username/password.

---

## 15. One-line summary

This group turns a `contact:password` header into a trusted `Authentication` with `ROLE_*` authorities, then `@PreAuthorize` decides which operations that role may perform.
