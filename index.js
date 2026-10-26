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
        message: "IMALSHA CINESUBZ MASTER SCRAPER API is Live 🚀",
        endpoint: "/api/v1/cinesubz/extract?url=movie_page_url"
    });
});

app.get('/api/v1/cinesubz/extract', async (req, res) => {
    const movieUrl = req.query.url || "https://cinesubz.net/movies/spider-man-brand-new-day-2026-sinhala-subtitles/";
    
    console.log(`\n🔥 [INCOMING REQUEST] URL: ${movieUrl}`);

    try {
        console.log(`🔍 Fetching HTML with Advanced Headers...`);
        const htmlRes = await axios.get(movieUrl, { headers: ADVANCED_HEADERS, timeout: 20000 });
        
        console.log(`📦 HTML Fetched Successfully! Length: ${htmlRes.data.length}`);
        
        const $ = cheerio.load(htmlRes.data);
        const title = $('h1').first().text().trim() || $('title').text();
        const poster = $('img.attachment-post-thumbnail, .poster img, .s-item-cover img').attr('src') || '';
        
        let links = [];

        // 1. Scrape all buttons, download links, and server selection elements
        $('a.button, a.link-btn, .download-links a, .s-dist-btn, .links_table a, .m-movies-links a, .wp-block-button__link, .button-download').each((i, el) => {
            const text = $(el).text().trim();
            const href = $(el).attr('href');
            if (href && !href.includes('#') && !links.some(l => l.href === href)) {
                links.push({ type: 'button_link', text, href });
            }
        });

        // 2. Scrape general external links or file hosting sites (Pixeldrain, Mega, GDrive, etc.)
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim() || 'Link';
            if (href && (
                href.includes('pixeldrain') || 
                href.includes('megaup') || 
                href.includes('drive.google') || 
                href.includes('1drv.ms') ||
                href.includes('terabox') ||
                href.includes('zippyshare') ||
                href.includes('watch') ||
                href.includes('download')
            )) {
                if (!links.some(l => l.href === href)) {
                    links.push({ type: 'host_link', text, href });
                }
            }
        });

        // 3. Scrape iframes (Player embeds)
        $('iframe').each((i, el) => {
            const src = $(el).attr('src');
            if (src && !links.some(l => l.href === src)) {
                links.push({ type: 'iframe_embed', text: 'Player Embed', href: src });
            }
        });

        console.log(`🎯 Extracted total ${links.length} potential links/embeds.`);

        res.json({
            status: true,
            creator: "@Imalsha",
            movie_url: movieUrl,
            title: title,
            poster: poster,
            links_count: links.length,
            links: links
        });

    } catch (err) {
        console.error(`❌ [ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Master Scraper API running on port ${PORT}`));
