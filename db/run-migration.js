const fs = require('fs');
const path = require('path');
require('dotenv').config();
const pool = require('./pool');

async function runMigration() {
  const migrationFile = process.argv[2] || '0003-create-chama-tables.sql';
  if (path.basename(migrationFile) !== migrationFile || !/^\d{4}-[\w-]+\.sql$/.test(migrationFile)) {
    throw new Error('Provide a migration filename, e.g. 0004-create-invites.sql');
  }

  const filePath = path.join(__dirname, 'migrations', migrationFile);
  const sql = fs.readFileSync(filePath, 'utf8');

  try {
    await pool.query(sql);
    console.log(`Migration ${migrationFile} ran successfully`);
  } catch (err) {
    throw new Error(`Migration ${migrationFile} failed: ${err.message}`, { cause: err });
  } finally {
    await pool.end();
  }
}

runMigration().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
