## 2024-05-22 - [DoS in File Downloads]
**Vulnerability:** Large file downloads were using `fs.readFile` which loads the entire file into memory, causing potential OOM crashes.
**Learning:** `NextResponse` in Next.js App Router supports web streams. Node.js streams must be converted using `Readable.toWeb`.
**Prevention:** Always stream file responses using `createReadStream` and `Readable.toWeb` for any file serving endpoint.
