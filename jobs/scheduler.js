const cron = require("node-cron");

cron.schedule("* * * * *", () => {
  console.log("Cron job is running:", new Date());
});