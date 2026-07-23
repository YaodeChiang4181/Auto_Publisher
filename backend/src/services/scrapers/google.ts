import puppeteer from 'puppeteer';
import { ScrapedResult } from './dcard';

export async function fetchGoogleResults(eventName: string): Promise<ScrapedResult[]> {
  console.log(`[Google Scraper] Starting fallback scrape for event: ${eventName}`);
  
  // 專注於搜尋 IG, FB 或綜合影評
  const query = `"${eventName}" (site:instagram.com OR site:facebook.com OR 影評 OR 心得)`;
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    // 增加反爬蟲閃避：設定較真實的 User-Agent 與視窗大小
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });
    
    // 加上隨機延遲，避免瞬間高頻率發請求
    await new Promise(r => setTimeout(r, Math.random() * 2000 + 1000));
    
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Extract top results
    const results: ScrapedResult[] = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('div.g')).slice(0, 5);
      return items.map(item => {
        const titleEl = item.querySelector('h3');
        const linkEl = item.querySelector('a');
        const snippetEl = item.querySelector('div[data-sncf] ~ div, div[style="-webkit-line-clamp:2"]');
        
        let platform = 'Web';
        const urlStr = linkEl?.href || '';
        if (urlStr.includes('instagram.com')) platform = 'IG';
        else if (urlStr.includes('facebook.com')) platform = 'FB';

        return {
          title: titleEl ? titleEl.textContent || '熱門討論' : '熱門討論',
          url: urlStr,
          snippet: snippetEl ? snippetEl.textContent || '點擊查看更多精彩解析與無雷心得。' : '點擊查看更多精彩解析與無雷心得。',
          platform
        };
      }).filter(r => r.url !== '');
    });

    console.log(`[Google Scraper] Found ${results.length} results for ${eventName}`);
    return results;
  } catch (error: any) {
    console.error(`[Google Scraper] Error scraping Google: ${error.message}`);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}
