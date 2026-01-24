## 2024-05-22 - Missing Authentication on File Upload Endpoint
**Vulnerability:** The `app/api/admin/software/[id]/file/route.ts` endpoint allowed unauthenticated POST requests to upload arbitrary files (validated by extension) to the server.
**Learning:** Checking for `admin` or role-based path segments in the URL is not enough; explicit authentication checks must be performed inside the route handler or via middleware that strictly covers the route.
**Prevention:** Always verify `getServerSession` and check permissions at the start of every API route handler that performs sensitive actions or modifies data.
