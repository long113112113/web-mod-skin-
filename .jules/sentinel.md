## 2024-05-22 - Path Traversal Prevention
**Vulnerability:** File serving route used a manual blacklist (`includes('..')`) to prevent path traversal. A naive `startsWith` check on resolved paths can also allow sibling directory attacks (e.g. `/uploads/docs-secret` vs `/uploads/docs`).
**Learning:** Blacklists are insufficient. Simple prefix checks on resolved paths are also vulnerable to sibling attacks.
**Prevention:** Use `path.resolve()` to normalize the path. Verify it starts with the expected base directory PLUS the platform-specific separator (`path.sep`), or check if the directory part exactly matches the base.
