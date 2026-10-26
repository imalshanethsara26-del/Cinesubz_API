const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://cinesubz.net/'
};

app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA CINESUBZ HTML SCRAPER API is Live 🚀",
        endpoint: "/api/v1/cinesubz/extract?url=movie_page_url"
    });
});

// Direct HTML Scraper & Link Extractor
app.get('/api/v1/cinesubz/extract', async (req, res) => {
    try {
        const movieUrl = req.query.url || "https://cinesubz.net/movies/spider-man-brand-new-day-2026-sinhala-subtitles/";
        console.log(`\n🔍 [HTML SCRAPER] Scraping movie page: ${movieUrl}`);
        
        const htmlRes = await axios.get(movieUrl, { headers: HEADERS, timeout: 15000 });
        const $ = cheerio.load(htmlRes.data);
        
        // Extract movie details
        const title = $('h1.entry-title, h1.title, .s-item-title h1').text().trim() || $('title').text();
        const poster = $('img.attachment-post-thumbnail, .poster img, .s-item-cover img').attr('src') || '';
        
        // Extract download links / buttons / server links
        let downloadLinks = [];
        $('a.button, a.link-btn, .download-links a, .s-dist-btn, .links_table a, .m-movies-links a').each((i, el) => {
            const text = $(el).text().trim();
            const href = $(el).attr('href');
            if (href && !href.includes('#')) {
                downloadLinks.push({ text, href });
            }
        });

        // Fallback: search for any external download or pixeldrain/mega links in the body
        if (downloadLinks.length === 0) {
            $('a').each((i, el) => {
                const href = $(el).attr('href');
                if (href && (href.includes('pixeldrain') || href.includes('megaup') || href.includes('drive.google') || href.includes('1drv.ms'))) {
                    downloadLinks.push({ text: $(el).text().trim() || 'Download Link', href });
                }
            });
        }

        console.log(`🎉 Extracted ${downloadLinks.length} download links successfully!`);

        res.json({
            status: true,
            creator: "@Imalsha",
            movie_url: movieUrl,
            title: title,
            poster: poster,
            links_count: downloadLinks.length,
            download_links: downloadLinks
        });

    } catch (err) {
        console.error(`❌ [SCRAPER ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`HTML Scraper API running on port ${PORT}`));
