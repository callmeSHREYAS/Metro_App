import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { api, assertAdminAuthFailure } from "./support/api.js";

test("maintenance issue can be reported, filtered, updated, resolved, and removed", async () => {
    await assertAdminAuthFailure(assert);

    const issueType = `E2E-${randomUUID().slice(0, 8)}`;
    let issueId;
    try {
        const reported = await api("/api/maintenance", {
            method: "POST",
            body: {
                issueType,
                description: "Automated maintenance workflow test.",
                priority: "MEDIUM",
                stationId: "STN-VSV"
            }
        });
        assert.equal(reported.response.status, 201);
        issueId = reported.body.issueId;

        const filtered = await api("/api/maintenance/status/Open");
        assert.equal(filtered.response.status, 200);
        assert.ok(filtered.body.some(issue => issue.issueId === issueId));

        const updated = await api(`/api/maintenance/${encodeURIComponent(issueId)}`, {
            method: "PUT",
            body: {
                issueType,
                description: "Automated maintenance workflow test, updated.",
                status: "In Progress",
                priority: "HIGH"
            }
        });
        assert.equal(updated.response.status, 200);
        assert.equal(updated.body.status, "In Progress");

        const resolved = await api(`/api/maintenance/${encodeURIComponent(issueId)}/resolve`, { method: "PATCH" });
        assert.equal(resolved.response.status, 200);
        assert.equal(resolved.body.status, "Closed");

        const readback = await api(`/api/maintenance/${encodeURIComponent(issueId)}`);
        assert.equal(readback.response.status, 200);
        assert.equal(readback.body.priority, "HIGH");
    } finally {
        if (issueId) {
            const removed = await api(`/api/maintenance/${encodeURIComponent(issueId)}`, { method: "DELETE" });
            assert.equal(removed.response.status, 204);
        }
    }
});
