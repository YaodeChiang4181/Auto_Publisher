import { CrawlerProvider } from './types';
export declare class SyncEngine {
    private provider;
    constructor(provider: CrawlerProvider);
    syncVenues(): Promise<void>;
    syncEvents(): Promise<void>;
}
//# sourceMappingURL=engine.d.ts.map