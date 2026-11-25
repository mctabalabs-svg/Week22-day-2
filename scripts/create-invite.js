require('dotenv').config();

const { randomInt } = require('crypto');
const pool = require('../db/pool');

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function createCode(length = 6) {
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join('');
}

async function createInvite(chamaId) {
  if (!chamaId) {
    throw new Error('Usage: node scripts/create-invite.js <chama-id>');
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createCode();
    try {
      await pool.query('INSERT INTO invites (code, chama_id) VALUES ($1, $2)', [code, chamaId]);
      return code;
    } catch (error) {
      if (error.code !== '23505') throw error;
    }
  }

  throw new Error('Could not generate a unique invite code after 5 attempts.');
}

createInvite(process.argv[2])
  .then((code) => console.log(`Invite created: ${code}`))
  .catch((error) => {
    console.error('Invite creation failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
