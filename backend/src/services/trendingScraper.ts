import { prisma } from '../prisma';
import { searchYahoo, ScrapedResult } from './scrapers/yahoo';

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

  // 2. 透過統一的 Yahoo Search Gateway 進行精準智慧搜尋 (避開反爬蟲牆)
  try {
    const dcardQuery = `"${eventName}" (影評 OR 解析) site:dcard.tw`;
    const pttQuery = `"${eventName}" (雷 OR 解析) site:ptt.cc/bbs/movie`;
    const webQuery = `"${eventName}" (影評 OR 解析) -新聞 -yahoo -ettoday -chinatimes -udn -appledaily -ltn`;

    const [dcardResults, pttResults, webResults] = await Promise.all([
      searchYahoo(dcardQuery, 'Dcard'),
      searchYahoo(pttQuery, 'PTT'),
      searchYahoo(webQuery, 'Web')
    ]);
    
    combinedResults = [...dcardResults, ...pttResults, ...webResults];
    console.log(`[Scraper Engine] Gateway found ${combinedResults.length} results (Dcard: ${dcardResults.length}, PTT: ${pttResults.length}, Web: ${webResults.length})`);
  } catch (error) {
    console.error(`[Scraper Engine] Gateway Scrape failed:`, error);
  }

  // 3. 完美降級 (Graceful Degradation): 如果萬一還是全數失敗被擋，產生一個通用的搜尋連結，避免空畫面
  if (combinedResults.length === 0) {
    console.log(`[Scraper Engine] Gateway returned 0 results. Injecting graceful fallback.`);
    combinedResults.push({
      platform: 'Web',
      title: `${eventName} - Yahoo 電影深度討論與解析`,
      snippet: `系統為您精選關於「${eventName}」的熱門話題，點擊立即前往 Yahoo 電影參與討論與查看評價。`,
      url: `https://tw.search.yahoo.com/search?p=${encodeURIComponent(eventName + ' 影評 解析')}`
    });
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
