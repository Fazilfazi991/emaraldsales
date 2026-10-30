import type { IncomingMessage, ServerResponse } from "node:http";
import { unavailable } from "./src/unavailable.js";
import {requestTiming,phase} from "./src/performance.js";

let loading: Promise<(req: IncomingMessage, res: ServerResponse) => Promise<void>> | undefined;
/** Keep the platform entrypoint free of eager application, database and font imports. */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  return requestTiming(req,res,async()=>{
  let stage: "module_loading" | "request_handling" = "module_loading";
  try {
    loading ??= phase("module",async()=>process.env.CRM_PILOT_STAGE === "approved-real-data-pilot"
      ? import("./src/pilot-hosted.js").then(module => module.pilotHostedHandler)
      : import("./src/hosted.js").then(module => module.hostedHandler));
    const hostedHandler = await loading;
    stage = "request_handling";
    await hostedHandler(req, res);
  } catch {
    // ESM load failures require a corrected artifact; never expose internal paths or secrets.
    if (stage === "module_loading") loading = undefined;
    if (res.headersSent) { if (!res.writableEnded) res.destroy(); return; }
    unavailable(req, res, stage);
  }
  });
}
