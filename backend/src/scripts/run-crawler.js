"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vieshow_1 = require("../services/crawlers/vieshow");
const engine_1 = require("../services/crawlers/engine");
const prisma_1 = require("../prisma");
async function run() {
    console.log('--- Starting Crawler Sync POC ---');
    const vieshow = new vieshow_1.VieshowAdapter();
    const engine = new engine_1.SyncEngine(vieshow);
    try {
        // 1. 同步場館
        await engine.syncVenues();
        // 2. 同步場次
        await engine.syncEvents();
        console.log('--- Crawler Sync Finished Successfully ---');
    }
    catch (err) {
        console.error('Crawler failed:', err);
    }
    finally {
        await prisma_1.prisma.$disconnect();
        process.exit(0);
    }
}
run();
//# sourceMappingURL=run-crawler.js.map