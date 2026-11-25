# ADR 0001: Scheduler choice for Mctaba backend

## Status
Accepted

## Context
We need scheduled work for daily reports, cleanup, and reminders.

## Decision
Use node-cron for in-process jobs that are quick and safe to re-run.
Use pg_cron for SQL-only jobs that should run regardless of app state.
Defer queue-based scheduling (BullMQ) to Week 22.

## Consequences
- Positive: node-cron keeps development simple and visible in code; no extra infrastructure.
- Positive: pg_cron guarantees daily reports run even if the Node server is down or redeploying.
- Negative: two different schedulers mean two mental models and two places to look for job health.
- Negative: pg_cron is limited to SQL; any job that needs HTTP calls or file I/O still needs node-cron or a worker.
- Negative: BullMQ is postponed, so we lose retries and back-off for heavy jobs until next week.
