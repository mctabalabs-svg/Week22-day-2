const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: 'rodah',
  host: 'localhost',
  port: 5432,
  database: 'crm'
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const chamaResult = await client.query(
      `INSERT INTO chamas (name, contribution_amount_cents, cycle_length_days)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['Mctaba Savings Group', 1000, 30]
    );
    const chamaId = chamaResult.rows[0].id;

    const memberPhones = [
      '+254700000001',
      '+254700000002',
      '+254700000003',
      '+254700000004'
    ];

    const memberNames = [
      'Alice Wanjiku',
      'Bob Ochieng',
      'Carol Njeri',
      'David Kiptoo'
    ];

    const memberIds = [];
    for (let i = 0; i < memberNames.length; i++) {
      const mResult = await client.query(
        `INSERT INTO members (chama_id, name, phone, position)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [chamaId, memberNames[i], memberPhones[i], i + 1]
      );
      memberIds.push(mResult.rows[0].id);
    }

    const cycleResult = await client.query(
      `INSERT INTO cycles (chama_id, number, recipient_id, starts_at, ends_at, status)
       VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days', 'open')
       RETURNING id`,
      [chamaId, 1, memberIds[0]]
    );

    await client.query('COMMIT');
    console.log('Seed completed successfully');
    console.log('Chama ID:', chamaId);
    console.log('Cycle ID:', cycleResult.rows[0].id);
    console.log('Member IDs:', memberIds.join(', '));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
