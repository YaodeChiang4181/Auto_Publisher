import axios from 'axios';
import * as cheerio from 'cheerio';
export interface ScrapedResult {
  platform: string;
  title: string;
  snippet: string;
  url: string;
}

export async function searchYahoo(query: string, platformLabel: string = 'Web'): Promise<ScrapedResult[]> {
  const url = `https://tw.search.yahoo.com/search?p=${encodeURIComponent(query)}`;
  
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: 8000
    });
    
    const $ = cheerio.load(res.data);
    const results: ScrapedResult[] = [];
    $('.algo').each((_, el) => {
      const titleEl = $(el).find('h3.title a');
      const snippetEl = $(el).find('.compText');
      if (titleEl.length > 0) {
        let title = titleEl.text().trim();
        let href = titleEl.attr('href') || '';
        let snippet = snippetEl.text().trim();
        
        // Yahoo tracking url cleanup (optional, but good for UX if copied)
        if (href.includes('/RU=')) {
          const match = href.match(/\/RU=([^/]+)/);
          if (match) href = decodeURIComponent(match[1]);
        }
        
        // Enhance platform labeling based on URL if generic Web
        let finalPlatform = platformLabel;
        if (platformLabel === 'Web') {
          if (href.includes('medium.com')) finalPlatform = 'Medium';
          else if (href.includes('vocus.cc')) finalPlatform = 'Vocus';
          else if (href.includes('pixnet.net')) finalPlatform = 'Pixnet';
          else if (href.includes('dcard.tw')) finalPlatform = 'Dcard';
          else if (href.includes('ptt.cc')) finalPlatform = 'PTT';
          else if (href.includes('gamer.com.tw')) finalPlatform = '巴哈姆特';
        } else if (platformLabel === 'Dcard' && !href.includes('dcard.tw')) {
          return; // Skip if Yahoo ignored site:dcard.tw filter
        } else if (platformLabel === 'PTT' && !href.includes('ptt.cc')) {
          return; // Skip if Yahoo ignored site:ptt.cc filter
        }

        results.push({ title, snippet, url: href, platform: finalPlatform });
      }
    });
    return results;
  } catch (error: any) {
    console.error(`[Yahoo Scraper] Error fetching "${query}":`, error.message);
    return [];
  }
}
