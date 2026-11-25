const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  parse,
  handle,
  helpText,
  handleJoin,
  handleBalance,
} = require('../bot/chama-commands');

function createJoinPool() {
  const state = {
    invite: { code: 'ABC123', chama_id: 'chama-1', used_at: null },
    chama: { id: 'chama-1', name: 'Mctaba Savings Group' },
    members: [],
    commits: 0,
  };

  return {
    state,
    async connect() {
      return {
        async query(sql, params = []) {
          const query = sql.replace(/\s+/g, ' ').trim();
          if (query === 'BEGIN' || query === 'ROLLBACK') return { rowCount: null, rows: [] };
          if (query === 'COMMIT') {
            state.commits += 1;
            return { rowCount: null, rows: [] };
          }
          if (query.startsWith('SELECT code, chama_id, used_at FROM invites')) {
            return { rows: state.invite?.code === params[0] ? [state.invite] : [] };
          }
          if (query.startsWith('SELECT id, name FROM chamas')) {
            return { rows: [state.chama] };
          }
          if (query.startsWith('SELECT id FROM members WHERE chama_id')) {
            const member = state.members.find(
              (row) => row.chama_id === params[0] && row.phone === params[1]
            );
            return { rowCount: member ? 1 : 0, rows: member ? [member] : [] };
          }
          if (query.startsWith('SELECT COALESCE(MAX(position), 0) + 1')) {
            return { rows: [{ position: state.members.length + 1 }] };
          }
          if (query.startsWith('INSERT INTO members')) {
            const [chama_id, name, phone, position] = params;
            if (state.members.some((row) => row.chama_id === chama_id && row.phone === phone)) {
              return { rowCount: 0, rows: [] };
            }
            const member = { id: `member-${state.members.length + 1}`, chama_id, name, phone, position };
            state.members.push(member);
            return { rowCount: 1, rows: [member] };
          }
          if (query.startsWith('UPDATE invites SET used_at')) {
            state.invite.used_at = new Date();
            return { rowCount: 1, rows: [] };
          }
          throw new Error(`Unexpected query: ${query}`);
        },
        release() {},
      };
    },
  };
}

describe('Chama commands', () => {
  it('parses case-insensitive commands and arguments', () => {
    assert.deepEqual(parse('  join abc123  '), { cmd: 'JOIN', args: ['ABC123'] });
    assert.deepEqual(parse('  '), { cmd: '', args: [] });
  });

  it('returns help text and handles unknown commands', async () => {
    assert.equal(await handle('+254700000001', 'HELP'), helpText());
    assert.equal(await handle('+254700000001', 'OTHER'), 'Unknown command. Send HELP.');
  });

  it('does not add the same member twice when JOIN is redelivered', async () => {
    const database = createJoinPool();

    assert.equal(
      await handleJoin('254700000001', 'ABC123', 'Alice', database),
      'Welcome to Mctaba Savings Group!'
    );
    assert.equal(
      await handleJoin('254700000001', 'ABC123', 'Alice', database),
      'You are already in this chama.'
    );
    assert.equal(database.state.members.length, 1);
    assert.equal(database.state.commits, 1);
  });

  it('formats the open-cycle balance as KES', async () => {
    const database = {
      async query() {
        return {
          rows: [{
            chama_name: 'Mctaba Savings Group',
            cycle_number: 1,
            ends_at: '2026-04-21',
            contribution_amount_cents: 200000,
            contributed_cents: 150000,
            fine_cents: 0,
          }],
        };
      },
    };

    assert.equal(
      await handleBalance('254700000001', database),
      'Mctaba Savings Group\nCycle 1 (ends 2026-04-21)\nContributed: KES 1,500 / 2,000\nFines: KES 0'
    );
  });
});
