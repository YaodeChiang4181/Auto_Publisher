import cron from 'node-cron';
import { SyncEngine } from './services/crawlers/engine';
import { VieshowAdapter } from './services/crawlers/vieshow';
import { prisma } from './prisma';

export function startScheduler() {
  console.log('--- Initializing Cloud Scheduler ---');

  const engine = new SyncEngine(new VieshowAdapter());

  // 每 20 分鐘執行一次爬蟲同步
  cron.schedule('*/20 * * * *', async () => {
    console.log(`[Scheduler] Triggering crawler sync at ${new Date().toISOString()}`);
    try {
      await engine.syncVenues();
      await engine.syncEvents();
      console.log(`[Scheduler] Sync completed successfully.`);
    } catch (err) {
      console.error(`[Scheduler] Sync failed:`, err);
    }
  });

  console.log('[Scheduler] Cron job registered (Runs every 20 minutes).');
}
