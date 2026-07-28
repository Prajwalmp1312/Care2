const { hashPassword, comparePasswords, signToken, verifyToken } = require("../src/utils/auth");

describe("auth utils", () => {
  test("hashes and verifies a password", async () => {
    const hash = await hashPassword("Sup3r$ecret");
    expect(hash).not.toBe("Sup3r$ecret");
    expect(await comparePasswords("Sup3r$ecret", hash)).toBe(true);
    expect(await comparePasswords("wrong", hash)).toBe(false);
  });

  test("signs and verifies a JWT round-trip", () => {
    const token = signToken({ id: 42, email: "a@b.com" });
    const decoded = verifyToken(token);
    expect(decoded.id).toBe(42);
    expect(decoded.email).toBe("a@b.com");
  });
});
