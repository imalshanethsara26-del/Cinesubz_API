const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://cinesubz.net/',
    'Accept-Language': 'en-US,en;q=0.9'
};

app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA CINESUBZ REDIRECT RESOLVER API is Live 🚀",
        endpoint: "/api/v1/cinesubz/extract?url=movie_page_url"
    });
});

app.get('/api/v1/cinesubz/extract', async (req, res) => {
    const movieUrl = req.query.url || "https://cinesubz.net/movies/spider-man-brand-new-day-2026-sinhala-subtitles/";
    
    console.log(`\n🔥 [DEEP RESOLVER] Processing Movie URL: ${movieUrl}`);

    try {
        // 1. Fetch main movie page
        const htmlRes = await axios.get(movieUrl, { headers: HEADERS, timeout: 20000 });
        const $ = cheerio.load(htmlRes.data);
        
        const title = $('h1').first().text().trim() || $('title').text();
        let intermediateLinks = [];

        // 2. Find all download links/buttons that point to the api or redirect pages
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim();
            if (href && (href.includes('/api/') || href.includes('csplayer') || href.includes('download') || href.includes('watch'))) {
                if (!intermediateLinks.includes(href) && !href.startsWith('#')) {
                    intermediateLinks.push(href);
                }
            }
        });

        console.log(`🔍 Found ${intermediateLinks.length} intermediate/redirect links.`);

        let finalDownloadLinks = [];

        // 3. Resolve each intermediate link to find final direct/telegram links
        for (const link of intermediateLinks) {
            try {
                console.log(`🌐 Resolving redirect page: ${link}`);
                const pageRes = await axios.get(link, { headers: HEADERS, timeout: 10000 });
                const $page = cheerio.load(pageRes.data);

                // Scrape final download buttons on the redirected page (e.g. csplayer page)
                $page('a').each((j, subEl) => {
                    const subHref = $page(subEl).attr('href');
                    const subText = $page(subEl).text().trim();
                    
                    if (subHref && (subHref.includes('pixeldrain') || subHref.includes('megaup') || subHref.includes('drive.google') || subHref.includes('1drv.ms') || subHref.includes('terabox') || subHref.includes('t.me') || subHref.includes('download'))) {
                        if (!finalDownloadLinks.some(f => f.href === subHref)) {
                            finalDownloadLinks.push({
                                source_page: link,
                                text: subText || 'Direct Download',
                                href: subHref
                            });
                        }
                    }
                });
            } catch (errRedirect) {
                console.log(`⚠️ Failed to resolve link ${link}: ${errRedirect.message}`);
            }
        }

        console.log(`🎯 Successfully resolved ${finalDownloadLinks.length} final download links!`);

        res.json({
            status: true,
            creator: "@Imalsha",
            movie_url: movieUrl,
            title: title,
            links_count: finalDownloadLinks.length,
            links: finalDownloadLinks
        });

    } catch (err) {
        console.error(`❌ [ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Redirect Resolver API running on port ${PORT}`));
