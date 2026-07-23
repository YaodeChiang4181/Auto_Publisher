import axios from 'axios';

export interface ScrapedResult {
  platform: string;
  title: string;
  snippet: string;
  url: string;
}

export async function fetchDcardPosts(eventName: string): Promise<ScrapedResult[]> {
  try {
    console.log(`[Dcard Scraper] Searching for: ${eventName}`);
    const response = await axios.get(`https://www.dcard.tw/service/api/v2/search/posts`, {
      params: {
        query: eventName,
        limit: 5,
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      }
    });

    if (response.data && Array.isArray(response.data)) {
      return response.data.map((post: any) => ({
        platform: 'Dcard',
        title: post.title || 'Dcard 熱門討論',
        snippet: post.excerpt ? post.excerpt.substring(0, 190) : '點擊查看更多精彩解析與無雷心得。',
        url: post.forumAlias && post.id ? `https://dcard.tw/f/${post.forumAlias}/p/${post.id}` : 'https://dcard.tw'
      }));
    }
    
    return [];
  } catch (error: any) {
    console.error(`[Dcard Scraper] Failed to fetch Dcard posts: ${error.message}`);
    return [];
  }
}
