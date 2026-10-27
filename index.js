const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://cinesubz.co/'
};

// Root Status Route
app.get('/', (res) => {
    res.json({
        status: true,
        message: "IMALSHA CINESUBZ WP-JSON DIRECT API is Live 🚀",
        endpoints: {
            latest: "/api/v1/cinesubz/latest?page=1",
            search: "/api/v1/cinesubz/search?q=movie_name",
            infodl: "/api/v1/cinesubz/infodl?url=movie_url"
        }
    });
});

// 1. Latest Movies Endpoint
app.get('/api/v1/cinesubz/latest', async (req, res) => {
    try {
        const pageNum = req.query.page || 1;
        const latestUrl = pageNum == 1 ? "https://cinesubz.co/" : `https://cinesubz.co/page/${pageNum}/`;
        
        const response = await axios.get(latestUrl, { headers: HEADERS, timeout: 15000 });
        const $ = cheerio.load(response.data);
        const results = [];

        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const parent = $(el).closest('article, .post, .item, div');
            
            let title = $(el).find('h2, h3, .title').text().trim();
            if (!title) title = $(el).attr('title') || '';
            if (!title) title = $(el).text().trim();

            let img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || $(el).find('img').attr('data-lazy-src');
            if (!img) {
                img = parent.find('img').attr('src') || parent.find('img').attr('data-src') || parent.find('img').attr('data-lazy-src');
            }
            if (!img) img = '';
            if (img.startsWith('//')) img = 'https:' + img;

            let quality = parent.find('.quality, .badge').text().trim();
            if (!quality) quality = 'WEB-DL';

            let rating = parent.find('.imdb-rate, .rating').text().trim();
            if (!rating) rating = 'N/A';

            if (href.includes('cinesubz.') && (href.includes('/movies/') || href.includes('/tvshows/')) && title.length > 2) {
                title = title.replace(/\t|\n/g, '').trim();
                if (!results.some(r => r.link === href)) {
                    results.push({ title, image: img, quality, rating, link: href });
                }
            }
        });

        res.json({ status: true, creator: "@Imalsha", site: "cinesubz", page: Number(pageNum), results_count: results.length, data: results });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// 2. Search Endpoint
app.get('/api/v1/cinesubz/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ status: false, message: "Search term required" });

        const searchUrl = "https://cinesubz.co/?s=" + encodeURIComponent(query);
        const response = await axios.get(searchUrl, { headers: HEADERS, timeout: 10000 });
        const $ = cheerio.load(response.data);
        const results = [];

        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const parent = $(el).closest('article, .result-item, .item, div');
            
            let title = $(el).find('h2, h3, .title').text().trim();
            if (!title) title = $(el).attr('title') || '';
            if (!title) title = $(el).text().trim();

            let img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || $(el).find('img').attr('data-lazy-src');
            if (!img) {
                img = parent.find('img').attr('src') || parent.find('img').attr('data-src') || parent.find('img').attr('data-lazy-src');
            }
            if (!img) img = '';
            if (img.startsWith('//')) img = 'https:' + img;

            let quality = parent.find('.quality, .badge').text().trim();
            if (!quality) quality = 'WEB-DL';

            let rating = parent.find('.imdb-rate, .rating').text().trim();
            if (!rating) rating = 'N/A';

            if (href.includes('cinesubz.') && (href.includes('/movies/') || href.includes('/tvshows/')) && title.length > 2) {
                title = title.replace(/\t|\n/g, '').trim();
                if (!results.some(r => r.link === href)) {
                    results.push({ title, image: img, quality, rating, link: href });
                }
            }
        });

        res.json({ status: true, creator: "@Imalsha", site: "cinesubz", results_count: results.length, data: results });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// 3. Info & WordPress JSON Deep Inspection Endpoint
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    console.log(`\n==============================================`);
    console.log(`🔥 [WP-JSON DL] Processing Movie URL: ${movieUrl}`);

    try {
        // 1. Fetch WordPress REST API post data using slug
        const urlObj = new URL(movieUrl);
        const pathSegments = urlObj.pathname.split('/').filter(Boolean);
        const slug = pathSegments[pathSegments.length - 1];

        let wpLinks = [];
        try {
            const wpApiUrl = `https://cinesubz.net/wp-json/wp/v2/posts?slug=${slug}`;
            console.log(`🔍 Fetching WordPress REST API: ${wpApiUrl}`);
            const wpRes = await axios.get(wpApiUrl, { headers: HEADERS, timeout: 10000 });
            
            if (wpRes.data && Array.isArray(wpRes.data) && wpRes.data.length > 0) {
                const post = wpRes.data[0];
                console.log(`✨ Found WordPress Post ID: ${post.id}`);
                
                // Parse rendered HTML content inside WordPress post JSON
                const renderedHtml = post.content.rendered || '';
                const $wp = cheerio.load(renderedHtml);
                
                $wp('a').each((i, el) => {
                    const href = $wp(el).attr('href') || '';
                    const text = $wp(el).text().trim();
                    if (href && !href.startsWith('#')) {
                        wpLinks.push({ href, text });
                    }
                });
            }
        } catch (wpErr) {
            console.log(`⚠️ WP REST API note: ${wpErr.message}`);
        }

        // 2. Also scrape the standard movie page HTML as backup/complement
        const movieRes = await axios.get(movieUrl, { headers: HEADERS, timeout: 15000 });
        const $ = cheerio.load(movieRes.data);

        const title = $('meta[property="og:title"]').attr('content') || $('h1').text().trim() || 'Unknown';
        const image = $('meta[property="og:image"]').attr('content') || '';
        const quality = $('.quality').first().text().trim() || 'WEB-DL';
        const rating = $('span.rating, .imdb-rate').first().text().trim() || 'N/A';
        const director = $('span.director').text().trim() || 'N/A';

        let story = '';
        $('p').each((i, el) => {
            const txt = $(el).text().trim();
            if (txt.length > 30 && !txt.includes('උපසිරැසි') && !txt.includes('Download') && !story) {
                story = txt;
            }
        });

        const pageLinks = [];
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().trim();
            if (href) {
                pageLinks.push({ href, text });
            }
        });

        // Combine links from WP JSON and movie page HTML
        const allDiscoveredLinks = [...wpLinks, ...pageLinks];
        console.log(`📦 Total discovered links from WordPress & Page: ${allDiscoveredLinks.length}`);

        const downloads = [];

        allDiscoveredLinks.forEach(item => {
            const lLower = item.href.toLowerCase();
            const tUpper = item.text.toUpperCase();

            // Check if it's a direct server, csplayer link, or pixeldrain/telegram
            if (lLower.includes('drive.csplayer') || lLower.includes('/server') || lLower.includes('pixeldrain') || lLower.includes('ext=mp4') || lLower.includes('t.me') || lLower.includes('zt-links')) {
                let type = "Direct Server";
                if (lLower.includes('pixeldrain')) type = "PixelDrain";
                else if (lLower.includes('t.me')) type = "Telegram";
                else if (lLower.includes('csplayer') || lLower.includes('server')) type = "CSPlayer Direct";
                else if (lLower.includes('zt-links')) type = "Wrapper Link";

                const qMatch = item.text.match(/(2160p|4K|1080p|720p|480p)/i) || ['HD'];
                const qualityLabel = `${qMatch[0].toUpperCase()} [${type}]`;

                if (!downloads.some(d => d.link === item.href)) {
                    downloads.push({
                        quality: qualityLabel,
                        size: "N/A",
                        language: "English / Sinhala Sub",
                        link: item.href,
                        direct_link: item.href
                    });
                }
            }
        });

        console.log(`🎉 Successfully filtered ${downloads.length} download links!`);
        console.log(`==============================================\n`);

        res.json({
            status: true,
            creator: "@Imalsha",
            site: "cinesubz",
            url: movieUrl,
            data: {
                title,
                image,
                quality,
                rating,
                imdb: rating,
                director,
                language: "ENGLISH",
                genres: ["Action", "Adventure", "Sinhala Subtitles"],
                story: story || 'No description available',
                year: "2026",
                downloads: downloads.length > 0 ? downloads : [{ quality: "HD [Telegram]", size: "N/A", language: "English / Sinhala Sub", link: "https://t.me/CineSubzAdmin", direct_link: "https://t.me/CineSubzAdmin" }]
            }
        });

    } catch (err) {
        console.error(`❌ [SCRAPER ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`WP-JSON Direct Cinesubz API running on port ${PORT}`));
