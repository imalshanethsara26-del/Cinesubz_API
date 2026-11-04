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
        message: "IMALSHA CINESUBZ LIGHTNING FAST API is Live 🚀",
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
            let title = $(el).find('h2, h3, .title').text().trim() || $(el).attr('title') || $(el).text().trim();
            let img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || parent.find('img').attr('src') || '';
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
            let title = $(el).find('h2, h3, .title').text().trim() || $(el).attr('title') || $(el).text().trim();
            let img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || parent.find('img').attr('src') || '';
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

// 3. Info & Download Endpoint (Fast Axios-Only Scraper)
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    console.log(`\n==============================================`);
    console.log(`⚡ [FAST AXIOS API] Processing: ${movieUrl}`);

    try {
        const movieRes = await axios.get(movieUrl, { headers: HEADERS, timeout: 30000 });
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

        const wrapperLinks = [];
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().trim();
            if (href.includes('zt-links') || href.includes('api') || href.includes('csplayer') || href.includes('space')) {
                wrapperLinks.push({ href, text });
            }
        });

        console.log(`📦 Found ${wrapperLinks.length} wrapper links. Fast scanning...`);

        const downloads = [];

        for (const wrap of wrapperLinks) {
            try {
                // Request the zt-links page directly using Axios with maxRedirects
                const ztRes = await axios.get(wrap.href, { 
                    headers: HEADERS, 
                    timeout: 15000,
                    maxRedirects: 5
                });

                const $zt = cheerio.load(ztRes.data);
                let foundLink = '';

                // 1. Check all anchor tags inside the zt-links page
                $zt('a').each((_, ztel) => {
                    const zh = $zt(ztel).attr('href') || '';
                    if (zh.includes('cloudflarestorage') || zh.includes('pixeldrain') || zh.includes('.mp4') || zh.includes('token=')) {
                        foundLink = zh;
                    }
                });

                // 2. Check if the final axios response URL is the direct file
                if (!foundLink && ztRes.request && ztRes.request.res && ztRes.request.res.responseUrl) {
                    const finalUrl = ztRes.request.res.responseUrl;
                    if (!finalUrl.includes('zt-links')) {
                        foundLink = finalUrl;
                    }
                }

                // 3. Scan script tags for hidden URLs
                if (!foundLink) {
                    const htmlContent = ztRes.data;
                    const match = htmlContent.match(/https?:\/\/[^\s"'<>]+(?:cloudflarestorage|pixeldrain|\.mp4|token=)[^\s"'<>]+/i);
                    if (match) {
                        foundLink = match[0];
                    }
                }

                if (foundLink) {
                    console.log(`✅ Found Direct Link: ${foundLink}`);
                    let qName = wrap.text.match(/720p/i) ? "720p" : wrap.text.match(/1080p/i) ? "1080p" : wrap.text.match(/480p/i) ? "480p" : "HD";
                    let typeLabel = foundLink.includes('pixeldrain') ? "PixelDrain" : "Cloudflare R2 Direct";

                    if (!downloads.some(d => d.link === foundLink)) {
                        downloads.push({
                            quality: `WEB-DL ${qName} [${typeLabel}]`,
                            size: "N/A",
                            language: "English",
                            link: foundLink
                        });
                    }
                }
            } catch (innerErr) {
                console.log(`⚠️ Wrapper error: ${innerErr.message}`);
            }
        }

        console.log(`🎉 Total extracted links: ${downloads.length}`);
        console.log(`==============================================\n`);

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
                cast: [],
                trailer: "https://www.youtube.com/@cinesubz",
                year: "2026",
                duration: "145 min",
                downloads: downloads.length > 0 ? downloads : [{ quality: "HD [Telegram]", size: "N/A", language: "English", link: "https://t.me/CineSubzAdmin" }]
            }
        });

    } catch (err) {
        console.error(`❌ [API ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Cinesubz Fast Axios API running on port ${PORT}`));
