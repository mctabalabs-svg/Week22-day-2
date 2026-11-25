const { Pool } = require('pg');
const pool = new Pool({user:'postgres',password:'rodah',host:'localhost',port:5432,database:'crm'});
pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
  .then(r => {
    r.rows.forEach(x => console.log(x.table_name));
    pool.end();
  })
  .catch(e => { console.error(e); process.exit(1); });
