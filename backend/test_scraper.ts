import { fetchTrendingForEvent } from './src/services/trendingScraper';

async function main() {
  const eventName = '海洋奇緣';
  console.log(`Testing scraper for: ${eventName}`);
  const results = await fetchTrendingForEvent('test-event-id', eventName);
  console.log(JSON.stringify(results, null, 2));
}
main();
