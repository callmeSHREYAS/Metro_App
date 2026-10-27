export const baseUrl = (process.env.BASE_URL || "http://localhost:8081").replace(/\/+$/, "");
export const adminContact = process.env.ADMIN_CONTACT || "admin";
export const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

export async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.username !== null && options.password !== null) {
        const username = options.username ?? adminContact;
        const password = options.password ?? adminPassword;
        headers.set("Authorization", `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`);
    }
    if (options.body !== undefined) headers.set("Content-Type", "application/json");

    const response = await fetch(new URL(path, `${baseUrl}/`), {
        method: options.method || "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    const text = await response.text();
    let body = null;
    if (text) {
        try {
            body = JSON.parse(text);
        } catch {
            body = text;
        }
    }
    return { response, body };
}

export async function assertAdminAuthFailure(assert) {
    const { response } = await api("/api/auth/me", { username: "admin", password: "invalid-test-password" });
    assert.equal(response.status, 401, "incorrect credentials must be rejected");
}
