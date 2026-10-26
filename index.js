const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
};

async function getBrowser() {
    return await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote',
            '--single-process'
        ]
    });
}

// Root Status Route
app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA CINESUBZ DEBUG TRACE API is Live 🚀",
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

// 3. Debug Trace Info & Download Endpoint (Full Network Logging)
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    console.log(`\n==============================================`);
    console.log(`🔍 [DEBUG TRACE API] Processing Movie URL: ${movieUrl}`);

    let browser;
    try {
        browser = await getBrowser();
        const page = await browser.newPage();

        await page.setUserAgent(HEADERS['User-Agent']);
        await page.setViewport({ width: 1280, height: 800 });

        await page.goto(movieUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await new Promise(r => setTimeout(r, 1500));

        const pageData = await page.evaluate(() => {
            const title = document.querySelector('meta[property="og:title"]')?.content || document.querySelector('h1')?.innerText || 'Unknown';
            const image = document.querySelector('meta[property="og:image"]')?.content || '';
            const quality = document.querySelector('.quality')?.innerText || 'WEB-DL';
            const rating = document.querySelector('.imdb-rate')?.innerText || 'N/A';
            const director = document.querySelector('span.director')?.innerText || 'N/A';

            let story = '';
            document.querySelectorAll('p').forEach(p => {
                const txt = p.innerText.trim();
                if (txt.length > 30 && !txt.includes('උපසිරැසි') && !txt.includes('Download') && !story) {
                    story = txt;
                }
            });

            const initialLinks = [];
            document.querySelectorAll('a').forEach(a => {
                const href = a.href || '';
                const hLower = href.toLowerCase();
                if (hLower.includes('csplayer') || hLower.includes('zt-links') || hLower.includes('space')) {
                    initialLinks.push({ url: href, text: a.innerText + ' ' + (a.parentElement?.innerText || '') });
                }
            });

            return { title, image, quality, rating, director, story: story || 'No description available', initialLinks };
        });

        console.log(`🎬 Title: ${pageData.title}`);
        console.log(`🔗 Found ${pageData.initialLinks.length} wrapper link(s). Starting network trace...`);

        let year = "2026";
        const yearMatch = pageData.title.match(/(\d{4})/);
        if (yearMatch) year = yearMatch[1];

        const downloads = [];
        const capturedUrls = new Set();

        for (const wrap of pageData.initialLinks) {
            let subPage;
            try {
                subPage = await browser.newPage();
                await subPage.setUserAgent(HEADERS['User-Agent']);

                // 🕵️‍♂️ FULL NETWORK TRACE LOGGING
                subPage.on('request', req => {
                    console.log(`🌐 [OUTGOING REQ]: ${req.url()}`);
                });

                subPage.on('response', async res => {
                    const resUrl = res.url();
                    const ct = res.headers()['content-type'] || '';
                    console.log(`📥 [INCOMING RES]: ${resUrl} [Type: ${ct}]`);
                    
                    // Capture any URL found in responses
                    capturedUrls.add(resUrl);

                    if (ct.includes('json') || resUrl.includes('api') || resUrl.includes('get') || resUrl.includes('file')) {
                        try {
                            const json = await res.json();
                            console.log(`📦 [JSON BODY from ${resUrl}]:`, JSON.stringify(json, null, 2));
                            
                            // Extract any URL strings inside JSON
                            JSON.stringify(json, (k, v) => {
                                if (typeof v === 'string' && v.startsWith('http')) {
                                    capturedUrls.add(v);
                                }
                                return v;
                            });
                        } catch (e) {}
                    }
                });

                await subPage.goto(wrap.url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
                
                // Wait for loader
                await new Promise(r => setTimeout(r, 4500));

                // Click buttons to trigger hidden requests
                await subPage.evaluate(() => {
                    document.querySelectorAll('a, button').forEach(el => {
                        const txt = (el.innerText || '').toLowerCase();
                        if (txt.includes('direct download') || txt.includes('telegram')) {
                            el.click();
                        }
                    });
                });

                await new Promise(r => setTimeout(r, 3000));

                // Grab all DOM hrefs
                const domHrefs = await subPage.evaluate(() => {
                    const arr = [];
                    document.querySelectorAll('a, [data-href], [data-url]').forEach(el => {
                        const h = el.href || el.getAttribute('data-href') || el.getAttribute('data-url');
                        if (h) arr.push(h);
                    });
                    return arr;
                });
                domHrefs.forEach(h => capturedUrls.add(h));

                await subPage.close();

            } catch (subErr) {
                if (subPage) await subPage.close();
            }
        }

        // Filter and categorize captured URLs
        for (let targetUrl of capturedUrls) {
            let hLower = targetUrl.toLowerCase();
            targetUrl = targetUrl.replace(/['"<>)]+$/, '');

            const isPixelDrain = hLower.includes('pixeldrain.com/api/file/');
            const isSuperCloud = hLower.includes('supercloud') || hLower.includes('drive7.');
            const isTelegramBot = hLower.includes('t.me/') && targetUrl.includes('?start=');
            const isDirectFile = hLower.includes('drive.csplayer2.space') && (targetUrl.includes('?ext=') || targetUrl.includes('.mp4') || targetUrl.includes('.mkv'));

            if (isPixelDrain || isSuperCloud || isTelegramBot || isDirectFile) {
                let type = "Direct Server";
                if (isPixelDrain) type = "PixelDrain";
                else if (isTelegramBot) type = "Telegram Bot";
                else if (isSuperCloud || isDirectFile) type = "Direct High-Speed Server";

                const qMatch = targetUrl.match(/(2160p|4K|1080p|720p|480p)/i) || pageData.title.match(/(2160p|4K|1080p|720p|480p)/i) || ['WEB-DL'];
                const qualityName = qMatch[0].toUpperCase();

                const qualityLabel = `${qualityName} [${type}]`;
                if (!downloads.some(d => d.link === targetUrl)) {
                    downloads.push({ quality: qualityLabel, size: "N/A", language: "English", link: targetUrl });
                }
            }
        }

        await browser.close();

        console.log(`🎉 Total Traced Download Links: ${downloads.length}`);
        console.log(`==============================================\n`);

        res.json({
            status: true,
            creator: "@Imalsha",
            site: "cinesubz",
            url: movieUrl,
            data: {
                title: pageData.title,
                image: pageData.image,
                quality: pageData.quality,
                rating: pageData.rating,
                imdb: pageData.rating + " (N/A)",
                director: pageData.director,
                language: "ENGLISH",
                genres: ["Action", "Adventure", "English", "Sinhala Subtitles"],
                story: pageData.story,
                cast: [],
                gallery: [],
                trailer: "https://www.youtube.com/@cinesubz",
                year,
                duration: "N/A",
                tag: "English",
                directors: pageData.director,
                stars: "N/A",
                country: "Sri Lanka / Global",
                downloads
            }
        });

    } catch (err) {
        console.error(`❌ [CRITICAL ERROR]: ${err.message}`);
        if (browser) await browser.close();
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Cinesubz Debug Trace API running on port ${PORT}`));
