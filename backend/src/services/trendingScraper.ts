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
    // [Bugfix] 移除絕對引號並過濾特殊符號 (如「．」、「：」)，避免搜尋引擎 Exact Match 失敗導致完全搜不到
    const sanitizedEventName = eventName.replace(/[．。，、：；？！:;,!?()\[\]"'']/g, ' ').replace(/\s+/g, ' ').trim();

    const dcardQuery = `${sanitizedEventName} (影評 OR 解析 OR 介紹 OR 心得) site:dcard.tw`;
    // 將 PTT 範圍從 bbs/movie 放寬到整個 PTT，這樣才能搜到劇本殺 (LARP) 或動漫版 (C_Chat) 的心得
    const pttQuery = `${sanitizedEventName} (雷 OR 解析 OR 介紹 OR 心得) site:ptt.cc`;
    const webQuery = `${sanitizedEventName} (影評 OR 解析 OR 介紹 OR 心得 OR 推薦) -新聞 -yahoo -ettoday -chinatimes -udn -appledaily -ltn`;

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
      title: `${eventName} - 深度討論與解析`,
      snippet: `系統為您精選關於「${eventName}」的熱門話題，點擊立即參與討論與查看評價。`,
      url: `https://tw.search.yahoo.com/search?p=${encodeURIComponent(eventName + ' 影評 解析 介紹')}`
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
