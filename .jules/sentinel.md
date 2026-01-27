## 2024-05-23 - [CRITICAL] Path Traversal via Sibling Directory Attack
**Vulnerability:** File serving routes used `startsWith(resolve(baseDir))` to validate file paths, which allows access to sibling directories (e.g., `/uploads/images/products` vs `/uploads/images/products_secret`).
**Learning:** `startsWith` is insufficient for path validation without including the directory separator.
**Prevention:** Always append `path.sep` to the resolved base path when using `startsWith` for validation: `!filePath.startsWith(resolve(baseDir) + path.sep)`.
