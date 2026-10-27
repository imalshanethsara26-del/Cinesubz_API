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
app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA CINESUBZ TRACING API is Live 🚀",
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

// 3. Deep Tracing Info & Download Endpoint with Detailed Terminal Logs
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    console.log(`\n==============================================`);
    console.log(`🔍 [TRACING SCRAPER] Processing Movie URL: ${movieUrl}`);

    try {
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

        const rawLinks = [];
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().trim();
            if (href.includes('zt-links') || href.includes('csplayer') || href.includes('pixeldrain')) {
                rawLinks.push({ href, text });
            }
        });

        console.log(`📦 Found ${rawLinks.length} raw wrapper links on movie page.`);

        const downloads = [];

        for (const item of rawLinks) {
            console.log(`\n------------------------------------------`);
            console.log(`➡️ Checking Wrapper/Link: ${item.href} (${item.text})`);
            
            try {
                const wrapRes = await axios.get(item.href, { 
                    headers: HEADERS, 
                    timeout: 8000,
                    maxRedirects: 5 
                });
                
                const finalHtml = wrapRes.data;
                const $w = cheerio.load(finalHtml);

                console.log(`📥 Fetched Wrapper Status: 200. Scanning HTML for iframes or buttons...`);

                // Check for iframe sources inside wrapper
                let iframeSrc = $w('iframe').attr('src') || '';
                if (iframeSrc) {
                    console.log(`📺 Found Iframe inside wrapper: ${iframeSrc}`);
                    try {
                        const iframeRes = await axios.get(iframeSrc, { headers: HEADERS, timeout: 6000 });
                        const $i = cheerio.load(iframeRes.data);
                        
                        $i('a, button, [data-href], [data-url]').each((subI, subEl) => {
                            let subLink = $i(subEl).attr('href') || $i(subEl).attr('data-href') || $i(subEl).attr('data-url') || '';
                            let subText = $i(subEl).text().trim();
                            
                            if (subLink && !subLink.startsWith('javascript:') && !subLink.startsWith('#')) {
                                console.log(`   ✨ [Iframe Link Found]: ${subLink} | Text: ${subText}`);
                                const lLower = subLink.toLowerCase();
                                let type = "Direct Server";
                                if (lLower.includes('pixeldrain')) type = "PixelDrain";
                                else if (lLower.includes('t.me')) type = "Telegram";
                                else if (lLower.includes('supercloud')) type = "SuperCloud";

                                if (!downloads.some(d => d.link === subLink)) {
                                    downloads.push({
                                        quality: `HD [${type}]`,
                                        size: "N/A",
                                        language: "English / Sinhala Sub",
                                        link: subLink,
                                        direct_link: subLink
                                    });
                                }
                            }
                        });
                    } catch (errI) {
                        console.log(`⚠️ Iframe fetch error: ${errI.message}`);
                    }
                }

                // Also scan regular links in wrapper page
                $w('a, button, [data-href], [data-url]').each((j, subEl) => {
                    let dLink = $w(subEl).attr('href') || $w(subEl).attr('data-href') || $w(subEl).attr('data-url') || '';
                    let dText = $w(subEl).text().trim();

                    if (dLink && !dLink.startsWith('javascript:') && !dLink.startsWith('#')) {
                        const lLower = dLink.toLowerCase();
                        if (lLower.includes('pixeldrain') || lLower.includes('supercloud') || lLower.includes('t.me') || lLower.includes('csplayer') || lLower.includes('drive')) {
                            console.log(`   ✨ [Wrapper Link Found]: ${dLink} | Text: ${dText}`);
                            
                            let type = "Direct Server";
                            if (lLower.includes('pixeldrain')) type = "PixelDrain";
                            else if (lLower.includes('t.me')) type = "Telegram";
                            else if (lLower.includes('supercloud')) type = "SuperCloud";

                            if (!downloads.some(d => d.link === dLink)) {
                                downloads.push({
                                    quality: `HD [${type}]`,
                                    size: "N/A",
                                    language: "English / Sinhala Sub",
                                    link: dLink,
                                    direct_link: dLink
                                });
                            }
                        }
                    }
                });

            } catch (e) {
                console.log(`❌ Wrapper fetch/resolve error for (${item.href}): ${e.message}`);
            }
        }

        console.log(`\n🎉 Total extracted download links: ${downloads.length}`);
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
                downloads: downloads.length > 0 ? downloads : [{ quality: "HD [Telegram]", size: "N/A", language: "English / Sinhala Sub", link: "https://t.me/CineSubzMoviesOfficial", direct_link: "https://t.me/CineSubzMoviesOfficial" }]
            }
        });

    } catch (err) {
        console.error(`❌ [SCRAPER ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Tracing Cinesubz Scraper API running on port ${PORT}`));
