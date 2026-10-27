import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { api, assertAdminAuthFailure } from "./support/api.js";

test("passenger registration, ticket booking, payment, and validation persist end to end", async () => {
    await assertAdminAuthFailure(assert);

    const contact = `e2e-${randomUUID().slice(0, 12)}`;
    const password = "TestPass123!";
    let passengerId;
    let ticketId;
    let paymentId;

    try {
        const registered = await api("/api/auth/passenger/register", {
            method: "POST",
            username: null,
            password: null,
            body: { firstName: "Test", lastName: "Passenger", contact, password }
        });
        assert.equal(registered.response.status, 200);
        passengerId = registered.body.userId;
        assert.ok(passengerId);

        const fare = await api("/api/fares/lookup?sourceStationId=STN-VSV&destStationId=STN-GHP");
        assert.equal(fare.response.status, 200);

        const booked = await api("/api/tickets", {
            method: "POST",
            body: {
                passengerId,
                sourceStationId: "STN-VSV",
                destStationId: "STN-GHP",
                ticketType: "SINGLE"
            }
        });
        assert.equal(booked.response.status, 201);
        ticketId = booked.body.ticketId;

        const passengerAuth = { username: contact, password };
        const ticketReadback = await api(`/api/tickets/${encodeURIComponent(ticketId)}`, passengerAuth);
        assert.equal(ticketReadback.response.status, 200);
        assert.equal(ticketReadback.body.ticketId, ticketId);

        const payment = await api("/api/payments", {
            ...passengerAuth,
            method: "POST",
            body: { ticketId, amount: fare.body.baseFare }
        });
        assert.equal(payment.response.status, 201);
        paymentId = payment.body.paymentId;

        const paymentReadback = await api(`/api/payments/ticket/${encodeURIComponent(ticketId)}`, passengerAuth);
        assert.equal(paymentReadback.response.status, 200);
        assert.ok(paymentReadback.body.some(item => item.paymentId === paymentId));

        const used = await api(`/api/tickets/${encodeURIComponent(ticketId)}/use`, {
            ...passengerAuth,
            method: "PATCH"
        });
        assert.equal(used.response.status, 200);
        assert.equal(used.body.isUsed, true);
    } finally {
        if (paymentId) {
            const removedPayment = await api(`/api/payments/${encodeURIComponent(paymentId)}`, { method: "DELETE" });
            assert.equal(removedPayment.response.status, 204);
        }
        if (ticketId) {
            const removedTicket = await api(`/api/tickets/${encodeURIComponent(ticketId)}`, { method: "DELETE" });
            assert.equal(removedTicket.response.status, 204);
        }
        if (passengerId) {
            const removedPassenger = await api(`/api/users/${encodeURIComponent(passengerId)}`, { method: "DELETE" });
            assert.equal(removedPassenger.response.status, 204);
        }
    }
});
