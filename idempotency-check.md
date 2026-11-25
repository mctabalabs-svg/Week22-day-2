# Idempotency notes

The `UNIQUE (chama_id, phone)` constraint means PostgreSQL will only allow one
member row for a phone number in a given chama. The JOIN handler also checks
for an existing member and inserts with `ON CONFLICT`, so a redelivered JOIN
cannot create a second member row.

Without that constraint, two webhook deliveries arriving at nearly the same
time could both check that the member is absent and then both insert a row.
The same person could appear twice, receive multiple positions, and be treated
as two separate members for contributions and payouts.

Other uniqueness constraints provide similar safeguards:

- `PRIMARY KEY (code)` on invites prevents duplicate invite codes.
- `UNIQUE (chama_id, number)` on cycles prevents a cycle number from being
  created twice for the same chama.
- `UNIQUE (cycle_id, member_id)` on contributions prevents multiple
  contribution rows for one member in one cycle.
