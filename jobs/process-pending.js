const pool = require("../db/pool");
const { withLock } = require("../lib/pg-lock");
const { logJob } = require("../lib/logger");

async function processOne(id) {
  await pool.query("UPDATE orders SET processed = true WHERE id = $1", [id]);
}

async function processAll() {
  let lastId = 0;
  while (true) {
    const { rows } = await pool.query(
      "SELECT id FROM orders WHERE id > $1 ORDER BY id LIMIT 500",
      [lastId]
    );
    if (rows.length === 0) break;
    for (const row of rows) await processOne(row.id);
    lastId = rows[rows.length - 1].id;
  }
}

const cron = require("node-cron");

cron.schedule("0 2 * * *", async () => {
  await withLock(42002, async () => {
    logJob("process-pending", "start");
    try {
      await processAll();
      logJob("process-pending", "success");
      console.log("[process-pending] Done");
    } catch (err) {
      logJob("process-pending", "error", { error: err.message });
      console.error("[process-pending] failed", err);
    }
  });
}, { timezone: "Africa/Nairobi" });

console.log("Process-pending scheduled for 02:00 EAT");
