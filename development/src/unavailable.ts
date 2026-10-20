import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

export function unavailable(req: IncomingMessage, res: ServerResponse, stage: string) {
  const requestId = randomUUID();
  console.error(JSON.stringify({ event: "hosted_startup_unavailable", stage, requestId }));
  const html = req.headers.accept?.includes("text/html");
  res.writeHead(503, { "Content-Type": html ? "text/html; charset=utf-8" : "application/json; charset=utf-8",
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Retry-After": "30", "X-Request-Id": requestId,
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" });
  const body = html ? `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Emerald CRM unavailable</title><style>body{font:18px system-ui;background:#f4f7f5;color:#164d3c;margin:0;padding:24px}main{max-width:560px;margin:12vh auto;background:white;padding:32px;border-radius:16px}h1{font-size:27px}p{line-height:1.6}a{display:inline-block;padding:14px 24px;background:#164d3c;color:white;border-radius:8px;text-decoration:none}</style><main><strong>EMERALD INTERLINK</strong><h1>The CRM is temporarily unavailable</h1><p>Hosted setup is not complete or the service could not start. Please contact your administrator.</p><a href="/">Try again</a><p>Reference: ${requestId}</p></main></html>`
    : JSON.stringify({ error: { code: "STAGING_UNAVAILABLE", message: "The CRM is not ready for hosted use. Please contact your administrator." }, requestId });
  res.end(req.method === "HEAD" ? undefined : body);
}
