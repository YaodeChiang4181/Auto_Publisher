import { VieshowAdapter } from '../services/crawlers/vieshow';
import { SyncEngine } from '../services/crawlers/engine';
import { prisma } from '../prisma';

async function run() {
  console.log('--- Starting Crawler Sync POC ---');
  
  const vieshow = new VieshowAdapter();
  const engine = new SyncEngine(vieshow);

  try {
    // 1. 同步場館
    await engine.syncVenues();
    
    // 2. 同步場次
    await engine.syncEvents();

    console.log('--- Crawler Sync Finished Successfully ---');
  } catch (err) {
    console.error('Crawler failed:', err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

run();
