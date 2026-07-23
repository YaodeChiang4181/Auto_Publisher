import axios from 'axios';
import * as cheerio from 'cheerio';
import { ScrapedResult } from './dcard';

export async function fetchPttPosts(eventName: string): Promise<ScrapedResult[]> {
  try {
    console.log(`[PTT Scraper] Searching for: ${eventName}`);
    
    // PTT 電影版搜尋
    const searchUrl = `https://www.ptt.cc/bbs/movie/search`;
    const response = await axios.get(searchUrl, {
      params: { q: `${eventName} 解析` },
      headers: {
        'Cookie': 'over18=1', // PTT 18+ bypass
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const results: ScrapedResult[] = [];

    // 解析前五筆搜尋結果
    $('.r-ent').slice(0, 5).each((_, el) => {
      const titleEl = $(el).find('.title a');
      const title = titleEl.text().trim();
      const href = titleEl.attr('href');
      const author = $(el).find('.meta .author').text().trim();

      if (title && href) {
        results.push({
          platform: 'PTT', // Though the user mentioned IG, Dcard, FB in UI, PTT is a good bonus. The UI falls back to 'Web' icon for unknown platforms.
          title: title,
          snippet: `PTT 電影版網友 ${author} 的熱門討論，點擊查看詳細無雷心得與彩蛋解析。`,
          url: `https://www.ptt.cc${href}`
        });
      }
    });

    return results;
  } catch (error: any) {
    console.error(`[PTT Scraper] Failed to fetch PTT posts: ${error.message}`);
    return [];
  }
}
