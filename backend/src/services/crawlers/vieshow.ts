import puppeteer, { Page } from 'puppeteer';
import { CrawlerProvider, ExternalEvent, ExternalVenue } from './types';

// Utility for delays (Anti-scraping)
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export class VieshowAdapter implements CrawlerProvider {
  name = 'Vieshow';
  private baseUrl = 'https://www.vieshow.com.tw';

  private async setupPage(): Promise<{ browser: any, page: Page }> {
    const browser = await puppeteer.launch({
      headless: true, 
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    // 1. Anti-scraping: Random User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    return { browser, page };
  }

  async fetchVenues(): Promise<ExternalVenue[]> {
    console.log(`[Vieshow] Fetching venues...`);
    const { browser, page } = await this.setupPage();
    const venues: ExternalVenue[] = [];

    try {
      // 假設我們去爬威秀影城列表頁面
      // 注意：以下 DOM Selector 為架構示範，實際需依據現行威秀網站調整
      await page.goto(`${this.baseUrl}/cinemas`, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // 2. Anti-scraping: 模擬人類延遲
      await delay(2000 + Math.random() * 1000); 
      
      // 3. 網頁結構變動容錯 (DOM Resilience)
      const extracted = await page.evaluate(() => {
        const results: any[] = [];
        try {
          // 假設影城列表的 Selector 為 .cinema-list-item
          document.querySelectorAll('.cinema-list-item').forEach(el => {
            const id = el.getAttribute('data-id');
            const name = el.querySelector('.cinema-name')?.textContent?.trim();
            if (id && name) {
              results.push({ id, name });
            }
          });
        } catch (e) {
          // 靜默捕捉 DOM 解析錯誤
        }
        return results;
      });

      for (const item of extracted) {
        venues.push({
          externalId: `vieshow_${item.id}`,
          name: `威秀影城 - ${item.name}`,
          externalMeta: { source: 'vieshow', originalId: item.id }
        });
      }
    } catch (err) {
      // 不會造成整個伺服器崩潰，只會記錄錯誤
      console.error('[Vieshow] Error fetching venues:', err);
    } finally {
      await browser.close();
    }
    
    // 如果真實網站結構變動導致抓不到，提供備案 (POC 測試用，避免空資料)
    if (venues.length === 0) {
      console.warn('[Vieshow] No venues found via DOM parsing, using fallback data for POC.');
      venues.push({
        externalId: 'demo-venue-id', // 對齊我們前端預設的 demo ID
        name: '信義威秀影城 (測試)',
        externalMeta: { source: 'vieshow', fallback: true }
      });
    }

    return venues;
  }

  async fetchEvents(): Promise<ExternalEvent[]> {
    console.log(`[Vieshow] Fetching events...`);
    const { browser, page } = await this.setupPage();
    const events: ExternalEvent[] = [];

    try {
      // 假設爬取信義威秀場次表
      await page.goto(`${this.baseUrl}/shows/ts`, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // 隨機延遲 (1~3秒)
      await delay(2000 + Math.random() * 1000); 
      
      const extracted = await page.evaluate(() => {
        const results: any[] = [];
        try {
          document.querySelectorAll('.showtime-item').forEach(el => {
            const id = el.getAttribute('data-event-id');
            const title = el.querySelector('.movie-title')?.textContent?.trim();
            const timeStr = el.querySelector('.time')?.textContent?.trim(); // e.g., "14:30"
            
            if (id && title && timeStr) {
              results.push({ id, title, timeStr });
            }
          });
        } catch(e) {}
        return results;
      });

      for (const item of extracted) {
        const [hours, mins] = item.timeStr.split(':').map(Number);
        const startTime = new Date();
        startTime.setHours(hours, mins, 0, 0);
        const endTime = new Date(startTime.getTime() + 120 * 60000); // 假設片長 120 分鐘

        events.push({
          externalId: `vieshow_event_${item.id}`,
          name: item.title,
          startTime,
          unlockTime: endTime,
          venueExternalId: 'demo-venue-id', // 對應上面的 fallback venue
          externalMeta: { source: 'vieshow', originalId: item.id }
        });
      }
    } catch (err) {
      console.error('[Vieshow] Error fetching events:', err);
    } finally {
      await browser.close();
    }

    // POC 備用資料
    if (events.length === 0) {
      console.warn('[Vieshow] No events found via DOM parsing, using fallback data for POC.');
      const now = new Date();
      events.push({
        externalId: 'demo-event-id', // 對齊我們前端預設的 demo ID
        name: '沙丘2 (IMAX) - POC測試',
        startTime: now,
        unlockTime: new Date(now.getTime() + 15 * 60000), 
        venueExternalId: 'demo-venue-id',
        externalMeta: { source: 'vieshow', fallback: true }
      });
    }

    return events;
  }
}
