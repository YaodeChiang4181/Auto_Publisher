import { prisma } from '../prisma';
import { fetchDcardPosts, ScrapedResult } from './scrapers/dcard';
import { fetchPttPosts } from './scrapers/ptt';
import { fetchGoogleResults } from './scrapers/google';

export async function fetchTrendingForEvent(eventId: string, eventName: string) {
  // 1. Check Cache
  const cached = await prisma.trendingResult.findMany({
    where: { eventId },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  if (cached.length >= 3) {
    const ageInHours = (new Date().getTime() - cached[0].createdAt.getTime()) / (1000 * 60 * 60);
    if (ageInHours < 24) {
      return cached; // Return cache if fresher than 24 hours
    } else {
      await prisma.trendingResult.deleteMany({ where: { eventId } });
    }
  }

  console.log(`[Scraper Engine] Starting multi-source scrape for event: ${eventName}`);
  
  let combinedResults: ScrapedResult[] = [];

  // 2. 優先非同步並行執行高速 API 爬蟲 (Dcard + PTT)
  try {
    const [dcardResults, pttResults] = await Promise.all([
      fetchDcardPosts(eventName),
      fetchPttPosts(eventName)
    ]);
    
    combinedResults = [...dcardResults, ...pttResults];
    console.log(`[Scraper Engine] Fast Scrape found ${combinedResults.length} results (Dcard: ${dcardResults.length}, PTT: ${pttResults.length})`);
  } catch (error) {
    console.error(`[Scraper Engine] Fast Scrape failed:`, error);
  }

  // 3. 備援策略：如果高速 API 抓不到足夠資料，啟動 Puppeteer 抓取 Google (IG/FB)
  if (combinedResults.length < 3) {
    try {
      console.log(`[Scraper Engine] Fast Scrape results insufficient. Triggering Google fallback.`);
      const googleResults = await fetchGoogleResults(eventName);
      combinedResults = [...combinedResults, ...googleResults];
    } catch (error) {
      console.error(`[Scraper Engine] Google fallback failed:`, error);
    }
  }

  // 去除重複網址的結果
  const uniqueUrls = new Set<string>();
  const finalResults: ScrapedResult[] = [];
  
  for (const r of combinedResults) {
    if (!uniqueUrls.has(r.url)) {
      uniqueUrls.add(r.url);
      finalResults.push(r);
    }
  }

  // 取前三名 (可以後續加入更複雜的權重排序，例如 Dcard 愛心數)
  const topResults = finalResults.slice(0, 3);
  console.log(`[Scraper Engine] Finalized ${topResults.length} results for ${eventName}`);

  // 4. Save to Cache
  const savedResults = [];
  for (const r of topResults) {
    try {
      const saved = await prisma.trendingResult.create({
        data: {
          eventId,
          platform: r.platform,
          title: r.title,
          snippet: r.snippet.substring(0, 190), // Prisma limit safe-guard
          url: r.url
        }
      });
      savedResults.push(saved);
    } catch (dbError) {
      console.error(`[Scraper Engine] DB save error:`, dbError);
    }
  }

  return savedResults.length > 0 ? savedResults : cached; // fallback to old cache if all failed
}
