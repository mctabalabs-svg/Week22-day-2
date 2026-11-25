const cron = require("node-cron");
const pool = require("../db/pool");
const { retry } = require("../lib/retry");
const { logJob } = require("../lib/logger");
const { withLock } = require("../lib/pg-lock");

cron.schedule("0 8 * * *", async () => {
  await withLock(42001, async () => {
    logJob("daily-report", "start");
    try {
      const { rows } = await retry(() =>
        pool.query(
          "SELECT COUNT(*) as n FROM orders WHERE created_at > NOW() - INTERVAL '1 day'"
        )
      );
      console.log(`[daily-report] Orders in last 24h: ${rows[0].n}`);
      logJob("daily-report", "success", { orders: rows[0].n });
    } catch (err) {
      logJob("daily-report", "error", { error: err.message });
      console.error("[daily-report] failed", err);
    }
  });
}, { timezone: "Africa/Nairobi" });

console.log("Daily report scheduled for 08:00 EAT");
