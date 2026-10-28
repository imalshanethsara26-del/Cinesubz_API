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

// Root Route
app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA CINESUBZ ULTIMATE API is Live 🚀",
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
        
        const response = await axios.get(latestUrl, { headers: HEADERS, timeout: 30000 });
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

            let quality = parent.find('.quality, .badge').text().trim() || 'WEB-DL';
            let rating = parent.find('.imdb-rate, .rating').text().trim() || 'N/A';

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
        const response = await axios.get(searchUrl, { headers: HEADERS, timeout: 30000 });
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

            let quality = parent.find('.quality, .badge').text().trim() || 'WEB-DL';
            let rating = parent.find('.imdb-rate, .rating').text().trim() || 'N/A';

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

// 3. Info & Download Endpoint (Direct ZT-Links & External Server Scraping)
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    res.setTimeout(60000, () => {
        if (!res.headersSent) {
            res.status(504).json({ status: false, error: "Gateway Timeout" });
        }
    });

    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    console.log(`\n==============================================`);
    console.log(`🔥 [DIRECT SCRAPE API] Processing Movie: ${movieUrl}`);

    try {
        const movieRes = await axios.get(movieUrl, { headers: HEADERS, timeout: 45000 });
        const $ = cheerio.load(movieRes.data);

        const title = $('meta[property="og:title"]').attr('content') || $('h1').text().trim() || 'Unknown';
        const image = $('meta[property="og:image"]').attr('content') || '';
        const quality = $('.quality').first().text().trim() || 'WEB-DL';
        const rating = $('span.rating, .imdb-rate').first().text().trim() || 'N/A';
        const director = $('span.director').text().trim() || 'N/A';

        let story = '';
        $('p').each((i, el) => {
            const txt = $(el).text().trim();
            if (txt.length > 50 && !txt.includes('උපසිරැසි') && !txt.includes('Download') && !story) {
                story = txt;
            }
        });

        const genres = [];
        $('.genres a, .sgeneros a, .cat-links a').each((i, el) => {
            genres.push($(el).text().trim());
        });

        const cast = [];
        $('.cast-item, .person, .actor').each((i, el) => {
            const name = $(el).find('.name, h4').text().trim();
            const role = $(el).find('.role, .character').text().trim();
            const img = $(el).find('img').attr('src') || '';
            if (name) cast.push({ name, role: role || 'Actor', image: img });
        });

        const gallery = [];
        $('.gallery img, .screenshots img, .slider img').each((i, el) => {
            const src = $(el).attr('src') || $(el).attr('data-src');
            if (src) gallery.push(src);
        });

        const downloads = [];
        const rawZtLinks = [];

        // Collect all zt-links or direct download anchors from the main movie page
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().trim();
            if (href.includes('zt-links') || href.includes('pixeldrain.com') || href.includes('t.me/')) {
                rawZtLinks.push({ href, text });
            }
        });

        console.log(`📦 Found ${rawZtLinks.length} wrapper/download links. Deep scanning...`);

        for (const item of rawZtLinks) {
            try {
                let qName = "HD";
                if (item.text.match(/480p/i)) qName = "480p";
                else if (item.text.match(/720p/i)) qName = "720p";
                else if (item.text.match(/1080p/i)) qName = "1080p";
                else if (item.text.match(/2160p|4k/i)) qName = "2160p";

                if (item.href.includes('pixeldrain.com') || item.href.includes('t.me/')) {
                    let typeLabel = item.href.includes('pixeldrain') ? "PixelDrain" : "Telegram Bot";
                    downloads.push({
                        quality: `WEB-DL ${qName} [${typeLabel}]`,
                        size: "N/A",
                        language: "English",
                        link: item.href
                    });
                } else if (item.href.includes('zt-links')) {
                    // Visit zt-links page to see what external links are hidden inside
                    const ztRes = await axios.get(item.href, { headers: HEADERS, timeout: 30000 });
                    const $zt = cheerio.load(ztRes.data);

                    $zt('a').each((_, ztel) => {
                        const zh = $zt(ztel).attr('href') || '';
                        const ztxt = $zt(ztel).text().trim();

                        if (zh.includes('supercloud') || zh.includes('pixeldrain') || zh.includes('.mp4') || zh.includes('token=')) {
                            let typeLabel = "Direct High-Speed Server";
                            if (zh.includes('pixeldrain')) typeLabel = "PixelDrain";
                            
                            if (!downloads.some(d => d.link === zh)) {
                                downloads.push({
                                    quality: `WEB-DL ${qName} [${typeLabel}]`,
                                    size: "N/A",
                                    language: "English",
                                    link: zh
                                });
                            }
                        }
                    });
                }
            } catch (innerErr) {
                console.log(`⚠️ Scan error: ${innerErr.message}`);
            }
        }

        console.log(`🎉 Successfully extracted ${downloads.length} links directly!`);
        console.log(`==============================================\n`);

        if (!res.headersSent) {
            res.json({
                status: true,
                creator: "@Imalsha",
                site: "cinesubz",
                url: movieUrl,
                data: {
                    title,
                    image: image.trim(),
                    quality,
                    rating: rating || '8.0',
                    imdb: rating ? `${rating} (IMDb)` : 'N/A',
                    director,
                    language: "ENGLISH",
                    genres: genres.length > 0 ? genres : ["Action", "Adventure", "Sinhala Subtitles"],
                    story: story || 'No description available',
                    cast,
                    gallery,
                    trailer: "https://www.youtube.com/@cinesubz",
                    year: "2026",
                    duration: "145 min",
                    downloads: downloads.length > 0 ? downloads : [{ quality: "HD [Telegram]", size: "N/A", language: "English", link: "https://t.me/CineSubzAdmin" }]
                }
            });
        }

    } catch (err) {
        console.error(`❌ [API ERROR]: ${err.message}`);
        if (!res.headersSent) {
            res.status(500).json({ status: false, error: err.message });
        }
    }
});

app.listen(PORT, () => console.log(`Lightning Fast Cinesubz API running on port ${PORT}`));
