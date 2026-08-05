import axios from 'axios';
import * as cheerio from 'cheerio';
import { ScrapedResult } from './yahoo';

export async function searchBing(query: string, platformLabel: string = 'Web'): Promise<ScrapedResult[]> {
  const url = `https://cn.bing.com/search?q=${encodeURIComponent(query)}`;
  
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: 8000
    });
    
    const $ = cheerio.load(res.data);
    const results: ScrapedResult[] = [];
    
    $('.b_algo').each((_, el) => {
      const titleEl = $(el).find('h2 a');
      const snippetEl = $(el).find('.b_caption p, .b_algoSlug');
      
      if (titleEl.length > 0) {
        let title = titleEl.text().trim();
        let href = titleEl.attr('href') || '';
        let snippet = snippetEl.text().trim();
        
        let finalPlatform = platformLabel;
        if (platformLabel === 'Web') {
          if (href.includes('zhihu.com')) finalPlatform = '知乎';
          else if (href.includes('bilibili.com')) finalPlatform = 'Bilibili';
          else if (href.includes('douban.com')) finalPlatform = '豆瓣';
          else if (href.includes('baidu.com')) finalPlatform = '百度';
          else if (href.includes('xiaohongshu.com')) finalPlatform = '小紅書';
        }
        
        results.push({ title, snippet, url: href, platform: finalPlatform });
      }
    });
    return results;
  } catch (error: any) {
    console.error(`[Bing Scraper] Error fetching "${query}":`, error.message);
    return [];
  }
}
