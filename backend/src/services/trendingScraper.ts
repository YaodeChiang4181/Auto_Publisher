import puppeteer from 'puppeteer';
import { prisma } from '../prisma';

export async function fetchTrendingForEvent(eventId: string, eventName: string) {
  // 1. Check Cache
  const cached = await prisma.trendingResult.findMany({
    where: { eventId },
    orderBy: { createdAt: 'desc' },
    take: 3
  });

  if (cached.length >= 3) {
    const ageInHours = (new Date().getTime() - cached[0].createdAt.getTime()) / (1000 * 60 * 60);
    if (ageInHours < 24) {
      return cached; // Return cache if fresher than 24 hours
    } else {
      await prisma.trendingResult.deleteMany({ where: { eventId } });
    }
  }

  // 2. Scrape using Google Search targeted at Dcard/IG/FB
  console.log(`[Scraper] Starting trending scrape for event: ${eventName}`);
  const query = `"${eventName}" (site:dcard.tw OR site:instagram.com OR site:facebook.com OR 影評 OR 心得)`;
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Extract top 3 results
    const results = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('div.g')).slice(0, 3);
      return items.map(item => {
        const titleEl = item.querySelector('h3');
        const linkEl = item.querySelector('a');
        const snippetEl = item.querySelector('div[data-sncf] ~ div, div[style="-webkit-line-clamp:2"]');
        
        let platform = 'Web';
        const urlStr = linkEl?.href || '';
        if (urlStr.includes('dcard.tw')) platform = 'Dcard';
        else if (urlStr.includes('instagram.com')) platform = 'IG';
        else if (urlStr.includes('facebook.com')) platform = 'FB';

        return {
          title: titleEl ? titleEl.textContent || '熱門討論' : '熱門討論',
          url: urlStr,
          snippet: snippetEl ? snippetEl.textContent || '點擊查看更多精彩解析與無雷心得。' : '點擊查看更多精彩解析與無雷心得。',
          platform
        };
      }).filter(r => r.url !== '');
    });

    console.log(`[Scraper] Found ${results.length} results for ${eventName}`);

    // 3. Save to Cache
    const savedResults = [];
    for (const r of results) {
      const saved = await prisma.trendingResult.create({
        data: {
          eventId,
          platform: r.platform,
          title: r.title,
          snippet: r.snippet.substring(0, 190), // Prisma snippet limit is probably 255 but let's be safe
          url: r.url
        }
      });
      savedResults.push(saved);
    }

    return savedResults.length > 0 ? savedResults : cached; // fallback to old cache if empty
  } catch (error) {
    console.error('[Scraper] Error scraping trending:', error);
    return cached; // fallback to cache on error
  } finally {
    if (browser) await browser.close();
  }
}
