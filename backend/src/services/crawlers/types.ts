export interface ExternalEvent {
  externalId: string;
  name: string;
  startTime: Date;
  unlockTime: Date;
  venueExternalId: string;
  externalMeta?: any;
}

export interface ExternalVenue {
  externalId: string;
  name: string;
  address?: string;
  externalMeta?: any;
}

export interface CrawlerProvider {
  name: string;
  fetchVenues(): Promise<ExternalVenue[]>;
  fetchEvents(): Promise<ExternalEvent[]>;
}
