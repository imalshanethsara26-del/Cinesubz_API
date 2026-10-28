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

// 3. Info & Download Endpoint (Final Mapping using apiData.redirect)
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    res.setTimeout(60000, () => {
        if (!res.headersSent) {
            res.status(504).json({ status: false, error: "Gateway Timeout" });
        }
    });

    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    console.log(`\n==============================================`);
    console.log(`🔥 [FAST API DL] Processing Movie: ${movieUrl}`);

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
            if (txt.length > 30 && !txt.includes('උපසිරැසි') && !txt.includes('Download') && !story) {
                story = txt;
            }
        });

        const rawZtLinks = [];
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().trim();
            if (href.includes('zt-links')) {
                rawZtLinks.push({ href, text });
            }
        });

        console.log(`📦 Found ${rawZtLinks.length} wrapper links. Resolving via direct API...`);

        const downloads = [];

        for (const item of rawZtLinks) {
            try {
                const ztRes = await axios.get(item.href, { headers: HEADERS, timeout: 45000 });
                const $zt = cheerio.load(ztRes.data);

                let serverLink = '';
                $zt('a').each((i, el) => {
                    const href = $zt(el).attr('href') || '';
                    if (href.includes('drive.csplayer') || href.includes('/server')) {
                        serverLink = href;
                    }
                });

                if (serverLink) {
                    const parsedUrl = new URL(serverLink);
                    const apiUrl = `https://drive.csplayer2.space/api/download-data${parsedUrl.pathname}${parsedUrl.search}`;
                    console.log(`🔍 Fetching CSPlayer API: ${apiUrl}`);

                    const apiRes = await axios.get(apiUrl, { headers: HEADERS, timeout: 45000 });
                    const apiData = apiRes.data;

                    if (apiData && apiData.redirect) {
                        let finalDownloadLink = apiData.redirect;
                        if (finalDownloadLink.startsWith('/')) {
                            finalDownloadLink = `https://drive.csplayer2.space${finalDownloadLink}`;
                        }

                        // Extract file name from redirect path
                        let fileName = 'N/A';
                        try {
                            const urlParts = finalDownloadLink.split('/');
                            const lastPart = urlParts[urlParts.length - 1].split('?')[0];
                            fileName = decodeURIComponent(lastPart);
                        } catch (e) {}

                        const qMatch = item.text.match(/(2160p|4K|1080p|720p|480p)/i) || ['HD'];
                        downloads.push({
                            quality: `${qMatch[0].toUpperCase()} [CSPlayer Direct]`,
                            file_name: fileName,
                            size: "N/A",
                            language: "English / Sinhala Sub",
                            link: finalDownloadLink,
                            direct_link: finalDownloadLink
                        });
                    }
                }
            } catch (innerErr) {
                console.log(`⚠️ Error resolving zt-link ${item.href}: ${innerErr.message}`);
            }
        }

        console.log(`🎉 Successfully fetched ${downloads.length} direct links with file info!`);
        console.log(`==============================================\n`);

        if (!res.headersSent) {
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
                    downloads: downloads.length > 0 ? downloads : [{ quality: "HD [Telegram]", file_name: "N/A", size: "N/A", language: "English / Sinhala Sub", link: "https://t.me/CineSubzAdmin", direct_link: "https://t.me/CineSubzAdmin" }]
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
