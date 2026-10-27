const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
};

// Root Status Route
app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA CINESUBZ INDEPENDENT SCRAPER API is Live 🚀",
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
        const latestUrl = pageNum == 1 ? "https://cinesubz.net/" : `https://cinesubz.net/page/${pageNum}/`;
        
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

        const searchUrl = "https://cinesubz.net/?s=" + encodeURIComponent(query);
        const response = await axios.get(searchUrl, { headers: HEADERS, timeout: 10000 });
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

        res.json({ status: true, creator: "@Imalsha", site: "cinesubz", results_count: results.length, data: results });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// 3. Independent Info & Download Scraper Endpoint
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    console.log(`\n==============================================`);
    console.log(`🔍 [INDEPENDENT SCRAPER] Processing: ${movieUrl}`);

    try {
        // Step 1: Fetch main movie page HTML via Axios
        const movieRes = await axios.get(movieUrl, { headers: HEADERS, timeout: 15000 });
        const $ = cheerio.load(movieRes.data);

        const title = $('meta[property="og:title"]').attr('content') || $('h1').text().trim() || 'Unknown';
        const image = $('meta[property="og:image"]').attr('content') || '';
        const quality = $('.quality').first().text().trim() || 'WEB-DL';
        const rating = $('.imdb-rate').first().text().trim() || 'N/A';
        const director = $('span.director').text().trim() || 'N/A';

        let story = '';
        $('p').each((i, el) => {
            const txt = $(el).text().trim();
            if (txt.length > 30 && !txt.includes('උපසිරැසි') && !txt.includes('Download') && !story) {
                story = txt;
            }
        });

        // Find wrapper links (zt-links) from main page
        const wrapperLinks = [];
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            if (href.includes('zt-links') || href.includes('csplayer')) {
                wrapperLinks.push({ url: href, text: $(el).text() + ' ' + ($(el).parent().text() || '') });
            }
        });

        let year = "2026";
        const yearMatch = title.match(/(\d{4})/);
        if (yearMatch) year = yearMatch[1];

        const downloads = [];

        // Step 2: Loop through wrapper links and fetch their content directly via Axios
        for (const wrap of wrapperLinks) {
            try {
                const wrapRes = await axios.get(wrap.url, { headers: HEADERS, timeout: 10000 });
                const $wrap = cheerio.load(wrapRes.data);

                // Extract all direct download links found inside the wrapper page
                $wrap('a, button, [data-href], [data-url]').each((i, el) => {
                    let link = $wrap(el).attr('href') || $wrap(el).attr('data-href') || $wrap(el).attr('data-url') || '';
                    let text = $wrap(el).text().trim() + ' ' + wrap.text;

                    if (link && !link.startsWith('javascript:') && !link.startsWith('#')) {
                        const lLower = link.toLowerCase();
                        
                        const isPixelDrain = lLower.includes('pixeldrain');
                        const isSuperCloud = lLower.includes('supercloud') || lLower.includes('drive7');
                        const isTelegram = lLower.includes('t.me') || lLower.includes('telegram');
                        const isCsplayer = lLower.includes('drive.csplayer2.space');

                        if (isPixelDrain || isSuperCloud || isTelegram || isCsplayer) {
                            let type = "Direct Server";
                            if (isPixelDrain) type = "PixelDrain";
                            else if (isTelegram) type = "Telegram Bot";
                            else type = "Direct High-Speed Server";

                            const qMatch = link.match(/(2160p|4K|1080p|720p|480p)/i) || text.match(/(2160p|4K|1080p|720p|480p)/i) || title.match(/(2160p|4K|1080p|720p|480p)/i) || ['WEB-DL'];
                            const qualityName = qMatch[0].toUpperCase();
                            const qualityLabel = `${qualityName} [${type}]`;

                            if (!downloads.some(d => d.link === link)) {
                                downloads.push({ quality: qualityLabel, size: "N/A", language: "English", link: link });
                            }
                        }
                    }
                });
            } catch (e) {
                console.log(`⚠️ Wrapper fetch error: ${e.message}`);
            }
        }

        console.log(`🎉 Extracted ${downloads.length} download links independently!`);
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
                imdb: rating + " (N/A)",
                director,
                language: "ENGLISH",
                genres: ["Action", "Adventure", "English", "Sinhala Subtitles"],
                story: story || 'No description available',
                cast: [],
                gallery: [],
                trailer: "https://www.youtube.com/@cinesubz",
                year,
                duration: "N/A",
                tag: "English",
                directors: director,
                stars: "N/A",
                country: "Sri Lanka / Global",
                downloads
            }
        });

    } catch (err) {
        console.error(`❌ [SCRAPER ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Independent Cinesubz Scraper API running on port ${PORT}`));
