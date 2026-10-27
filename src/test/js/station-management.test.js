import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { api, assertAdminAuthFailure } from "./support/api.js";

test("admin can create, read, update, and delete a station with persisted values", async () => {
    await assertAdminAuthFailure(assert);

    const stationCode = `E2E${randomUUID().replaceAll("-", "").slice(0, 7).toUpperCase()}`;
    let stationId;
    try {
        const created = await api("/api/stations", {
            method: "POST",
            body: { stationCode, lineColor: "Violet", address: "Automated test station", isActive: true }
        });
        assert.equal(created.response.status, 201);
        stationId = created.body.stationId;
        assert.ok(stationId);

        const detail = await api(`/api/stations/${encodeURIComponent(stationId)}`);
        assert.equal(detail.response.status, 200);
        assert.equal(detail.body.stationCode, stationCode);

        const updated = await api(`/api/stations/${encodeURIComponent(stationId)}`, {
            method: "PUT",
            body: { stationCode, lineColor: "Green", address: "Updated test address", isActive: true }
        });
        assert.equal(updated.response.status, 200);
        assert.equal(updated.body.lineColor, "Green");

        const listed = await api("/api/stations");
        assert.ok(listed.body.some(station => station.stationId === stationId && station.address === "Updated test address"));
    } finally {
        if (stationId) {
            const removed = await api(`/api/stations/${encodeURIComponent(stationId)}`, { method: "DELETE" });
            assert.equal(removed.response.status, 204);
        }
    }
});
