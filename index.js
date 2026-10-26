const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

const ADVANCED_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://cinesubz.net/',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
};

app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA CINESUBZ SCRIPT SCRAPER API is Live 🚀",
        endpoint: "/api/v1/cinesubz/extract?url=movie_page_url"
    });
});

app.get('/api/v1/cinesubz/extract', async (req, res) => {
    const movieUrl = req.query.url || "https://cinesubz.net/movies/spider-man-brand-new-day-2026-sinhala-subtitles/";
    
    console.log(`\n🔥 [DEEP SCRIPT SCAN] URL: ${movieUrl}`);

    try {
        const htmlRes = await axios.get(movieUrl, { headers: ADVANCED_HEADERS, timeout: 20000 });
        const $ = cheerio.load(htmlRes.data);
        
        const title = $('h1').first().text().trim() || $('title').text();
        let extractedUrls = [];

        // 1. Scan all <a> tags (ignoring internal anchor links like #...)
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim();
            if (href && !href.startsWith('#') && !href.startsWith('javascript')) {
                if (href.includes('pixeldrain') || href.includes('megaup') || href.includes('drive.google') || href.includes('1drv.ms') || href.includes('terabox') || href.includes('zippyshare') || href.includes('download') || href.includes('watch')) {
                    extractedUrls.push({ source: 'anchor_tag', text, href });
                }
            }
        });

        // 2. Scan all <script> tags for hidden URLs or JSON payloads
        $('script').each((i, el) => {
            const scriptContent = $(el).html() || '';
            // Regex to find URLs inside scripts
            const urlMatches = scriptContent.match(/https?:\/\/[^\s"'<>]+(?:pixeldrain|megaup|drive\.google|terabox|zippyshare)[^\s"'<>]+/gi);
            if (urlMatches) {
                urlMatches.forEach(url => {
                    if (!extractedUrls.some(u => u.href === url)) {
                        extractedUrls.push({ source: 'script_tag', text: 'Hidden Script URL', href: url });
                    }
                });
            }
        });

        // 3. Scan iframes
        $('iframe').each((i, el) => {
            const src = $(el).attr('src');
            if (src && !extractedUrls.some(u => u.href === src)) {
                extractedUrls.push({ source: 'iframe', text: 'Player Embed', href: src });
            }
        });

        console.log(`🎯 Deep Scan Found ${extractedUrls.length} valid links/embeds.`);

        res.json({
            status: true,
            creator: "@Imalsha",
            movie_url: movieUrl,
            title: title,
            links_count: extractedUrls.length,
            links: extractedUrls
        });

    } catch (err) {
        console.error(`❌ [ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Script Scraper API running on port ${PORT}`));
