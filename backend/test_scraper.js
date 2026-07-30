import { search } from 'duck-duck-scrape';
async function test(eventName) {
    const sanitizedEventName = eventName.replace(/[．。，、：；？！:;,!?()（）\[\]「」『』""''《》〈〉【】&\-~]/g, ' ').replace(/\s+/g, ' ').trim();
    console.log(`Sanitized: ${sanitizedEventName}`);
    const query1 = `${sanitizedEventName} 解析`;
    const res = await search(query1, {
        safeSearch: 1
    });
    console.log(`Raw results: ${res.results.length}`);
    const blacklistDomains = ['dict.revised.moe.edu.tw', 'baike.baidu.com/item/仙', 'zdic.net', 'dict.concised.moe.edu.tw'];
    const blacklistTitleKeywords = ['辭典檢視', '漢語漢字', '漢語字典', '新華字典', '康熙字典'];
    const filtered = res.results.filter(r => {
        if (blacklistDomains.some(d => r.url.includes(d)))
            return false;
        if (blacklistTitleKeywords.some(k => r.title.includes(k)))
            return false;
        const keywords = sanitizedEventName.split(' ').filter(w => w.length >= 2);
        if (keywords.length > 0) {
            const hasRelevantKeyword = keywords.some(k => r.title.includes(k) || r.description.includes(k));
            if (!hasRelevantKeyword) {
                console.log(`Filtered out due to missing keyword: ${r.title}`);
                return false;
            }
        }
        return true;
    });
    console.log(`Filtered results: ${filtered.length}`);
    for (const f of filtered.slice(0, 3)) {
        console.log(`- ${f.title}`);
    }
}
test('海洋奇緣');
