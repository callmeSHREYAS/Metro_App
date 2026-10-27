import assert from "node:assert/strict";
import test from "node:test";
import { api, assertAdminAuthFailure } from "./support/api.js";

test("dashboard is public, account sign-in works, and invalid credentials are rejected", async () => {
    const page = await api("/");
    assert.equal(page.response.status, 200);
    assert.match(page.body, /MetroFlow/);
    assert.match(page.body, /\/assets\/app\.js/);

    const script = await api("/assets/app.js");
    assert.equal(script.response.status, 200);
    assert.match(script.body, /\/api\/auth\/me/);

    const anonymous = await api("/api/auth/me", { username: null, password: null });
    assert.equal(anonymous.response.status, 401, "protected endpoints require sign-in");

    await assertAdminAuthFailure(assert);

    const authenticated = await api("/api/auth/me");
    assert.equal(authenticated.response.status, 200);
    assert.equal(authenticated.body.contact, process.env.ADMIN_CONTACT || "admin");
    assert.equal(authenticated.body.role, "ADMIN");
});
