// 1. 查詢資料庫中廣告的 imageUrl
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_iaCY6zvUfI1g@ep-frosty-scene-aj4ai2gu-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function main() {
  await client.connect();
  const res = await client.query('SELECT id, title, "imageUrl", "createdAt" FROM "Advertisement" ORDER BY "createdAt" DESC LIMIT 5');
  console.log('=== DB 中的廣告資料 ===');
  for (const row of res.rows) {
    console.log(`  Title: ${row.title}`);
    console.log(`  imageUrl: ${row.imageUrl}`);
    console.log(`  createdAt: ${row.createdAt}`);
    console.log('  ---');
  }

  // 2. 測試每個 imageUrl 是否可以被存取
  for (const row of res.rows) {
    if (row.imageUrl) {
      // 如果是雲端 URL
      if (row.imageUrl.startsWith('http')) {
        try {
          const resp = await fetch(row.imageUrl, { method: 'HEAD' });
          console.log(`  [雲端] ${row.imageUrl} => HTTP ${resp.status}`);
        } catch (e) {
          console.log(`  [雲端] ${row.imageUrl} => ERROR: ${e.message}`);
        }
      }
      // 如果是本地路徑
      else {
        const fs = require('fs');
        const path = require('path');
        const localPath = path.resolve(process.cwd(), row.imageUrl.replace(/^\//, ''));
        const exists = fs.existsSync(localPath);
        console.log(`  [本地] ${row.imageUrl} => 檔案${exists ? '存在' : '不存在'} (${localPath})`);
      }
    }
  }

  // 3. 測試 S3 上傳是否真的能成功
  console.log('\n=== 測試 S3 上傳 ===');
  require('dotenv').config();
  console.log(`  S3_ENDPOINT: ${process.env.S3_ENDPOINT ? '已設定' : '未設定'}`);
  console.log(`  S3_ACCESS_KEY_ID: ${process.env.S3_ACCESS_KEY_ID ? '已設定' : '未設定'}`);
  console.log(`  S3_SECRET_ACCESS_KEY: ${process.env.S3_SECRET_ACCESS_KEY ? '已設定' : '未設定'}`);
  console.log(`  S3_BUCKET_NAME: ${process.env.S3_BUCKET_NAME || '未設定'}`);
  console.log(`  S3_PUBLIC_DOMAIN: ${process.env.S3_PUBLIC_DOMAIN || '未設定'}`);

  try {
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = new S3Client({
      region: 'auto',
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    });
    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: 'media/test-debug.txt',
      Body: 'hello from debug',
      ContentType: 'text/plain',
    }));
    const testUrl = `${process.env.S3_PUBLIC_DOMAIN}/media/test-debug.txt`;
    console.log(`  S3 上傳成功！測試 URL: ${testUrl}`);
    
    // 4. 測試該 URL 是否能公開讀取
    const resp = await fetch(testUrl);
    console.log(`  公開讀取測試: HTTP ${resp.status} (${resp.status === 200 ? '可讀取' : '無法讀取！'})`);
    const body = await resp.text();
    console.log(`  內容: ${body}`);
  } catch (e) {
    console.error(`  S3 上傳失敗: ${e.message}`);
  }

  await client.end();
}

main().catch(console.error);
