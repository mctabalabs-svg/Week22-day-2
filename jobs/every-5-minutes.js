const cron = require("node-cron");
const { logJob } = require("../lib/logger");

let running = false;

cron.schedule("*/5 * * * *", async () => {
  if (running) {
    logJob("every-5-minutes", "skipped", { reason: "previous still running" });
    console.warn("[every-5-minutes] skipped: previous still running");
    return;
  }
  running = true;
  logJob("every-5-minutes", "start");
  try {
    console.log("[every-5-minutes] running at", new Date().toISOString());
    logJob("every-5-minutes", "success");
  } catch (err) {
    logJob("every-5-minutes", "error", { error: err.message });
    console.error("[every-5-minutes] failed", err);
  } finally {
    running = false;
  }
}, { timezone: "Africa/Nairobi" });

console.log("Every 5 minutes job scheduled");
