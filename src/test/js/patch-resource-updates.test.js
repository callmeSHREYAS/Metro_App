import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { api, assertAdminAuthFailure } from "./support/api.js";

test("resource PATCH endpoints update supplied fields and preserve omitted fields", async () => {
    await assertAdminAuthFailure(assert);

    const suffix = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
    const ids = {};
    const stationCode = `PT${suffix}`;
    const secondStationCode = `P${suffix}`;
    const contact = `patch-${suffix.toLowerCase()}@example.com`;

    try {
        const firstStation = await api("/api/stations", {
            method: "POST",
            body: { stationCode, lineColor: "Blue", address: "Before patch" }
        });
        assert.equal(firstStation.response.status, 201);
        ids.firstStation = firstStation.body.stationId;

        const secondStation = await api("/api/stations", {
            method: "POST",
            body: { stationCode: secondStationCode, lineColor: "Blue" }
        });
        assert.equal(secondStation.response.status, 201);
        ids.secondStation = secondStation.body.stationId;

        const stationPatch = await api(`/api/stations/${ids.firstStation}`, {
            method: "PATCH",
            body: { address: "After patch" }
        });
        assert.equal(stationPatch.response.status, 200);
        assert.equal(stationPatch.body.address, "After patch");
        assert.equal(stationPatch.body.stationCode, stationCode);

        const train = await api("/api/trains", {
            method: "POST",
            body: { trainNumber: `PT-${suffix}`, capacity: 100, totalCoaches: 4, manufactureYear: 2025 }
        });
        assert.equal(train.response.status, 201);
        ids.train = train.body.trainId;

        const trainPatch = await api(`/api/trains/${ids.train}`, {
            method: "PATCH",
            body: { capacity: 120 }
        });
        assert.equal(trainPatch.response.status, 200);
        assert.equal(trainPatch.body.capacity, 120);
        assert.equal(trainPatch.body.trainNumber, `PT-${suffix}`);

        const route = await api("/api/routes", {
            method: "POST",
            body: {
                routeName: `Patch route ${suffix}`,
                startStationId: ids.firstStation,
                endStationId: ids.secondStation,
                stationIds: [ids.firstStation, ids.secondStation],
                lineColor: "Blue"
            }
        });
        assert.equal(route.response.status, 201);
        ids.route = route.body.routeId;

        const routePatch = await api(`/api/routes/${ids.route}`, {
            method: "PATCH",
            body: { lineColor: "Green" }
        });
        assert.equal(routePatch.response.status, 200);
        assert.equal(routePatch.body.lineColor, "Green");
        assert.equal(routePatch.body.routeName, `Patch route ${suffix}`);
        assert.deepEqual(routePatch.body.stationIds, [ids.firstStation, ids.secondStation]);

        const schedule = await api("/api/schedules", {
            method: "POST",
            body: {
                trainId: ids.train,
                routeId: ids.route,
                dayOfWeek: "DAILY",
                scheduledDeparture: "2040-10-27T06:00:00",
                scheduledArrival: "2040-10-27T06:45:00"
            }
        });
        assert.equal(schedule.response.status, 201);
        ids.schedule = schedule.body.scheduleId;

        const schedulePatch = await api(`/api/schedules/${ids.schedule}`, {
            method: "PATCH",
            body: { dayOfWeek: "TUESDAY" }
        });
        assert.equal(schedulePatch.response.status, 200);
        assert.equal(schedulePatch.body.dayOfWeek, "TUESDAY");
        assert.equal(schedulePatch.body.scheduledDeparture, "2040-10-27T06:00:00");

        const fare = await api("/api/fares", {
            method: "POST",
            body: { sourceStationId: ids.firstStation, destStationId: ids.secondStation, baseFare: 30 }
        });
        assert.equal(fare.response.status, 201);
        ids.fare = fare.body.fareId;

        const farePatch = await api(`/api/fares/${ids.fare}`, {
            method: "PATCH",
            body: { baseFare: 35 }
        });
        assert.equal(farePatch.response.status, 200);
        assert.equal(Number(farePatch.body.baseFare), 35);

        const user = await api("/api/users", {
            method: "POST",
            body: {
                firstName: "Patch",
                lastName: "Test",
                contact,
                password: "ChangeMe123!",
                role: "PASSENGER"
            }
        });
        assert.equal(user.response.status, 201);
        ids.user = user.body.userId;

        const userPatch = await api(`/api/users/${ids.user}`, {
            method: "PATCH",
            body: { isActive: false }
        });
        assert.equal(userPatch.response.status, 200);
        assert.equal(userPatch.body.isActive, false);
        assert.equal(userPatch.body.firstName, "Patch");

        const issue = await api("/api/maintenance", {
            method: "POST",
            body: {
                issueType: `Patch issue ${suffix}`,
                description: "Partial update integration test",
                priority: "MEDIUM",
                stationId: ids.firstStation
            }
        });
        assert.equal(issue.response.status, 201);
        ids.issue = issue.body.issueId;

        const issuePatch = await api(`/api/maintenance/${ids.issue}`, {
            method: "PATCH",
            body: { priority: "HIGH" }
        });
        assert.equal(issuePatch.response.status, 200);
        assert.equal(issuePatch.body.priority, "HIGH");
        assert.equal(issuePatch.body.description, "Partial update integration test");
    } finally {
        for (const [resource, id] of [
            ["schedules", ids.schedule],
            ["fares", ids.fare],
            ["maintenance", ids.issue],
            ["routes", ids.route],
            ["trains", ids.train],
            ["users", ids.user],
            ["stations", ids.firstStation],
            ["stations", ids.secondStation]
        ]) {
            if (id) {
                const removed = await api(`/api/${resource}/${encodeURIComponent(id)}`, { method: "DELETE" });
                assert.equal(removed.response.status, 204, `failed to remove test ${resource} ${id}`);
            }
        }
    }
});
