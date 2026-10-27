import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { api } from "./support/api.js";

test("dashboard API explorer contains every documented API operation", async () => {
    const source = await readFile(new URL("../../main/resources/static/assets/app.js", import.meta.url), "utf8");
    const catalogStart = source.indexOf("const apiEndpoints = [");
    const catalogEnd = source.indexOf("\n    ];", catalogStart);
    assert.ok(catalogStart >= 0 && catalogEnd > catalogStart, "dashboard API operation catalog should exist");
    const catalogSource = source.slice(catalogStart, catalogEnd);
    const catalog = new Set();
    const operationPattern = /\["(GET|POST|PUT|PATCH|DELETE)",\s*"([^"]+)"/g;
    for (const match of catalogSource.matchAll(operationPattern)) {
        const path = match[2].split("?")[0].replace(/:([A-Za-z][A-Za-z0-9]*)/g, "{$1}");
        catalog.add(`${match[1]} ${path}`);
    }

    const { response, body } = await api("/v3/api-docs", { username: null, password: null });
    assert.equal(response.status, 200);
    const documented = new Set();
    for (const [path, operations] of Object.entries(body.paths)) {
        for (const [method, details] of Object.entries(operations)) {
            if (details.operationId) documented.add(`${method.toUpperCase()} ${path}`);
        }
    }

    const missing = [...documented].filter(operation => !catalog.has(operation));
    assert.deepEqual(missing, [], `API explorer is missing: ${missing.join(", ")}`);
    const undocumented = [...catalog].filter(operation => !documented.has(operation));
    assert.deepEqual(undocumented, [], `API explorer includes unknown operations: ${undocumented.join(", ")}`);
});
