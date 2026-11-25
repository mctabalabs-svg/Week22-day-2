const pool = require('../db/pool');

function parse(text) {
  const normalized = String(text || '').trim().toUpperCase();
  if (!normalized) return { cmd: '', args: [] };
  const [cmd, ...args] = normalized.split(/\s+/);
  return { cmd, args };
}

function helpText() {
  return [
    'Chama commands:',
    'JOIN <code> - join a chama with an invite code',
    'BALANCE - view your current cycle balance',
    'CONTRIBUTE - get contribution payment information',
    'HELP - show this help',
  ].join('\n');
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

function formatKes(cents) {
  return new Intl.NumberFormat('en-KE', { maximumFractionDigits: 2 })
    .format(Number(cents || 0) / 100);
}

function formatDate(value) {
  if (typeof value === 'string') return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

async function handleJoin(phone, code, name, database = pool) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return 'I could not identify your phone number.';
  if (!code) return 'Send JOIN followed by your invite code.';

  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const inviteResult = await client.query(
      `SELECT code, chama_id, used_at
       FROM invites
       WHERE code = $1
       FOR UPDATE`,
      [code]
    );
    const invite = inviteResult.rows[0];
    if (!invite) {
      await client.query('ROLLBACK');
      return 'That invite code is invalid or has already been used.';
    }

    const chamaResult = await client.query(
      'SELECT id, name FROM chamas WHERE id = $1 FOR UPDATE',
      [invite.chama_id]
    );
    const chama = chamaResult.rows[0];
    if (!chama) {
      await client.query('ROLLBACK');
      return 'That invite code is invalid or has already been used.';
    }

    const memberResult = await client.query(
      'SELECT id FROM members WHERE chama_id = $1 AND phone = $2',
      [invite.chama_id, normalizedPhone]
    );
    if (memberResult.rowCount > 0) {
      await client.query('ROLLBACK');
      return 'You are already in this chama.';
    }
    if (invite.used_at) {
      await client.query('ROLLBACK');
      return 'That invite code is invalid or has already been used.';
    }

    const positionResult = await client.query(
      'SELECT COALESCE(MAX(position), 0) + 1 AS position FROM members WHERE chama_id = $1',
      [invite.chama_id]
    );
    const memberInsert = await client.query(
      `INSERT INTO members (chama_id, name, phone, position)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (chama_id, phone) DO NOTHING
       RETURNING id`,
      [
        invite.chama_id,
        name || normalizedPhone,
        normalizedPhone,
        positionResult.rows[0].position,
      ]
    );
    if (memberInsert.rowCount === 0) {
      await client.query('ROLLBACK');
      return 'You are already in this chama.';
    }

    await client.query('UPDATE invites SET used_at = NOW() WHERE code = $1', [code]);
    await client.query('COMMIT');
    return `Welcome to ${chama.name}!`;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function handleBalance(phone, database = pool) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return 'I could not identify your phone number.';

  const result = await database.query(
    `SELECT ch.name AS chama_name,
            cy.number AS cycle_number,
            cy.ends_at,
            ch.contribution_amount_cents,
            COALESCE(c.contributed_cents, 0) AS contributed_cents,
            COALESCE(f.fine_cents, 0) AS fine_cents
     FROM members m
     JOIN chamas ch ON ch.id = m.chama_id
     JOIN cycles cy ON cy.chama_id = ch.id AND cy.status = 'open'
     LEFT JOIN LATERAL (
       SELECT SUM(amount_cents) FILTER (WHERE status = 'paid') AS contributed_cents
       FROM contributions
       WHERE cycle_id = cy.id AND member_id = m.id
     ) c ON true
     LEFT JOIN LATERAL (
       SELECT SUM(amount_cents) AS fine_cents
       FROM fines
       WHERE cycle_id = cy.id AND member_id = m.id
     ) f ON true
     WHERE m.phone = $1
     ORDER BY cy.starts_at DESC
     LIMIT 1`,
    [normalizedPhone]
  );
  const balance = result.rows[0];
  if (!balance) {
    const memberResult = await database.query(
      'SELECT 1 FROM members WHERE phone = $1 LIMIT 1',
      [normalizedPhone]
    );
    return memberResult.rowCount
      ? 'There is no open cycle for your chama right now.'
      : 'You are not in a chama yet. Send JOIN <code> to join.';
  }

  return [
    balance.chama_name,
    `Cycle ${balance.cycle_number} (ends ${formatDate(balance.ends_at)})`,
    `Contributed: KES ${formatKes(balance.contributed_cents)} / ${formatKes(balance.contribution_amount_cents)}`,
    `Fines: KES ${formatKes(balance.fine_cents)}`,
  ].join('\n');
}

async function handleContribute() {
  return 'Contribution payments are not available through WhatsApp yet.';
}

async function handle(phone, text, name) {
  const { cmd, args } = parse(text);
  switch (cmd) {
    case 'JOIN':
      return handleJoin(phone, args[0], name);
    case 'BALANCE':
      return handleBalance(phone);
    case 'CONTRIBUTE':
      return handleContribute(phone);
    case 'HELP':
      return helpText();
    default:
      return 'Unknown command. Send HELP.';
  }
}

module.exports = { parse, handle, helpText, handleJoin, handleBalance };
