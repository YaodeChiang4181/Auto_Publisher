import cron from 'node-cron';
import { SyncEngine } from './services/crawlers/engine';
import { VieshowAdapter } from './services/crawlers/vieshow';

export function startScheduler() {
  console.log('--- Initializing Cloud Scheduler ---');

  const engine = new SyncEngine(new VieshowAdapter());

  const syncAll = async () => {
    console.log(`[Scheduler] Triggering crawler sync at ${new Date().toISOString()}`);
    try {
      await engine.syncVenues();
      await engine.syncEvents();
      console.log(`[Scheduler] Sync completed successfully.`);
    } catch (err) {
      console.error(`[Scheduler] Sync failed:`, err);
    }
  };

  // 系統啟動時立即抓取第一次，避免冷啟動無資料
  // syncAll();

  // 每 20 分鐘執行一次爬蟲同步
  // cron.schedule('*/20 * * * *', syncAll);

  console.log('[Scheduler] Cron job disabled (Manual mode only).');
}
