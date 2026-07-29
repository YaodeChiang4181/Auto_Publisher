const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_iaCY6zvUfI1g@ep-frosty-scene-aj4ai2gu-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require' });
client.connect()
  .then(() => client.query('SELECT id, title, "imageUrl" FROM "Advertisement" ORDER BY "createdAt" DESC LIMIT 5'))
  .then(res => { console.log(res.rows); client.end(); })
  .catch(e => console.error(e));
