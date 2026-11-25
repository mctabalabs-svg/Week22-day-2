CREATE TABLE IF NOT EXISTS daily_metrics (
  id   SERIAL PRIMARY KEY,
  name TEXT    NOT NULL,
  value NUMERIC NOT NULL,
  at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT cron.schedule(
  'daily-order-count',
  '0 8 * * *',
  $$ INSERT INTO daily_metrics(name, value, at)
     SELECT 'orders_last_24h', COUNT(*), NOW()
     FROM orders WHERE created_at > NOW() - INTERVAL '1 day' $$
);
