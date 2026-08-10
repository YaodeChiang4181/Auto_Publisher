import axios from 'axios';
import * as cheerio from 'cheerio';

async function testBing() {
  const query = '纸嫁衣 解析';
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
    const results: any[] = [];
    $('.b_algo').each((_, el) => {
      const titleEl = $(el).find('h2 a');
      const snippetEl = $(el).find('.b_caption p');
      if (titleEl.length > 0) {
        let title = titleEl.text().trim();
        let href = titleEl.attr('href') || '';
        let snippet = snippetEl.text().trim();
        results.push({ title, snippet, href });
      }
    });
    console.log(results);
  } catch (e: any) {
    console.error(e.message);
  }
}

testBing();
