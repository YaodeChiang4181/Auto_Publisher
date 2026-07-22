"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScheduler = startScheduler;
const node_cron_1 = __importDefault(require("node-cron"));
const engine_1 = require("./services/crawlers/engine");
const vieshow_1 = require("./services/crawlers/vieshow");
const prisma_1 = require("./prisma");
function startScheduler() {
    console.log('--- Initializing Cloud Scheduler ---');
    const engine = new engine_1.SyncEngine(new vieshow_1.VieshowAdapter());
    const syncAll = async () => {
        console.log(`[Scheduler] Triggering crawler sync at ${new Date().toISOString()}`);
        try {
            await engine.syncVenues();
            await engine.syncEvents();
            console.log(`[Scheduler] Sync completed successfully.`);
        }
        catch (err) {
            console.error(`[Scheduler] Sync failed:`, err);
        }
    };
    // 系統啟動時立即抓取第一次，避免冷啟動無資料
    syncAll();
    // 每 20 分鐘執行一次爬蟲同步
    node_cron_1.default.schedule('*/20 * * * *', syncAll);
    console.log('[Scheduler] Cron job registered (Runs every 20 minutes).');
}
//# sourceMappingURL=scheduler.js.map