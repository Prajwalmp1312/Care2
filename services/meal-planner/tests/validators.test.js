const { registerSchema, loginSchema } = require("../src/validators/auth.validator");

describe("auth validators", () => {
  test("rejects weak passwords", () => {
    const r = registerSchema.safeParse({
      name: "Vamshika", age: 28, email: "v@example.com", password: "weak",
      sex: "Female", weight: 60, purpose: "weight loss",
    });
    expect(r.success).toBe(false);
  });

  test("accepts a strong, well-formed registration", () => {
    const r = registerSchema.safeParse({
      name: "Vamshika", age: 28, email: "v@example.com", password: "Str0ng!pass",
      sex: "Female", weight: 60, weight_unit: "kg", purpose: "weight loss",
    });
    expect(r.success).toBe(true);
  });

  test("login requires a valid email", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });
});
