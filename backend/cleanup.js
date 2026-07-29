const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_iaCY6zvUfI1g@ep-frosty-scene-aj4ai2gu-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function main() {
  await client.connect();
  
  // 刪除所有 imageUrl 不是以 https:// 開頭的壞資料
  const res = await client.query(`DELETE FROM "Advertisement" WHERE "imageUrl" IS NOT NULL AND "imageUrl" NOT LIKE 'https://%' RETURNING id, title, "imageUrl"`);
  console.log(`刪除了 ${res.rowCount} 筆壞資料:`);
  for (const row of res.rows) {
    console.log(`  - ${row.title} (${row.imageUrl})`);
  }
  
  // 顯示剩餘資料
  const remaining = await client.query('SELECT id, title, "imageUrl" FROM "Advertisement" ORDER BY "createdAt" DESC');
  console.log(`\n剩餘 ${remaining.rowCount} 筆廣告`);
  
  await client.end();
}

main().catch(console.error);
