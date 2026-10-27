(() => {
    "use strict";

    const $ = (selector, parent = document) => parent.querySelector(selector);
    const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));
    const state = { token: "", user: null, page: "dashboard", rows: [], search: "", filters: {} };
    const dialog = $("#record-dialog");
    const dialogContent = $("#record-dialog-content");
    const apiResultDialog = $("#api-result-dialog");
    const apiResultContent = $("#api-result-content");

    const sections = [
        { title: "Workspace", items: [
            { id: "dashboard", label: "Overview", icon: "▦" },
            { id: "api", label: "API explorer", icon: "⌘" }
        ] },
        { title: "Network", items: [
            { id: "stations", label: "Stations", icon: "◎" },
            { id: "trains", label: "Trains", icon: "↝" },
            { id: "routes", label: "Routes", icon: "⌁" },
            { id: "schedules", label: "Schedules", icon: "◷" },
            { id: "fares", label: "Fares", icon: "₹" }
        ] },
        { title: "Service", items: [
            { id: "tickets", label: "Tickets", icon: "▤" },
            { id: "cards", label: "Metro cards", icon: "▣" },
            { id: "payments", label: "Payments", icon: "↗" },
            { id: "maintenance", label: "Maintenance", icon: "⚒" }
        ] },
        { title: "People", items: [{ id: "users", label: "Users", icon: "♙", roles: ["ADMIN"] }] }
    ];

    const fields = {
        stations: [
            { name: "stationCode", label: "Station code", required: true },
            { name: "latitude", label: "Latitude", type: "number", step: "any" },
            { name: "longitude", label: "Longitude", type: "number", step: "any" },
            { name: "address", label: "Address", full: true },
            { name: "openedDate", label: "Opened date", type: "date" },
            { name: "lineColor", label: "Line color" },
            { name: "isActive", label: "Active station", type: "checkbox", defaultValue: true }
        ],
        trains: [
            { name: "trainNumber", label: "Train number", required: true },
            { name: "capacity", label: "Passenger capacity", type: "number", min: "1" },
            { name: "totalCoaches", label: "Number of coaches", type: "number", min: "1" },
            { name: "manufactureYear", label: "Manufacture year", type: "number", min: "1900" },
            { name: "isActive", label: "In service", type: "checkbox", defaultValue: true }
        ],
        routes: [
            { name: "routeName", label: "Route name", required: true, full: true },
            { name: "lineColor", label: "Line color" },
            { name: "totalDistance", label: "Distance (km)", type: "number", step: "0.01" },
            { name: "estimatedTime", label: "Estimated time (min)", type: "number", min: "1" },
            { name: "startStationId", label: "Start station ID", required: true, hint: "Use a station ID, e.g. STN-VSV." },
            { name: "endStationId", label: "End station ID", required: true, hint: "Use a station ID, e.g. STN-GHP." },
            { name: "stationIds", label: "Ordered route station IDs", type: "textarea", full: true, hint: "Comma-separated station IDs from first stop to last stop." }
        ],
        schedules: [
            { name: "trainId", label: "Train ID", required: true },
            { name: "routeId", label: "Route ID", required: true },
            { name: "dayOfWeek", label: "Service day", type: "select", options: ["DAILY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] },
            { name: "scheduledDeparture", label: "Departure", type: "datetime-local", required: true },
            { name: "scheduledArrival", label: "Arrival", type: "datetime-local", required: true },
            { name: "validFrom", label: "Valid from", type: "date" },
            { name: "validTo", label: "Valid until", type: "date" },
            { name: "isActive", label: "Schedule active", type: "checkbox", defaultValue: true }
        ],
        fares: [
            { name: "sourceStationId", label: "Origin station ID", required: true },
            { name: "destStationId", label: "Destination station ID", required: true },
            { name: "baseFare", label: "Fare amount", type: "number", min: "0.01", step: "0.01", required: true }
        ],
        tickets: [
            { name: "passengerId", label: "Passenger ID", hint: "Required for staff-issued tickets; passengers are assigned automatically.", staffOnly: true },
            { name: "sourceStationId", label: "Origin station ID", required: true },
            { name: "destStationId", label: "Destination station ID", required: true },
            { name: "ticketType", label: "Ticket type", type: "select", options: ["SINGLE", "RETURN"], required: true },
            { name: "validUntil", label: "Expiry", type: "datetime-local", hint: "Leave blank to use the API's 24-hour default." }
        ],
        cards: [
            { name: "passengerId", label: "Passenger ID", staffOnly: true, hint: "Required for cards issued by staff; passengers are assigned automatically." },
            { name: "balance", label: "Opening balance", type: "number", min: "0", step: "0.01", defaultValue: "0" },
            { name: "expiryDate", label: "Expiry date", type: "date", hint: "Leave blank to use the API's 5-year default." }
        ],
        payments: [
            { name: "ticketId", label: "Ticket ID", required: true },
            { name: "amount", label: "Amount", type: "number", min: "0.01", step: "0.01", required: true }
        ],
        maintenance: [
            { name: "issueType", label: "Issue type", required: true },
            { name: "priority", label: "Priority", type: "select", options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], defaultValue: "MEDIUM" },
            { name: "description", label: "Description", type: "textarea", full: true, required: true },
            { name: "trainId", label: "Train ID (optional)" },
            { name: "stationId", label: "Station ID (optional)" },
            { name: "reportedById", label: "Reporter user ID (optional)" },
            { name: "status", label: "Status", type: "select", options: ["Open", "In Progress", "Closed"], editOnly: true }
        ],
        users: [
            { name: "firstName", label: "First name", required: true },
            { name: "lastName", label: "Last name", required: true },
            { name: "contact", label: "Username / contact", required: true },
            { name: "password", label: "Password", type: "password", requiredOnCreate: true, hint: "Enter a new password when changing a user's password." },
            { name: "role", label: "Role", type: "select", options: ["PASSENGER", "TICKET_AGENT", "MAINTENANCE_STAFF", "ADMIN"], required: true },
            { name: "stationId", label: "Assigned station ID" },
            { name: "isActive", label: "Account active", type: "checkbox", defaultValue: true },
            { name: "hireDate", label: "Hire date", type: "date" }
        ]
    };

    const resources = {
        stations: {
            title: "Stations", singular: "Station", endpoint: "/api/stations", id: "stationId",
            description: "Explore stations and keep line information up to date.",
            columns: [
                { name: "stationCode", label: "Station" },
                { name: "stationId", label: "Station ID", id: true },
                { name: "lineColor", label: "Line" },
                { name: "address", label: "Address" },
                { name: "isActive", label: "Status", status: true }
            ]
        },
        trains: {
            title: "Trains", singular: "Train", endpoint: "/api/trains", id: "trainId",
            description: "Monitor fleet capacity, coaches and service status.",
            columns: [
                { name: "trainNumber", label: "Train" },
                { name: "trainId", label: "Train ID", id: true },
                { name: "capacity", label: "Capacity" },
                { name: "totalCoaches", label: "Coaches" },
                { name: "manufactureYear", label: "Built" },
                { name: "isActive", label: "Status", status: true }
            ]
        },
        routes: {
            title: "Routes", singular: "Route", endpoint: "/api/routes", id: "routeId",
            description: "Manage lines, journey endpoints and ordered station stops.",
            columns: [
                { name: "routeName", label: "Route" },
                { name: "routeId", label: "Route ID", id: true },
                { name: "lineColor", label: "Line" },
                { name: "totalDistance", label: "Distance (km)" },
                { name: "estimatedTime", label: "Time (min)" },
                { name: "stationIds", label: "Stops", list: true }
            ]
        },
        schedules: {
            title: "Schedules", singular: "Schedule", endpoint: "/api/schedules", id: "scheduleId",
            description: "Coordinate train departures across the active network.",
            columns: [
                { name: "scheduleId", label: "Schedule ID", id: true },
                { name: "train", label: "Train", nested: "trainNumber" },
                { name: "route", label: "Route", nested: "routeName" },
                { name: "scheduledDeparture", label: "Departure" },
                { name: "scheduledArrival", label: "Arrival" },
                { name: "dayOfWeek", label: "Service day" }
            ]
        },
        fares: {
            title: "Fares", singular: "Fare", endpoint: "/api/fares", id: "fareId",
            description: "Set origin-to-destination fares and check a journey price.",
            columns: [
                { name: "fareId", label: "Fare ID", id: true },
                { name: "sourceStation", label: "From", nested: "stationCode" },
                { name: "destStation", label: "To", nested: "stationCode" },
                { name: "baseFare", label: "Price", currency: true }
            ]
        },
        tickets: {
            title: "Tickets", singular: "Ticket", endpoint: "/api/tickets", id: "ticketId",
            description: "Issue tickets, check passenger journeys and validate entry.",
            columns: [
                { name: "ticketId", label: "Ticket", id: true },
                { name: "passenger", label: "Passenger", nested: "contact" },
                { name: "sourceStation", label: "From", nested: "stationCode" },
                { name: "destStation", label: "To", nested: "stationCode" },
                { name: "ticketType", label: "Type" },
                { name: "isUsed", label: "Used", status: true }
            ]
        },
        cards: {
            title: "Metro cards", singular: "Metro card", endpoint: "/api/cards", id: "cardId",
            description: "Issue smart cards, track balances and manage top-ups.",
            columns: [
                { name: "cardId", label: "Card ID", id: true },
                { name: "passenger", label: "Passenger", nested: "contact" },
                { name: "balance", label: "Balance", currency: true },
                { name: "expiryDate", label: "Expires" },
                { name: "isActive", label: "Status", status: true }
            ]
        },
        payments: {
            title: "Payments", singular: "Payment", endpoint: "/api/payments", id: "paymentId",
            description: "Review ticket payments and payment records.",
            columns: [
                { name: "paymentId", label: "Payment ID", id: true },
                { name: "ticket", label: "Ticket", nested: "ticketId" },
                { name: "amount", label: "Amount", currency: true },
                { name: "createdAt", label: "Created" }
            ]
        },
        maintenance: {
            title: "Maintenance", singular: "Issue", endpoint: "/api/maintenance", id: "issueId",
            description: "Track faults across stations and trains, from report to resolution.",
            columns: [
                { name: "issueId", label: "Issue ID", id: true },
                { name: "issueType", label: "Issue" },
                { name: "train", label: "Train", nested: "trainNumber" },
                { name: "station", label: "Station", nested: "stationCode" },
                { name: "priority", label: "Priority", status: true },
                { name: "status", label: "Status", status: true }
            ]
        },
        users: {
            title: "Users", singular: "User", endpoint: "/api/users", id: "userId",
            description: "Manage passenger, agent, maintenance and administrator accounts.",
            columns: [
                { name: "contact", label: "Account" },
                { name: "userId", label: "User ID", id: true },
                { name: "firstName", label: "First name" },
                { name: "lastName", label: "Last name" },
                { name: "role", label: "Role" },
                { name: "isActive", label: "Status", status: true }
            ]
        }
    };

    const apiEndpoints = [
        ["GET", "/api/auth/me", "Current account", null],
        ["POST", "/api/auth/passenger/register", "Register passenger", { firstName: "Asha", lastName: "Rao", contact: "asha@example.com", password: "ChangeMe123!" }],
        ["POST", "/api/auth/employee/hire", "Hire employee (admin)", { firstName: "Asha", lastName: "Rao", contact: "asha.agent", password: "ChangeMe123!", role: "TICKET_AGENT", stationId: "STN-VSV" }],
        ["POST", "/api/users", "Create user (admin)", { firstName: "Asha", lastName: "Rao", contact: "asha@example.com", password: "ChangeMe123!", role: "PASSENGER" }],
        ["GET", "/api/users", "List users (admin)", null],
        ["GET", "/api/users/:id", "Get user (admin)", null],
        ["PUT", "/api/users/:id", "Update user (admin)", { firstName: "Asha", lastName: "Rao" }],
        ["PATCH", "/api/users/:id", "Partially update user (admin)", { isActive: false }],
        ["DELETE", "/api/users/:id", "Delete user (admin)", null],
        ["POST", "/api/stations", "Create station (admin)", { stationCode: "NEW", lineColor: "Blue", isActive: true }],
        ["GET", "/api/stations", "List stations", null],
        ["GET", "/api/stations/:id", "Get station", null],
        ["PUT", "/api/stations/:id", "Update station (admin)", { stationCode: "NEW", lineColor: "Blue", isActive: true }],
        ["PATCH", "/api/stations/:id", "Partially update station (admin)", { lineColor: "Green" }],
        ["DELETE", "/api/stations/:id", "Delete station (admin)", null],
        ["POST", "/api/trains", "Create train (admin)", { trainNumber: "M9", capacity: 1600, totalCoaches: 8, manufactureYear: 2025, isActive: true }],
        ["GET", "/api/trains", "List trains", null],
        ["GET", "/api/trains/:id", "Get train", null],
        ["PUT", "/api/trains/:id", "Update train (admin)", { trainNumber: "M9", capacity: 1600, totalCoaches: 8, manufactureYear: 2025 }],
        ["PATCH", "/api/trains/:id", "Partially update train (admin)", { capacity: 1800 }],
        ["DELETE", "/api/trains/:id", "Delete train (admin)", null],
        ["POST", "/api/routes", "Create route (admin)", { routeName: "New line", startStationId: "STN-VSV", endStationId: "STN-GHP", stationIds: ["STN-VSV", "STN-GHP"] }],
        ["GET", "/api/routes", "List routes", null],
        ["GET", "/api/routes/:id", "Get route", null],
        ["PUT", "/api/routes/:id", "Update route (admin)", { routeName: "New line", startStationId: "STN-VSV", endStationId: "STN-GHP", stationIds: ["STN-VSV", "STN-GHP"] }],
        ["PATCH", "/api/routes/:id", "Partially update route (admin)", { lineColor: "Green" }],
        ["DELETE", "/api/routes/:id", "Delete route (admin)", null],
        ["POST", "/api/schedules", "Create schedule (admin)", { trainId: "TRN-101", routeId: "RT-L1", scheduledDeparture: "2026-10-27T06:00:00", scheduledArrival: "2026-10-27T06:45:00", dayOfWeek: "DAILY" }],
        ["GET", "/api/schedules", "List schedules", null],
        ["GET", "/api/schedules/:id", "Get schedule", null],
        ["PUT", "/api/schedules/:id", "Update schedule (admin)", { trainId: "TRN-101", routeId: "RT-L1", scheduledDeparture: "2026-10-27T06:00:00", scheduledArrival: "2026-10-27T06:45:00" }],
        ["PATCH", "/api/schedules/:id", "Partially update schedule (admin)", { isActive: false }],
        ["DELETE", "/api/schedules/:id", "Delete schedule (admin)", null],
        ["POST", "/api/fares", "Create fare (admin)", { sourceStationId: "STN-VSV", destStationId: "STN-GHP", baseFare: 40 }],
        ["GET", "/api/fares", "List fares", null],
        ["GET", "/api/fares/lookup?sourceStationId=STN-VSV&destStationId=STN-GHP", "Look up journey fare", null],
        ["GET", "/api/fares/:id", "Get fare", null],
        ["PUT", "/api/fares/:id", "Update fare (admin)", { sourceStationId: "STN-VSV", destStationId: "STN-GHP", baseFare: 40 }],
        ["PATCH", "/api/fares/:id", "Partially update fare (admin)", { baseFare: 45 }],
        ["DELETE", "/api/fares/:id", "Delete fare (admin)", null],
        ["POST", "/api/tickets", "Book ticket", { sourceStationId: "STN-VSV", destStationId: "STN-GHP", ticketType: "SINGLE" }],
        ["GET", "/api/tickets", "List tickets (admin/agent)", null],
        ["GET", "/api/tickets/:id", "Get ticket", null],
        ["GET", "/api/tickets/passenger/:passengerId", "Tickets by passenger", null],
        ["PATCH", "/api/tickets/:id/use", "Mark ticket used", null],
        ["DELETE", "/api/tickets/:id", "Delete ticket (admin)", null],
        ["POST", "/api/cards", "Issue metro card", { passengerId: "PASS-SEED1", balance: 0 }],
        ["POST", "/api/cards/:id/topup?amount=100", "Top up card", null],
        ["GET", "/api/cards", "List cards (admin/agent)", null],
        ["GET", "/api/cards/:id", "Get card", null],
        ["GET", "/api/cards/passenger/:passengerId", "Cards by passenger", null],
        ["PATCH", "/api/cards/:id/deactivate", "Deactivate card (admin/agent)", null],
        ["DELETE", "/api/cards/:id", "Delete card (admin)", null],
        ["POST", "/api/payments", "Create payment", { ticketId: "TKT-REPLACE", amount: 40 }],
        ["GET", "/api/payments", "List payments (admin/agent)", null],
        ["GET", "/api/payments/:id", "Get payment", null],
        ["GET", "/api/payments/ticket/:ticketId", "Payments by ticket", null],
        ["DELETE", "/api/payments/:id", "Delete payment (admin)", null],
        ["POST", "/api/maintenance", "Report maintenance issue", { issueType: "Signal fault", description: "Signal check required", priority: "MEDIUM", stationId: "STN-VSV" }],
        ["GET", "/api/maintenance", "List issues (admin/maintenance)", null],
        ["GET", "/api/maintenance/:id", "Get issue", null],
        ["GET", "/api/maintenance/train/:trainId", "Issues by train", null],
        ["GET", "/api/maintenance/station/:stationId", "Issues by station", null],
        ["GET", "/api/maintenance/status/:status", "Issues by status (admin/maintenance)", null],
        ["PUT", "/api/maintenance/:id", "Update issue (admin/maintenance)", { issueType: "Signal fault", description: "Signal check required", status: "In Progress", priority: "HIGH" }],
        ["PATCH", "/api/maintenance/:id", "Partially update issue (admin/maintenance)", { priority: "HIGH" }],
        ["PATCH", "/api/maintenance/:id/resolve", "Resolve issue (admin/maintenance)", null],
        ["DELETE", "/api/maintenance/:id", "Delete issue (admin)", null]
    ];

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        })[character]);
    }

    function userHasRole(...roles) {
        return Boolean(state.user && roles.includes(state.user.role));
    }

    function apiUrl(path) {
        return path.startsWith("/") ? path : `/${path}`;
    }

    async function request(path, options = {}) {
        const headers = new Headers(options.headers || {});
        if (state.token) headers.set("Authorization", `Basic ${state.token}`);
        if (options.body !== undefined) headers.set("Content-Type", "application/json");
        let response;
        try {
            response = await fetch(apiUrl(path), {
                ...options,
                headers,
                body: options.body === undefined ? undefined : JSON.stringify(options.body)
            });
        } catch (error) {
            throw new Error(`Could not reach the API. Check that the application is running and try again. ${error.message}`);
        }

        const text = await response.text();
        let body = null;
        if (text) {
            try {
                body = JSON.parse(text);
            } catch {
                body = text;
            }
        }

        if (!response.ok) {
            const detail = typeof body === "string" ? body : body?.message || body?.error || body?.detail;
            const message = response.status === 401
                ? "Sign-in failed or your credentials have expired. Sign out and sign in again."
                : response.status === 403
                    ? "Your account does not have permission to perform this action."
                    : detail || `Request failed with HTTP ${response.status}.`;
            const error = new Error(message);
            error.status = response.status;
            error.body = body;
            throw error;
        }
        return { status: response.status, body };
    }

    function notify(message, isError = false) {
        const toast = document.createElement("div");
        toast.className = `toast${isError ? " error" : ""}`;
        toast.innerHTML = `<span class="toast-icon">${isError ? "!" : "✓"}</span><span>${escapeHtml(message)}</span>`;
        $("#toast-region").append(toast);
        window.setTimeout(() => toast.remove(), 4800);
    }

    function fullName(user = state.user) {
        return [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.contact || "Metro user";
    }

    function signOut() {
        state.token = "";
        state.user = null;
        state.page = "dashboard";
        $("#application").classList.add("hidden");
        $("#login-screen").classList.remove("hidden");
        $("#login-password").value = "";
        $("#login-contact").focus();
    }

    async function signIn(contact, password) {
        const token = btoa(unescape(encodeURIComponent(`${contact}:${password}`)));
        const previousToken = state.token;
        state.token = token;
        try {
            const { body } = await request("/api/auth/me");
            state.user = body;
            $("#login-error").textContent = "";
            $("#login-screen").classList.add("hidden");
            $("#application").classList.remove("hidden");
            renderShell();
            await navigate("dashboard");
        } catch (error) {
            state.token = previousToken;
            throw error;
        }
    }

    function renderShell() {
        const name = fullName();
        const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
        $("#user-display").textContent = name;
        $("#user-role").textContent = (state.user?.role || "Network team").replaceAll("_", " ");
        $("#user-avatar").textContent = initials;
        $("#topbar-avatar").textContent = initials;
        $("#topbar-name").textContent = state.user?.contact || "User";
        $("#today-label").textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date());

        $("#main-navigation").innerHTML = sections.map(section => {
            const items = section.items.filter(item => !item.roles || userHasRole(...item.roles));
            if (!items.length) return "";
            return `<div class="nav-section-title">${escapeHtml(section.title)}</div>${items.map(item =>
                `<button class="nav-item${item.id === state.page ? " active" : ""}" type="button" data-page="${item.id}"><span class="nav-icon">${item.icon}</span><span>${escapeHtml(item.label)}</span></button>`
            ).join("")}`;
        }).join("");
    }

    function setPageHeading(title, description, action = "") {
        $("#breadcrumb-current").textContent = title;
        return `<div class="page-heading"><div><span class="eyebrow">METRO NETWORK · ${escapeHtml(title.toUpperCase())}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div><div class="heading-actions">${action}</div></div>`;
    }

    async function navigate(page, options = {}) {
        state.page = page;
        state.search = "";
        if (!options.preserveFilters) state.filters = {};
        renderShell();
        $("#sidebar").classList.remove("open");
        const content = $("#page-content");
        content.innerHTML = `<div class="loading-line"></div>`;
        content.focus();

        try {
            if (page === "dashboard") {
                await renderDashboard(content);
            } else if (page === "api") {
                renderApiExplorer(content);
            } else if (resources[page]) {
                await renderResource(content, page);
            }
        } catch (error) {
            content.innerHTML = `${setPageHeading(resources[page]?.title || "Overview", "The requested page could not be loaded.")}<div class="table-error">${escapeHtml(error.message)}</div>`;
            notify(error.message, true);
        }
    }

    async function renderDashboard(content) {
        const greeting = state.user?.firstName ? `Welcome back, ${state.user.firstName}.` : `Welcome back, ${state.user?.contact || "team"}.`;
        const [stations, trains, routes, tickets, maintenance] = await Promise.allSettled([
            request("/api/stations"),
            request("/api/trains"),
            request("/api/routes"),
            userHasRole("ADMIN", "TICKET_AGENT")
                ? request("/api/tickets")
                : request(`/api/tickets/passenger/${encodeURIComponent(state.user.userId)}`),
            userHasRole("ADMIN", "MAINTENANCE_STAFF")
                ? request("/api/maintenance")
                : Promise.reject(new Error("Not available for this role"))
        ]);

        const count = result => result.status === "fulfilled" && Array.isArray(result.value.body) ? result.value.body.length : "—";
        const routeRows = routes.status === "fulfilled" && Array.isArray(routes.value.body) ? routes.value.body.slice(0, 4) : [];
        const issueCount = maintenance.status === "fulfilled" && Array.isArray(maintenance.value.body)
            ? maintenance.value.body.filter(issue => issue.status !== "Closed").length
            : "—";
        const ticketNote = tickets.status === "fulfilled" && Array.isArray(tickets.value.body)
            ? "Available to your account"
            : userHasRole("ADMIN", "TICKET_AGENT") ? "Across the network" : "Your journeys";

        content.innerHTML = `
            <section class="welcome-banner">
                <div class="welcome-copy"><span class="eyebrow">${escapeHtml(new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase())} · NETWORK OPERATIONS</span><h1>${escapeHtml(greeting)}</h1><p>Here’s what’s happening across your metro network today.</p></div>
                <div class="welcome-visual" aria-hidden="true">⌁</div>
            </section>
            <section class="stat-grid" aria-label="Network overview">
                ${statCard("Active stations", count(stations), "Across every metro line", "◎", "mint")}
                ${statCard("Fleet trains", count(trains), "Vehicles in the network", "↝", "blue")}
                ${statCard("Routes", count(routes), "Connected journeys", "⌁", "violet")}
                ${statCard("Open issues", issueCount, "Maintenance follow-up", "⚒", "amber")}
            </section>
            <div class="dashboard-grid">
                <section class="panel">
                    <div class="panel-header"><div><h2>Network routes</h2><p>A quick look at connected metro lines</p></div><button class="panel-link" data-page="routes">View all routes →</button></div>
                    <div class="route-list">${routeRows.length ? routeRows.map(route => `
                        <div class="route-row"><span class="route-line" style="--route-color:${safeColor(route.lineColor)}"></span><div class="route-row-main"><strong>${escapeHtml(route.routeName || route.routeId)}</strong><small>${escapeHtml(route.lineColor || "Metro line")} · ${escapeHtml(route.stationIds?.length ?? 0)} stops</small></div><span class="route-meta">${escapeHtml(route.totalDistance ?? "—")} km</span></div>
                    `).join("") : `<div class="empty-state"><strong>Routes will appear here</strong>Once routes are available, they’ll be listed here.</div>`}</div>
                </section>
                <section class="panel">
                    <div class="panel-header"><div><h2>Quick actions</h2><p>Jump straight into your daily work</p></div></div>
                    <div class="quick-actions">
                        ${quickAction("tickets", "New ticket", "Book a journey", "▤")}
                        ${quickAction("cards", "Issue a metro card", "Set up a smart card", "▣")}
                        ${quickAction("maintenance", "Report an issue", "Keep the network moving", "⚒")}
                        ${quickAction("fares", "Check a fare", "Price a station-to-station trip", "₹")}
                    </div>
                </section>
            </div>
            <section class="panel" style="margin-top:17px">
                <div class="panel-header"><div><h2>${userHasRole("ADMIN", "TICKET_AGENT") ? "Network tickets" : "Your journeys"}</h2><p>${escapeHtml(ticketNote)} · ${escapeHtml(count(tickets))} tickets</p></div><button class="panel-link" data-page="tickets">Open tickets →</button></div>
                <div class="panel-header" style="border:0"><p>Need to manage a resource? Use the network and service sections in the sidebar.</p></div>
            </section>`;
    }

    function statCard(label, value, note, icon, color) {
        return `<article class="stat-card"><div class="stat-card-top"><span class="stat-card-label">${escapeHtml(label)}</span><span class="stat-icon ${color}">${icon}</span></div><strong class="stat-value">${escapeHtml(value)}</strong><span class="stat-note">${escapeHtml(note)}</span></article>`;
    }

    function quickAction(page, title, detail, icon) {
        return `<button class="quick-action" type="button" data-page="${page}"><span class="quick-action-icon">${icon}</span><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></span></button>`;
    }

    function safeColor(value) {
        const colors = { blue: "#6486e8", aqua: "#2bbda9", red: "#de6a6d", green: "#2caa81", purple: "#8d77dc", orange: "#e9a74b" };
        return colors[String(value || "").toLowerCase()] || "#6486e8";
    }

    function canCreate(page) {
        if (["stations", "trains", "routes", "schedules", "fares", "users"].includes(page)) return userHasRole("ADMIN");
        if (page === "tickets") return userHasRole("ADMIN", "TICKET_AGENT", "PASSENGER");
        if (page === "cards") return userHasRole("ADMIN", "TICKET_AGENT", "PASSENGER");
        if (page === "payments") return userHasRole("TICKET_AGENT", "PASSENGER");
        if (page === "maintenance") return userHasRole("ADMIN", "MAINTENANCE_STAFF", "TICKET_AGENT");
        return false;
    }

    function canEdit(page) {
        if (["stations", "trains", "routes", "schedules", "fares", "users"].includes(page)) return userHasRole("ADMIN");
        if (page === "maintenance") return userHasRole("ADMIN", "MAINTENANCE_STAFF");
        return false;
    }

    function canDelete(page) {
        return userHasRole("ADMIN") && page !== "tickets" && page !== "payments" && page !== "cards" && page !== "maintenance"
            ? true
            : userHasRole("ADMIN");
    }

    function collectionPath(page) {
        if (page === "tickets" && userHasRole("PASSENGER")) return `/api/tickets/passenger/${encodeURIComponent(state.user.userId)}`;
        if (page === "cards" && userHasRole("PASSENGER")) return `/api/cards/passenger/${encodeURIComponent(state.user.userId)}`;
        if (page === "payments" && !userHasRole("ADMIN", "TICKET_AGENT")) {
            if (!state.filters.ticketId) return null;
            return `/api/payments/ticket/${encodeURIComponent(state.filters.ticketId)}`;
        }
        if (page === "maintenance" && userHasRole("TICKET_AGENT")) {
            if (state.filters.trainId) return `/api/maintenance/train/${encodeURIComponent(state.filters.trainId)}`;
            if (state.filters.stationId) return `/api/maintenance/station/${encodeURIComponent(state.filters.stationId)}`;
            return null;
        }
        if (page === "maintenance" && state.filters.status) return `/api/maintenance/status/${encodeURIComponent(state.filters.status)}`;
        if (page === "maintenance" && state.filters.trainId) return `/api/maintenance/train/${encodeURIComponent(state.filters.trainId)}`;
        if (page === "maintenance" && state.filters.stationId) return `/api/maintenance/station/${encodeURIComponent(state.filters.stationId)}`;
        return resources[page].endpoint;
    }

    function actionBar(page) {
        const actions = [];
        if (["tickets", "cards", "payments"].includes(page)) {
            actions.push(`<button class="button button-secondary" type="button" data-action="lookup-${page}"><span class="button-icon">⌕</span>${lookupLabel(page)}</button>`);
        }
        if (page === "fares") actions.push(`<button class="button button-secondary" type="button" data-action="fare-lookup"><span class="button-icon">₹</span>Check a fare</button>`);
        if (page === "maintenance") actions.push(`<button class="button button-secondary" type="button" data-action="maintenance-filter"><span class="button-icon">⌕</span>Filter issues</button>`);
        if (page === "users" && userHasRole("ADMIN")) actions.push(`<button class="button button-secondary" type="button" data-action="hire-employee">Hire employee</button>`);
        if (canCreate(page)) actions.push(`<button class="button button-primary" type="button" data-action="create"><span class="button-icon">＋</span>${page === "tickets" ? "Book a ticket" : `Add ${resources[page].singular.toLowerCase()}`}</button>`);
        return actions.join("");
    }

    function lookupLabel(page) {
        if (page === "tickets") return "Tickets by passenger";
        if (page === "cards") return "Cards by passenger";
        return "Payments by ticket";
    }

    async function renderResource(content, page) {
        const resource = resources[page];
        content.innerHTML = `${setPageHeading(resource.title, resource.description, actionBar(page))}<div class="loading-line"></div>`;
        let path = collectionPath(page);
        let loadError = "";
        let rows = [];
        if (path) {
            try {
                const { body } = await request(path);
                rows = Array.isArray(body) ? body : [];
            } catch (error) {
                loadError = error.message;
            }
        }
        state.rows = rows;
        content.innerHTML = `${setPageHeading(resource.title, resource.description, actionBar(page))}
            ${resourceFilters(page)}
            <div class="toolbar"><label class="search-box"><span>⌕</span><input id="table-search" type="search" placeholder="Search ${escapeHtml(resource.title.toLowerCase())}..." aria-label="Search ${escapeHtml(resource.title)}"></label><span class="table-count">${rows.length} ${rows.length === 1 ? "record" : "records"}</span></div>
            ${loadError ? `<div class="table-error"><span>${escapeHtml(loadError)}</span><button class="button button-secondary" type="button" data-action="refresh">Try again</button></div>` : ""}
            ${!path ? filterPrompt(page) : renderTable(page, rows)}`;
        const search = $("#table-search");
        if (search) search.addEventListener("input", () => {
            state.search = search.value;
            const table = $("#resource-table");
            if (table) table.outerHTML = renderTable(page, filteredRows(page, state.rows));
            const countLabel = $(".table-count");
            if (countLabel) countLabel.textContent = `${filteredRows(page, state.rows).length} ${filteredRows(page, state.rows).length === 1 ? "record" : "records"}`;
        });
    }

    function resourceFilters(page) {
        if (page === "payments" && !userHasRole("ADMIN", "TICKET_AGENT")) {
            return `<div class="filter-row"><input id="filter-ticket-id" aria-label="Ticket ID" placeholder="Enter a ticket ID to find payments" value="${escapeHtml(state.filters.ticketId || "")}"><button class="button button-secondary" type="button" data-action="filter-payments">Find payments</button></div>`;
        }
        if (page === "maintenance") {
            return `<div class="filter-row">
                <input id="filter-train-id" aria-label="Train ID filter" placeholder="Filter by train ID" value="${escapeHtml(state.filters.trainId || "")}">
                <input id="filter-station-id" aria-label="Station ID filter" placeholder="Filter by station ID" value="${escapeHtml(state.filters.stationId || "")}">
                ${userHasRole("ADMIN", "MAINTENANCE_STAFF") ? `<select id="filter-status" aria-label="Filter by issue status"><option value="">All statuses</option>${["Open", "In Progress", "Closed"].map(status => `<option${state.filters.status === status ? " selected" : ""}>${status}</option>`).join("")}</select>` : ""}
                <button class="button button-secondary" type="button" data-action="filter-maintenance">Apply filters</button>
                <button class="button button-secondary" type="button" data-action="clear-maintenance">Clear</button>
            </div>`;
        }
        return "";
    }

    function filterPrompt(page) {
        const message = page === "payments"
            ? "Enter a ticket ID above to see its payments. Passengers can only access payments for their own tickets."
            : "Search by train or station ID to see the related maintenance issues.";
        return `<div class="panel"><div class="empty-state"><strong>Choose a filter to continue</strong>${escapeHtml(message)}</div></div>`;
    }

    function filteredRows(page, rows) {
        const query = (state.search || "").toLowerCase().trim();
        if (!query) return rows;
        return rows.filter(row => JSON.stringify(row).toLowerCase().includes(query));
    }

    function displayValue(row, column) {
        let value = column.nested ? row[column.name]?.[column.nested] : row[column.name];
        if (column.list && Array.isArray(value)) value = value.length;
        if (value === null || value === undefined || value === "") return "—";
        if (column.status) {
            if (column.name === "isUsed") {
                return `<span class="status-pill ${value ? "closed" : ""}">${value ? "Used" : "Unused"}</span>`;
            }
            const isFalse = value === false || ["false", "inactive", "closed", "used"].includes(String(value).toLowerCase());
            const status = String(value);
            const className = isFalse ? "inactive" : status.toLowerCase().replaceAll(" ", "-");
            return `<span class="status-pill ${escapeHtml(className)}">${escapeHtml(status === "true" ? "Active" : status === "false" ? "Inactive" : status)}</span>`;
        }
        if (column.currency) return `₹${escapeHtml(Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}`;
        if (column.id) return `<span class="cell-id">${escapeHtml(value)}</span>`;
        if (column.name === "stationCode" || column.name === "trainNumber" || column.name === "contact" || column.name === "routeName" || column.name === "issueType") {
            return `<span class="cell-primary">${escapeHtml(value)}</span>`;
        }
        return escapeHtml(value);
    }

    function renderTable(page, sourceRows) {
        const resource = resources[page];
        const rows = sourceRows || filteredRows(page, state.rows);
        if (!rows.length) {
            return `<div id="resource-table" class="panel"><div class="empty-state"><strong>No ${escapeHtml(resource.title.toLowerCase())} found</strong>When records are available, they’ll show up here.</div></div>`;
        }
        const rowActions = canEdit(page) || canDelete(page) || page === "tickets" || page === "cards" || page === "maintenance";
        return `<div id="resource-table" class="table-wrap"><table class="data-table"><thead><tr>${resource.columns.map(column => `<th>${escapeHtml(column.label)}</th>`).join("")}${rowActions ? "<th style=\"text-align:right\">Actions</th>" : ""}</tr></thead><tbody>${rows.map(row => {
            const id = row[resource.id];
            return `<tr>${resource.columns.map(column => `<td>${displayValue(row, column)}${column.name === "stationCode" ? `<span class="cell-sub">${escapeHtml(row.address || row.lineColor || "")}</span>` : ""}</td>`).join("")}${rowActions ? `<td><div class="row-actions">
                <button class="row-action" type="button" data-row-action="detail" data-id="${escapeHtml(id)}">View</button>
                ${canEdit(page) ? `<button class="row-action" type="button" data-row-action="edit" data-id="${escapeHtml(id)}">Edit</button>` : ""}
                ${page === "tickets" && !row.isUsed && userHasRole("ADMIN", "TICKET_AGENT", "PASSENGER") ? `<button class="row-action" type="button" data-row-action="use-ticket" data-id="${escapeHtml(id)}">Validate</button>` : ""}
                ${page === "cards" && row.isActive && userHasRole("ADMIN", "TICKET_AGENT") ? `<button class="row-action" type="button" data-row-action="deactivate-card" data-id="${escapeHtml(id)}">Deactivate</button>` : ""}
                ${page === "maintenance" && row.status?.toLowerCase() !== "closed" && userHasRole("ADMIN", "MAINTENANCE_STAFF") ? `<button class="row-action" type="button" data-row-action="resolve-issue" data-id="${escapeHtml(id)}">Resolve</button>` : ""}
                ${canDelete(page) ? `<button class="row-action danger" type="button" data-row-action="delete" data-id="${escapeHtml(id)}">Delete</button>` : ""}
            </div></td>` : ""}</tr>`;
        }).join("")}</tbody></table></div>`;
    }

    function fieldRecordValue(record, name) {
        if (!record) return undefined;
        if (name === "startStationId") return record.startStation?.stationId || record.startStationId;
        if (name === "endStationId") return record.endStation?.stationId || record.endStationId;
        if (name === "sourceStationId") return record.sourceStation?.stationId || record.sourceStationId;
        if (name === "destStationId") return record.destStation?.stationId || record.destStationId;
        if (name === "trainId") return record.train?.trainId || record.trainId;
        if (name === "routeId") return record.route?.routeId || record.routeId;
        if (name === "passengerId") return record.passenger?.userId || record.passengerId;
        if (name === "ticketId") return record.ticket?.ticketId || record.ticketId;
        if (name === "stationId") return record.station?.stationId || record.stationId;
        if (name === "reportedById") return record.reportedBy?.userId || record.reportedById;
        return record[name];
    }

    function inputMarkup(field, value, options = {}) {
        const type = field.type || "text";
        const name = escapeHtml(field.name);
        const label = escapeHtml(field.label);
        const checked = value === true || (value === undefined && field.defaultValue === true);
        const required = field.required || (!options.editing && field.requiredOnCreate);
        let input;
        if (type === "textarea") {
            const textValue = Array.isArray(value) ? value.join(", ") : value ?? "";
            input = `<textarea class="field-control" name="${name}" id="field-${name}" ${required ? "required" : ""} placeholder="${escapeHtml(field.hint || "")}">${escapeHtml(textValue)}</textarea>`;
        } else if (type === "select") {
            input = `<select class="field-control" name="${name}" id="field-${name}" ${required ? "required" : ""}><option value="">Choose…</option>${(field.options || []).map(option => `<option value="${escapeHtml(option)}"${String(value ?? field.defaultValue ?? "") === option ? " selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select>`;
        } else if (type === "checkbox") {
            input = `<input class="checkbox-control" type="checkbox" name="${name}" id="field-${name}"${checked ? " checked" : ""}>`;
        } else {
            let formattedValue = value ?? field.defaultValue ?? "";
            if (type === "datetime-local" && formattedValue) formattedValue = String(formattedValue).slice(0, 16);
            input = `<input class="field-control" type="${escapeHtml(type)}" name="${name}" id="field-${name}" value="${escapeHtml(formattedValue)}" ${field.min ? `min="${escapeHtml(field.min)}"` : ""} ${field.step ? `step="${escapeHtml(field.step)}"` : ""} ${required ? "required" : ""} placeholder="${escapeHtml(field.hint || "")}">`;
        }
        return `<div class="form-field${field.full ? " full" : ""}">${type === "checkbox" ? `<label for="field-${name}">${label}</label><div>${input}</div>` : `<label for="field-${name}">${label}${required ? " *" : ""}</label>${input}`}${field.hint && type !== "text" && type !== "textarea" ? `<small class="cell-sub">${escapeHtml(field.hint)}</small>` : field.hint && type === "textarea" ? `<small class="cell-sub">${escapeHtml(field.hint)}</small>` : ""}</div>`;
    }

    function openRecordDialog(page, record = null, mode = "create", preset = {}) {
        const resource = resources[page];
        const fieldList = fields[page].filter(field => {
            if (field.staffOnly && userHasRole("PASSENGER")) return false;
            if (field.editOnly) return Boolean(record);
            return true;
        });
        const values = { ...(record || {}), ...preset };
        const verb = mode === "edit" ? "Save changes" : page === "tickets" ? "Book ticket" : `Create ${resource.singular.toLowerCase()}`;
        dialogContent.innerHTML = `
            <div class="dialog-header"><div><span class="eyebrow">${escapeHtml(mode === "edit" ? "UPDATE RECORD" : "NEW RECORD")}</span><h2>${escapeHtml(mode === "edit" ? `Edit ${resource.singular.toLowerCase()}` : `Add ${resource.singular.toLowerCase()}`)}</h2></div><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">×</button></div>
            <div class="dialog-body"><form id="record-form" class="inline-form" data-resource="${page}" data-mode="${mode}" data-id="${escapeHtml(record?.[resource.id] || "")}">
                ${fieldList.map(field => inputMarkup(field, fieldRecordValue(values, field.name), { editing: mode === "edit" })).join("")}
                <div class="form-error" id="record-form-error" role="alert"></div>
                <div class="dialog-footer"><button class="button button-secondary" type="button" data-action="close-dialog">Cancel</button><button class="button button-primary" type="submit">${escapeHtml(verb)}</button></div>
            </form></div>`;
        dialog.showModal();
        $("#record-form input:not([type=checkbox]), #record-form select, #record-form textarea")?.focus();
    }

    function formPayload(form, page, mode) {
        const payload = {};
        for (const field of fields[page]) {
            if (field.staffOnly && userHasRole("PASSENGER")) continue;
            if (field.editOnly && mode !== "edit") continue;
            const input = $(`[name="${field.name}"]`, form);
            if (!input) continue;
            if (field.type === "checkbox") {
                payload[field.name] = input.checked;
                continue;
            }
            const value = input.value.trim();
            if (!value) {
                if (field.name === "password" && mode === "edit") continue;
                if (field.name === "stationIds" || field.name === "validFrom" || field.name === "validTo" || field.name === "validUntil") continue;
                if (field.name === "status" && mode === "edit") continue;
                if (field.type === "select" || field.required || (!mode || mode !== "edit") && field.requiredOnCreate) continue;
                continue;
            }
            if (["latitude", "longitude", "capacity", "totalCoaches", "manufactureYear", "estimatedTime"].includes(field.name)) {
                payload[field.name] = Number(value);
            } else if (["totalDistance", "baseFare", "balance"].includes(field.name)) {
                payload[field.name] = Number(value);
            } else if (field.name === "stationIds") {
                payload.stationIds = value.split(",").map(item => item.trim()).filter(Boolean);
            } else {
                payload[field.name] = value;
            }
        }
        if (page === "maintenance" && mode !== "edit") {
            delete payload.status;
        }
        return payload;
    }

    async function submitRecord(form) {
        const page = form.dataset.resource;
        const mode = form.dataset.mode;
        const id = form.dataset.id;
        const errorNode = $("#record-form-error", form);
        const payload = formPayload(form, page, mode);
        const path = mode === "edit" ? `${resources[page].endpoint}/${encodeURIComponent(id)}` : resources[page].endpoint;
        const submit = $("button[type=submit]", form);
        submit.disabled = true;
        submit.textContent = "Saving…";
        try {
            await request(path, { method: mode === "edit" ? "PUT" : "POST", body: payload });
            dialog.close();
            notify(`${resources[page].singular} ${mode === "edit" ? "updated" : "created"} successfully.`);
            await navigate(page);
        } catch (error) {
            errorNode.textContent = error.message;
            notify(error.message, true);
        } finally {
            submit.disabled = false;
            submit.textContent = mode === "edit" ? "Save changes" : page === "tickets" ? "Book ticket" : `Create ${resources[page].singular.toLowerCase()}`;
        }
    }

    async function rowAction(action, page, id) {
        const resource = resources[page];
        const path = `${resource.endpoint}/${encodeURIComponent(id)}`;
        try {
            if (action === "detail") {
                const { body } = await request(path);
                showJsonResult(`${resource.singular} details`, body);
            } else if (action === "edit") {
                const { body } = await request(path);
                openRecordDialog(page, body, "edit");
            } else if (action === "delete") {
                if (!window.confirm(`Delete this ${resource.singular.toLowerCase()}? This cannot be undone.`)) return;
                await request(path, { method: "DELETE" });
                notify(`${resource.singular} deleted.`);
                await navigate(page);
            } else if (action === "use-ticket") {
                await request(`${path}/use`, { method: "PATCH" });
                notify("Ticket validated and marked as used.");
                await navigate(page);
            } else if (action === "deactivate-card") {
                if (!window.confirm("Deactivate this metro card?")) return;
                await request(`${path}/deactivate`, { method: "PATCH" });
                notify("Metro card deactivated.");
                await navigate(page);
            } else if (action === "resolve-issue") {
                await request(`${path}/resolve`, { method: "PATCH" });
                notify("Maintenance issue resolved.");
                await navigate(page);
            }
        } catch (error) {
            notify(error.message, true);
        }
    }

    function showJsonResult(title, body, status) {
        const text = typeof body === "string" ? body : JSON.stringify(body, null, 2);
        apiResultContent.innerHTML = `<div class="dialog-header"><div><span class="eyebrow">${status ? `HTTP ${status}` : "RECORD DETAILS"}</span><h2>${escapeHtml(title)}</h2></div><button class="dialog-close" type="button" data-action="close-result" aria-label="Close">×</button></div><div class="dialog-body">${status ? `<p class="dialog-message">The request completed successfully.</p>` : ""}<pre class="json-view">${escapeHtml(text || "No response body.")}</pre><div class="dialog-footer"><button class="button button-secondary" type="button" data-action="close-result">Close</button></div></div>`;
        apiResultDialog.showModal();
    }

    function openLookupDialog(page) {
        const settings = {
            tickets: { title: "Find passenger tickets", label: "Passenger user ID", placeholder: state.user?.userId || "PASS-SEED1", path: "/api/tickets/passenger/" },
            cards: { title: "Find passenger cards", label: "Passenger user ID", placeholder: state.user?.userId || "PASS-SEED1", path: "/api/cards/passenger/" },
            payments: { title: "Find ticket payments", label: "Ticket ID", placeholder: "TKT-…", path: "/api/payments/ticket/" }
        }[page];
        openSimpleDialog(settings.title, `<form id="lookup-form" class="inline-form" data-page="${page}" data-prefix="${settings.path}"><div class="form-field full"><label for="lookup-value">${settings.label}</label><input id="lookup-value" class="field-control" required placeholder="${escapeHtml(settings.placeholder)}"></div><div class="dialog-footer form-submit"><button class="button button-secondary" type="button" data-action="close-dialog">Cancel</button><button class="button button-primary" type="submit">Search</button></div></form>`);
    }

    function openSimpleDialog(title, body, eyebrow = "API ACTION") {
        dialogContent.innerHTML = `<div class="dialog-header"><div><span class="eyebrow">${escapeHtml(eyebrow)}</span><h2>${escapeHtml(title)}</h2></div><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">×</button></div><div class="dialog-body">${body}</div>`;
        dialog.showModal();
        $("input, select, textarea", dialogContent)?.focus();
    }

    function openRegisterDialog() {
        const registrationFields = [
            { name: "firstName", label: "First name", required: true },
            { name: "lastName", label: "Last name", required: true },
            { name: "contact", label: "Username / contact", required: true },
            { name: "password", label: "Password", type: "password", required: true }
        ];
        openSimpleDialog("Create your passenger account", `<p class="dialog-message">Register to book metro tickets and manage your own metro card.</p><form id="register-form" class="inline-form">${registrationFields.map(field => inputMarkup(field, undefined)).join("")}<div class="form-error full" id="register-error" role="alert"></div><div class="dialog-footer form-submit"><button class="button button-secondary" type="button" data-action="close-dialog">Cancel</button><button class="button button-primary" type="submit">Create account</button></div></form>`, "PASSENGER REGISTRATION");
    }

    function openHireDialog() {
        const hireFields = [
            { name: "firstName", label: "First name", required: true },
            { name: "lastName", label: "Last name", required: true },
            { name: "contact", label: "Username / contact", required: true },
            { name: "password", label: "Temporary password", type: "password", required: true },
            { name: "role", label: "Employee role", type: "select", options: ["TICKET_AGENT", "MAINTENANCE_STAFF"], required: true },
            { name: "stationId", label: "Station ID", required: true }
        ];
        openSimpleDialog("Hire a network employee", `<form id="hire-form" class="inline-form">${hireFields.map(field => inputMarkup(field, undefined)).join("")}<div class="form-error full" id="hire-error" role="alert"></div><div class="dialog-footer form-submit"><button class="button button-secondary" type="button" data-action="close-dialog">Cancel</button><button class="button button-primary" type="submit">Hire employee</button></div></form>`, "WORKFORCE MANAGEMENT");
    }

    function renderApiExplorer(content) {
        const options = apiEndpoints.map((item, index) => `<option value="${index}">${escapeHtml(item[0])} · ${escapeHtml(item[2])} — ${escapeHtml(item[1])}</option>`).join("");
        content.innerHTML = `${setPageHeading("API explorer", "Run and inspect every project API operation with your signed-in account.", `<a class="button button-secondary" href="/swagger-ui/index.html" target="_blank" rel="noopener">Open Swagger UI ↗</a>`)}
            <div class="tool-panel">
                <section class="panel form-panel"><h2>Send a request</h2><p>Requests use your current sign-in. Server permissions still apply.</p>
                    <form id="api-form">
                        <div class="api-toolbar"><select id="api-endpoint" class="field-control" aria-label="API operation">${options}</select><select id="api-method" class="field-control" aria-label="HTTP method"><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select></div>
                        <input id="api-path" class="field-control api-path" aria-label="API path" required>
                        <label class="field-label" for="api-body" style="display:block;margin:12px 0 7px">Request body · JSON</label>
                        <textarea id="api-body" class="api-editor" spellcheck="false" aria-label="JSON request body" placeholder="Optional JSON request body"></textarea>
                        <div id="api-error" class="form-error" role="alert"></div>
                        <div class="dialog-footer"><button class="button button-secondary" type="reset">Reset</button><button class="button button-primary" type="submit">Send request <span>→</span></button></div>
                    </form>
                </section>
                <section class="panel"><div class="panel-header"><div><h2>Endpoint directory</h2><p>${apiEndpoints.length} operations across all 11 API groups</p></div></div>
                    <div class="operation-list">${["GET", "POST", "PUT", "PATCH", "DELETE"].map(method => `<div class="operation-button" style="cursor:default"><span class="operation-method">${method}</span><span><strong>${apiEndpoints.filter(item => item[0] === method).length} ${method} operations</strong><small>Choose a request template in the selector</small></span></div>`).join("")}</div>
                </section>
            </div>`;

        const selector = $("#api-endpoint");
        const applyEndpoint = () => {
            const endpoint = apiEndpoints[Number(selector.value)];
            $("#api-method").value = endpoint[0];
            const rawPath = endpoint[1];
            $("#api-path").value = rawPath.split("?")[0];
            if (rawPath.includes("?")) {
                const query = rawPath.slice(rawPath.indexOf("?"));
                $("#api-path").value += query;
            }
            $("#api-body").value = endpoint[3] ? JSON.stringify(endpoint[3], null, 2) : "";
        };
        selector.addEventListener("change", applyEndpoint);
        applyEndpoint();
    }

    async function submitApiForm(form) {
        const path = $("#api-path").value.trim();
        const method = $("#api-method").value;
        const rawBody = $("#api-body").value.trim();
        const errorNode = $("#api-error");
        errorNode.textContent = "";
        let body;
        if (rawBody && ["POST", "PUT", "PATCH"].includes(method)) {
            try {
                body = JSON.parse(rawBody);
            } catch (error) {
                errorNode.textContent = `Request body is not valid JSON: ${error.message}`;
                return;
            }
        }
        const submit = $("button[type=submit]", form);
        submit.disabled = true;
        submit.textContent = "Sending…";
        try {
            const result = await request(path, { method, ...(body === undefined ? {} : { body }) });
            showJsonResult(`${method} ${path}`, result.body, result.status);
        } catch (error) {
            errorNode.textContent = error.message;
            notify(error.message, true);
        } finally {
            submit.disabled = false;
            submit.innerHTML = "Send request <span>→</span>";
        }
    }

    async function submitLookup(form) {
        const page = form.dataset.page;
        const prefix = form.dataset.prefix;
        const value = $("#lookup-value", form).value.trim();
        const path = `${prefix}${encodeURIComponent(value)}`;
        try {
            const { body } = await request(path);
            dialog.close();
            if (Array.isArray(body)) {
                state.rows = body;
                state.filters = page === "payments" ? { ticketId: value } : {};
                state.search = "";
                notify(`Found ${body.length} ${resources[page].title.toLowerCase()}.`);
                const targetPage = page;
                await navigate(targetPage, { preserveFilters: true });
                if (targetPage === "tickets" || targetPage === "cards") {
                    state.rows = body;
                    const content = $("#page-content");
                    content.innerHTML = `${setPageHeading(resources[page].title, resources[page].description, actionBar(page))}
                        <div class="toolbar"><label class="search-box"><span>⌕</span><input id="table-search" type="search" placeholder="Search ${page}..." aria-label="Search"></label><span class="table-count">${body.length} records</span></div>${renderTable(page, body)}`;
                    $("#table-search").addEventListener("input", event => {
                        state.search = event.target.value;
                        $("#resource-table").outerHTML = renderTable(page, filteredRows(page, state.rows));
                    });
                }
            } else {
                showJsonResult(`${resources[page].title} lookup`, body);
            }
        } catch (error) {
            $("#lookup-error") && ($("#lookup-error").textContent = error.message);
            notify(error.message, true);
        }
    }

    async function fareLookup(form) {
        const source = $("#fare-source", form).value;
        const destination = $("#fare-destination", form).value;
        if (!source || !destination) {
            $("#fare-error", form).textContent = "Choose both origin and destination stations.";
            return;
        }
        try {
            const query = new URLSearchParams({ sourceStationId: source, destStationId: destination });
            const { body } = await request(`/api/fares/lookup?${query}`);
            showJsonResult("Journey fare", body);
        } catch (error) {
            $("#fare-error", form).textContent = error.message;
        }
    }

    async function loadStationsForFare() {
        const { body } = await request("/api/stations");
        return Array.isArray(body) ? body : [];
    }

    async function openFareLookup() {
        let stations;
        try {
            stations = await loadStationsForFare();
        } catch (error) {
            notify(error.message, true);
            return;
        }
        const options = stations.map(station => `<option value="${escapeHtml(station.stationId)}">${escapeHtml(station.stationCode)} — ${escapeHtml(station.stationId)}</option>`).join("");
        openSimpleDialog("Find a journey fare", `<form id="fare-lookup-form" class="inline-form">
            <div class="form-field"><label for="fare-source">Origin station</label><select class="field-control" id="fare-source" required><option value="">Choose station…</option>${options}</select></div>
            <div class="form-field"><label for="fare-destination">Destination station</label><select class="field-control" id="fare-destination" required><option value="">Choose station…</option>${options}</select></div>
            <div id="fare-error" class="form-error full" role="alert"></div>
            <div class="dialog-footer form-submit"><button class="button button-secondary" type="button" data-action="close-dialog">Cancel</button><button class="button button-primary" type="submit">Check fare</button></div>
        </form>`, "JOURNEY PLANNER");
    }

    async function openMaintenanceFilter() {
        if (userHasRole("ADMIN", "MAINTENANCE_STAFF")) {
            openSimpleDialog("Filter maintenance issues", `<form id="maintenance-status-form" class="inline-form"><div class="form-field full"><label for="maintenance-status">Issue status</label><select id="maintenance-status" class="field-control"><option>Open</option><option>In Progress</option><option>Closed</option></select></div><div class="dialog-footer form-submit"><button class="button button-secondary" type="button" data-action="close-dialog">Cancel</button><button class="button button-primary" type="submit">Apply</button></div></form>`, "ISSUE FILTER");
        } else {
            openSimpleDialog("Find maintenance issues", `<form id="maintenance-filter-form" class="inline-form"><div class="form-field full"><label for="maintenance-train">Train ID</label><input id="maintenance-train" class="field-control" placeholder="e.g. TRN-101"></div><div class="form-field full"><label for="maintenance-station">Station ID</label><input id="maintenance-station" class="field-control" placeholder="e.g. STN-VSV"></div><div class="form-error full" id="maintenance-filter-error" role="alert"></div><div class="dialog-footer form-submit"><button class="button button-secondary" type="button" data-action="close-dialog">Cancel</button><button class="button button-primary" type="submit">Search</button></div></form>`, "ISSUE FILTER");
        }
    }

    async function handleClick(event) {
        const pageButton = event.target.closest("[data-page]");
        if (pageButton) {
            event.preventDefault();
            await navigate(pageButton.dataset.page);
            return;
        }
        const demoButton = event.target.closest("[data-demo]");
        if (demoButton) {
            const credentials = {
                admin: ["admin", "admin123"],
                agent1: ["agent1", "Passw0rd!"],
                priya: ["priya", "Passw0rd!"]
            }[demoButton.dataset.demo];
            $("#login-contact").value = credentials[0];
            $("#login-password").value = credentials[1];
            $("#login-error").textContent = "";
            return;
        }
        const rowButton = event.target.closest("[data-row-action]");
        if (rowButton) {
            await rowAction(rowButton.dataset.rowAction, state.page, rowButton.dataset.id);
            return;
        }
        const actionButton = event.target.closest("[data-action]");
        if (!actionButton) return;
        const action = actionButton.dataset.action;
        if (action === "register") openRegisterDialog();
        else if (action === "create") openRecordDialog(state.page);
        else if (action === "hire-employee") openHireDialog();
        else if (action === "close-dialog") dialog.close();
        else if (action === "close-result") apiResultDialog.close();
        else if (action === "refresh") await navigate(state.page);
        else if (action === "fare-lookup") await openFareLookup();
        else if (action === "lookup-tickets" || action === "lookup-cards" || action === "lookup-payments") openLookupDialog(action.replace("lookup-", ""));
        else if (action === "maintenance-filter") await openMaintenanceFilter();
        else if (action === "filter-payments") {
            state.filters.ticketId = $("#filter-ticket-id").value.trim();
            await navigate("payments", { preserveFilters: true });
        } else if (action === "filter-maintenance") {
            state.filters.trainId = $("#filter-train-id").value.trim();
            state.filters.stationId = $("#filter-station-id").value.trim();
            state.filters.status = $("#filter-status")?.value || "";
            if (!state.filters.trainId && !state.filters.stationId && !state.filters.status && userHasRole("TICKET_AGENT")) {
                notify("Enter a train or station ID to filter maintenance issues.", true);
                return;
            }
            await navigate("maintenance", { preserveFilters: true });
        } else if (action === "clear-maintenance") {
            state.filters = {};
            await navigate("maintenance");
        }
    }

    async function handleSubmit(event) {
        const form = event.target;
        if (!(form instanceof HTMLFormElement)) return;
        event.preventDefault();
        if (form.id === "login-form") {
            const errorNode = $("#login-error");
            const submit = $("button[type=submit]", form);
            errorNode.textContent = "";
            submit.disabled = true;
            submit.textContent = "Checking your account…";
            try {
                await signIn($("#login-contact").value.trim(), $("#login-password").value);
            } catch (error) {
                errorNode.textContent = error.status === 401 ? "That username or password doesn’t match. Please try again." : error.message;
            } finally {
                submit.disabled = false;
                submit.innerHTML = 'Sign in <span aria-hidden="true">→</span>';
            }
        } else if (form.id === "record-form") {
            await submitRecord(form);
        } else if (form.id === "api-form") {
            await submitApiForm(form);
        } else if (form.id === "lookup-form") {
            await submitLookup(form);
        } else if (form.id === "fare-lookup-form") {
            await fareLookup(form);
        } else if (form.id === "register-form") {
            const errorNode = $("#register-error");
            const body = Object.fromEntries(new FormData(form).entries());
            try {
                const result = await request("/api/auth/passenger/register", { method: "POST", body });
                dialog.close();
                showJsonResult("Passenger account created", result.body, result.status);
                notify("Account created. Sign in with your new username and password.");
                $("#login-contact").value = body.contact;
            } catch (error) {
                errorNode.textContent = error.message;
            }
        } else if (form.id === "hire-form") {
            const errorNode = $("#hire-error");
            const body = Object.fromEntries(new FormData(form).entries());
            try {
                const result = await request("/api/auth/employee/hire", { method: "POST", body });
                dialog.close();
                showJsonResult("Employee hired", result.body, result.status);
                notify("Employee account created successfully.");
            } catch (error) {
                errorNode.textContent = error.message;
            }
        } else if (form.id === "maintenance-status-form") {
            state.filters = { status: $("#maintenance-status").value };
            dialog.close();
            await navigate("maintenance", { preserveFilters: true });
        } else if (form.id === "maintenance-filter-form") {
            const trainId = $("#maintenance-train").value.trim();
            const stationId = $("#maintenance-station").value.trim();
            if (!trainId && !stationId) {
                $("#maintenance-filter-error").textContent = "Enter a train ID or station ID.";
                return;
            }
            state.filters = { trainId, stationId };
            dialog.close();
            await navigate("maintenance", { preserveFilters: true });
        }
    }

    $("#login-form").addEventListener("submit", handleSubmit);
    $("#main-navigation").addEventListener("click", handleClick);
    $("#page-content").addEventListener("click", handleClick);
    $("#page-content").addEventListener("submit", handleSubmit);
    dialog.addEventListener("click", event => {
        if (event.target === dialog) dialog.close();
        const button = event.target.closest("[data-action]");
        if (button) handleClick(event);
    });
    apiResultDialog.addEventListener("click", event => {
        if (event.target === apiResultDialog || event.target.closest("[data-action=close-result]")) apiResultDialog.close();
    });
    $("#logout-button").addEventListener("click", signOut);
    $("#topbar-profile").addEventListener("click", signOut);
    $("#refresh-button").addEventListener("click", () => navigate(state.page));
    $("#mobile-menu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
    $("#login-screen").addEventListener("click", event => {
        if (event.target.closest("[data-action=register]")) openRegisterDialog();
        if (event.target.closest("[data-demo]")) handleClick(event);
    });

    dialog.addEventListener("submit", handleSubmit);
})();
