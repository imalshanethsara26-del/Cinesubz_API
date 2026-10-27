const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
};

// Auto Find Chrome Executable on Render
function getChromeExecutablePath() {
    const possiblePaths = [
        '/opt/render/project/src/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64/chrome',
        '/opt/render/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64/chrome',
        process.env.PUPPETEER_EXECUTABLE_PATH
    ];

    for (const p of possiblePaths) {
        if (p && fs.existsSync(p)) return p;
    }

    const baseCache = '/opt/render/project/src/.cache/puppeteer/chrome';
    if (fs.existsSync(baseCache)) {
        try {
            const dirs = fs.readdirSync(baseCache);
            for (const dir of dirs) {
                const autoPath = path.join(baseCache, dir, 'chrome-linux64', 'chrome');
                if (fs.existsSync(autoPath)) return autoPath;
            }
        } catch (e) {}
    }
    return undefined;
}

// Root Status Route
app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA CINESUBZ JSON-INTERCEPTOR API is Live 🚀",
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

// Advanced Resolver: Network Interception to catch background JSON/API responses from csplayer
async function resolveZtLinkAndCaptureJson(page, ztUrl) {
    try {
        console.log(`\n🔍 [RESOLVER] Navigating to wrapper: ${ztUrl}`);
        
        let interceptedPayload = null;

        const responseListener = async (response) => {
            const reqUrl = response.url();
            const contentType = response.headers()['content-type'] || '';
            if (contentType.includes('application/json') || reqUrl.includes('api') || reqUrl.includes('json') || reqUrl.includes('get')) {
                try {
                    const json = await response.json();
                    if (json && (json.file_name || json.links || json.download || JSON.stringify(json).includes('mp4') || JSON.stringify(json).includes('server'))) {
                        interceptedPayload = json;
                        console.log(`🎯 [INTERCEPTED JSON]:`, reqUrl);
                    }
                } catch (e) {}
            }
        };

        page.on('response', responseListener);

        await page.goto(ztUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

        // Wait for timer to finish
        await new Promise(r => setTimeout(r, 3000));

        // Click "Go to Download Page"
        await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('a, button, div, span'));
            const target = elements.find(el => {
                const txt = (el.innerText || '').toUpperCase();
                return txt.includes('GO TO DOWNLOAD') || txt.includes('DOWNLOAD PAGE');
            });
            if (target) target.click();
        });

        try {
            await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 });
        } catch (e) {}

        // Wait for csplayer background fetches
        await new Promise(r => setTimeout(r, 3000));

        page.off('response', responseListener);

        if (interceptedPayload) {
            return { type: 'json', data: interceptedPayload };
        }

        // Fallback: extract direct links if JSON wasn't intercepted
        const realDirectLinks = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            return anchors.map(a => a.href).filter(h => h && (h.includes('/server') || h.includes('pixeldrain') || h.includes('ext=mp4')));
        });

        return { type: 'links', data: realDirectLinks };

    } catch (err) {
        console.error(`❌ [RESOLVER ERROR]: ${err.message}`);
        return { type: 'links', data: [ztUrl] };
    }
}

// 3. Info & Download Endpoint
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    console.log(`\n==============================================`);
    console.log(`🔥 [INFO DL] Processing Movie URL: ${movieUrl}`);

    let browser = null;
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

        const rawZtLinks = [];
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().trim();
            if (href.includes('zt-links')) {
                rawZtLinks.push({ href, text });
            }
        });

        console.log(`📦 Found ${rawZtLinks.length} wrapper links. Launching Puppeteer browser...`);

        const chromePath = getChromeExecutablePath();
        browser = await puppeteer.launch({
            headless: true,
            executablePath: chromePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

        const downloads = [];

        for (const item of rawZtLinks) {
            const result = await resolveZtLinkAndCaptureJson(page, item.href);
            
            if (result.type === 'json') {
                downloads.push({
                    quality: item.text || "HD [Direct Server]",
                    size: result.data.file_size || "N/A",
                    language: "English / Sinhala Sub",
                    raw_json: result.data,
                    link: result.data.download_url || result.data.url || item.href,
                    direct_link: result.data.download_url || result.data.url || item.href
                });
            } else if (result.type === 'links' && Array.isArray(result.data)) {
                result.data.forEach(link => {
                    const lLower = link.toLowerCase();
                    let type = "Direct Server";
                    if (lLower.includes('pixeldrain')) type = "PixelDrain";
                    else if (lLower.includes('t.me')) type = "Telegram";
                    else if (lLower.includes('supercloud')) type = "SuperCloud";

                    const qMatch = item.text.match(/(2160p|4K|1080p|720p|480p)/i) || ['HD'];
                    const qualityLabel = `${qMatch[0].toUpperCase()} [${type}]`;

                    if (!downloads.some(d => d.link === link)) {
                        downloads.push({
                            quality: qualityLabel,
                            size: "N/A",
                            language: "English / Sinhala Sub",
                            link: link,
                            direct_link: link
                        });
                    }
                });
            }
        }

        await browser.close();

        console.log(`🎉 Successfully processed downloads with network interception!`);
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
        if (browser) await browser.close();
        console.error(`❌ [SCRAPER ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`JSON Interceptor Cinesubz API running on port ${PORT}`));
