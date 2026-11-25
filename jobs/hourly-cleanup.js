const cron = require("node-cron");
const { logJob } = require("../lib/logger");

cron.schedule("0 * * * *", async () => {
  logJob("hourly-cleanup", "start");
  try {
    console.log("[hourly-cleanup] running at", new Date().toISOString());
    logJob("hourly-cleanup", "success");
  } catch (err) {
    logJob("hourly-cleanup", "error", { error: err.message });
    console.error("[hourly-cleanup] failed", err);
  }
}, { timezone: "Africa/Nairobi" });

console.log("Hourly cleanup scheduled");
