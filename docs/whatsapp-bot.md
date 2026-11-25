# WhatsApp Chama bot

Configure these environment variables before starting the server:

- `DATABASE_URL` — PostgreSQL connection string.
- `WHATSAPP_VERIFY_TOKEN` — token used to verify the webhook in Meta.
- `WHATSAPP_ACCESS_TOKEN` — WhatsApp Cloud API access token.
- `WHATSAPP_PHONE_NUMBER_ID` — the Cloud API phone number ID.
- `WHATSAPP_API_VERSION` — optional Graph API version; defaults to `v22.0`.

Set the Meta webhook URL to `https://<your-host>/whatsapp/webhook` and
subscribe it to WhatsApp message events. The endpoint handles webhook
verification and replies to incoming text commands.

After the Chama tables exist, apply the invites migration and create an invite:

```sh
node db/run-migration.js 0004-create-invites.sql
node scripts/create-invite.js <chama-id>
```

Send `JOIN <code>` from WhatsApp to join, then `HELP` or `BALANCE` to use the
bot. Contribution payment processing is not implemented yet.
