// Validate req.body/params/query against a zod schema; 400 on failure.
function validate(schema, source = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    req[source] = result.data;
    return next();
  };
}

module.exports = { validate };
