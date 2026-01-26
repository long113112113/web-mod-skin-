## 2024-05-22 - Path Traversal Prevention
**Vulnerability:** File serving route used a manual blacklist (`includes('..')`) to prevent path traversal. A naive `startsWith` check on resolved paths can also allow sibling directory attacks (e.g. `/uploads/docs-secret` vs `/uploads/docs`).
**Learning:** Blacklists are insufficient. Simple prefix checks on resolved paths are also vulnerable to sibling attacks.
**Prevention:** Use `path.resolve()` to normalize the path. Verify it starts with the expected base directory PLUS the platform-specific separator (`path.sep`), or check if the directory part exactly matches the base.

## 2024-05-23 - Safe Dynamic SQL in Prisma
**Vulnerability:** String interpolation inside `prisma.$queryRaw` tagged template literals (e.g. `${condition}`) results in the string being treated as a bound parameter value, causing syntax errors or incorrect query logic.
**Learning:** Tagged template literals distinguish between static strings and interpolated values. Passing a partial SQL string as a value causes it to be escaped/parameterized, breaking the query structure.
**Prevention:** Use `Prisma.sql` to construct dynamic SQL fragments (e.g. `Prisma.sql`AND id = ${id}``) or `Prisma.empty` for conditional clauses. Never interpolate raw strings directly into `$queryRaw`.
