import { prisma } from '../prisma';
import { searchYahoo, ScrapedResult } from './scrapers/yahoo';
import { searchBing } from './scrapers/bing';

export async function fetchTrendingForEvent(eventId: string, eventName: string) {
  // 1. Check Cache - 只要該活動有任何快取且未超過 24 小時，直接使用
  const cached = await prisma.trendingResult.findMany({
    where: { eventId },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  if (cached.length > 0) {
    const ageInHours = (new Date().getTime() - cached[0].createdAt.getTime()) / (1000 * 60 * 60);
    if (ageInHours < 24) {
      return cached; // 快取有效，直接回傳
    } else {
      // 快取過期，清除後重新爬取
      await prisma.trendingResult.deleteMany({ where: { eventId } });
    }
  }

  console.log(`[Scraper Engine] Starting multi-source scrape for event: ${eventName}`);
  
  let combinedResults: ScrapedResult[] = [];

  // 2. 清理活動名稱：移除特殊符號，保留核心關鍵字
  const sanitizedEventName = eventName.replace(/[．。，、：；？！:;,!?()（）\[\]「」『』""''《》〈〉【】&\-~]/g, ' ').replace(/\s+/g, ' ').trim();

  try {
    // [核心修正] 不再使用 site: 限定搜尋，因為冷門詞彙在特定站點幾乎沒有結果
    // 改為三組不同關鍵字組合的通用搜尋，並同步使用 Bing 抓取簡體中文來源 (知乎/豆瓣/B站)
    const query1 = `${sanitizedEventName} 劇本殺 解析`;
    const query2 = `${sanitizedEventName} 劇本殺 評價`;
    const query3 = `${sanitizedEventName} 剧本杀 剧透 结局`; // 特地用簡體字幫助 Bing 抓取

    const [results1, results2, results3, bing1, bing2] = await Promise.all([
      searchYahoo(query1, 'Web'),
      searchYahoo(query2, 'Web'),
      searchYahoo(query3, 'Web'),
      searchBing(query1, 'Web'),
      searchBing(query3, 'Web') // 用簡體 query3 幫助 Bing 抓取對岸資料
    ]);
    
    combinedResults = [...results1, ...bing1, ...results2, ...results3, ...bing2];
    console.log(`[Scraper Engine] Raw results: ${combinedResults.length} (Yahoo: ${results1.length + results2.length + results3.length}, Bing: ${bing1.length + bing2.length})`);
  } catch (error) {
    console.error(`[Scraper Engine] Scrape failed:`, error);
  }

  // 3. 過濾掉明顯不相關的結果（字典、百科單字解釋等）
  const blacklistDomains = ['dict.revised.moe.edu.tw', 'baike.baidu.com/item/仙', 'zdic.net', 'dict.concised.moe.edu.tw'];
  const blacklistTitleKeywords = ['辭典檢視', '漢語漢字', '漢語字典', '新華字典', '康熙字典'];
  
  combinedResults = combinedResults.filter(r => {
    // 過濾字典網站
    if (blacklistDomains.some(d => r.url.includes(d))) return false;
    // 過濾標題含有字典關鍵字的結果
    if (blacklistTitleKeywords.some(k => r.title.includes(k))) return false;
    // 確保結果標題或摘要至少包含活動名稱中的一個核心關鍵字（至少2字）
    const keywords = sanitizedEventName.split(' ').filter(w => w.length >= 2);
    if (keywords.length > 0) {
      const hasRelevantKeyword = keywords.some(k => r.title.includes(k) || r.snippet.includes(k));
      if (!hasRelevantKeyword) return false;
    }
    return true;
  });

  console.log(`[Scraper Engine] After filtering: ${combinedResults.length} relevant results`);

  // 4. 完美降級 (Graceful Degradation): 如果全數失敗，產生通用搜尋連結
  if (combinedResults.length === 0) {
    console.log(`[Scraper Engine] All results filtered out. Injecting graceful fallback.`);
    combinedResults.push({
      platform: 'Web',
      title: `${eventName} - 深度討論與解析`,
      snippet: `系統為您精選關於「${eventName}」的熱門話題，點擊立即參與討論與查看評價。`,
      url: `https://tw.search.yahoo.com/search?p=${encodeURIComponent(eventName + ' 劇本殺 解析')}`
    });
  }

  // 去除重複網址並計算繁簡體權重分數
  const uniqueUrls = new Set<string>();
  const scoredResults: (ScrapedResult & { score: number })[] = [];
  
  for (let i = 0; i < combinedResults.length; i++) {
    const r = combinedResults[i];
    if (!uniqueUrls.has(r.url)) {
      uniqueUrls.add(r.url);
      
      // 基礎分數：根據原始搜尋排名，越前面分數越高 (假設最多 100 筆)
      let score = 100 - i;
      
      // 語言權重分析
      const fullText = r.title + " " + r.snippet;
      const tcChars = /[這個們來發見過為後裡麼將應還僅記時關實對機網書話車學]/g;
      const scChars = /[这个们来发见过为后里么将应还仅记时关实对机网书话车学]/g;
      
      const tcCount = (fullText.match(tcChars) || []).length;
      const scCount = (fullText.match(scChars) || []).length;
      
      // 繁體權重稍高 (+15)，簡體權重接近 (+10)，完全沒特徵則給 (+12)
      if (tcCount > scCount) {
        score += 15;
      } else if (scCount > tcCount) {
        score += 10;
      } else {
        score += 12;
      }

      scoredResults.push({ ...r, score });
    }
  }

  // 根據分數重新排序 (高分優先)
  scoredResults.sort((a, b) => b.score - a.score);

  // 取前三名
  const topResults = scoredResults.slice(0, 3);
  console.log(`[Scraper Engine] Finalized ${topResults.length} results for ${eventName}`);

  // 5. Save to Cache
  const savedResults = [];
  for (const r of topResults) {
    // 不要把 fallback 存進資料庫，這樣下次進來才有機會重新爬取真正的文章
    const isFallback = r.url.includes('tw.search.yahoo.com/search?p=');
    
    if (!isFallback) {
      try {
        const saved = await prisma.trendingResult.create({
          data: {
            eventId,
            platform: r.platform,
            title: r.title,
            snippet: r.snippet.substring(0, 190),
            url: r.url
          }
        });
        savedResults.push(saved);
      } catch (dbError) {
        console.error(`[Scraper Engine] DB save error:`, dbError);
      }
    } else {
      // 如果是 fallback，直接放入回傳陣列，但不存入資料庫
      savedResults.push({
        id: 'fallback-' + Date.now(),
        eventId,
        platform: r.platform,
        title: r.title,
        snippet: r.snippet,
        url: r.url,
        imageUrl: null,
        createdAt: new Date()
      } as any);
    }
  }

  return savedResults.length > 0 ? savedResults : cached;
}
