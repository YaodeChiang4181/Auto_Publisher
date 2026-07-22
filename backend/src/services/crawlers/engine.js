"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncEngine = void 0;
const prisma_1 = require("../../prisma");
const types_1 = require("./types");
class SyncEngine {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    async syncVenues() {
        console.log(`[${this.provider.name}] Starting venue sync...`);
        try {
            const venues = await this.provider.fetchVenues();
            let synced = 0;
            for (const v of venues) {
                // Idempotency: Upsert based on externalId
                await prisma_1.prisma.venue.upsert({
                    where: { externalId: v.externalId },
                    update: { name: v.name, externalMeta: v.externalMeta },
                    create: {
                        name: v.name,
                        externalId: v.externalId,
                        externalMeta: v.externalMeta,
                        // Fallback default coordinates since crawler might not have them immediately
                        geoLat: 25.033964,
                        geoLng: 121.564468,
                        geoRadius: 500
                    }
                });
                synced++;
            }
            console.log(`[${this.provider.name}] Synced ${synced} venues.`);
        }
        catch (err) {
            console.error(`[${this.provider.name}] Venue sync failed:`, err);
        }
    }
    async syncEvents() {
        console.log(`[${this.provider.name}] Starting event sync...`);
        try {
            const events = await this.provider.fetchEvents();
            let synced = 0;
            for (const e of events) {
                // Find venue mapping in our DB
                const venue = await prisma_1.prisma.venue.findUnique({
                    where: { externalId: e.venueExternalId }
                });
                if (!venue) {
                    console.warn(`[${this.provider.name}] Venue ${e.venueExternalId} not found, skipping event ${e.externalId}`);
                    continue;
                }
                // Idempotency: Upsert Event
                await prisma_1.prisma.event.upsert({
                    where: { externalId: e.externalId },
                    update: {
                        name: e.name,
                        startTime: e.startTime,
                        unlockTime: e.unlockTime,
                        venueId: venue.id,
                        externalMeta: e.externalMeta
                    },
                    create: {
                        name: e.name,
                        startTime: e.startTime,
                        unlockTime: e.unlockTime,
                        venueId: venue.id,
                        externalId: e.externalId,
                        externalMeta: e.externalMeta
                    }
                });
                synced++;
            }
            console.log(`[${this.provider.name}] Synced ${synced} events.`);
        }
        catch (err) {
            console.error(`[${this.provider.name}] Event sync failed:`, err);
        }
    }
}
exports.SyncEngine = SyncEngine;
//# sourceMappingURL=engine.js.map