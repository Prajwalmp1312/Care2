const request = require("supertest");

// Smoke test: the app boots and unknown routes 404 cleanly.
// (DB-backed routes require a live MySQL; covered by integration tests.)
jest.mock("../src/lib/db", () => ({
  db: new Proxy({}, { get: () => async () => [[], []] }),
  db360: {},
  initializeDB: jest.fn(),
  initialize360DB: jest.fn(),
}));

const app = require("../src/app");

describe("app", () => {
  test("unknown route returns 404 json", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });
});
