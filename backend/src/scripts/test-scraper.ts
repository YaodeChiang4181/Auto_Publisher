import { fetchTrendingForEvent } from '../services/trendingScraper';

async function runTest() {
  const eventId = 'test-event-id'; // This will cause DB save to fail if it doesn't exist, but we can see the scrape results in console
  const eventName = process.argv[2] || '蜘蛛人';
  
  console.log(`Starting test scrape for: ${eventName}`);
  
  const results = await fetchTrendingForEvent(eventId, eventName);
  
  console.log('\n--- Final Scrape Results ---');
  console.log(JSON.stringify(results, null, 2));
  
  process.exit(0);
}

runTest();
