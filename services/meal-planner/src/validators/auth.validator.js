const { z } = require("zod");

const passwordRules = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[0-9]/, "Must contain a number")
  .regex(/[^A-Za-z0-9]/, "Must contain a special character");

const registerSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  name: z.string().min(1).max(255),
  age: z.coerce.number().int().min(1).max(120),
  email: z.string().email(),
  password: passwordRules,
  sex: z.enum(["Male", "Female"]),
  weight: z.coerce.number().min(20).max(1100),
  weight_unit: z.enum(["kg", "lb"]).default("kg"),
  purpose: z.string().min(1).max(255),
  track_menstrual_cycle: z.coerce.boolean().optional(),
  last_period_date: z.string().optional().nullable(),
  cycle_length: z.coerce.number().int().min(20).max(45).optional(),
}).passthrough();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

module.exports = { registerSchema, loginSchema, passwordRules };
