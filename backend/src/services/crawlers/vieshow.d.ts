import { CrawlerProvider, ExternalEvent, ExternalVenue } from './types';
export declare class VieshowAdapter implements CrawlerProvider {
    name: string;
    private baseUrl;
    private setupPage;
    fetchVenues(): Promise<ExternalVenue[]>;
    fetchEvents(): Promise<ExternalEvent[]>;
}
//# sourceMappingURL=vieshow.d.ts.map