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

// Render Chrome Path Finder
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

// Root Route
app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA CINESUBZ ULTIMATE JSON-INTERCEPTOR API is Live 🚀",
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

// Advanced Interceptor: Captures background JSON API responses and full DOM data from csplayer
async function resolveCsPlayerCompleteJson(page, ztUrl) {
    try {
        console.log(`\n🔍 [RESOLVER] Opening Wrapper: ${ztUrl}`);
        
        let capturedApiResponse = null;

        const responseListener = async (response) => {
            const reqUrl = response.url();
            const contentType = response.headers()['content-type'] || '';
            if (contentType.includes('application/json') || reqUrl.includes('api') || reqUrl.includes('get') || reqUrl.includes('json')) {
                try {
                    const json = await response.json();
                    if (json && (json.file_name || json.file_size || json.download_url || JSON.stringify(json).includes('mp4') || JSON.stringify(json).includes('server'))) {
                        capturedApiResponse = json;
                        console.log(`🎯 [INTERCEPTED CSPLAYER API JSON]:`, reqUrl);
                    }
                } catch (e) {}
            }
        };

        page.on('response', responseListener);

        await page.goto(ztUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

        // Wait for timer
        await new Promise(r => setTimeout(r, 3500));

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

        // Wait for csplayer background fetches to complete
        await new Promise(r => setTimeout(r, 4000));

        page.off('response', responseListener);

        // Extract DOM data as well as backup
        const domData = await page.evaluate(() => {
            const bodyText = document.body.innerText || '';
            const lines = bodyText.split('\n').map(l => l.trim()).filter(Boolean);

            let detectedFileName = 'N/A';
            let detectedFileSize = 'N/A';

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes('file name') && lines[i + 1]) {
                    detectedFileName = lines[i + 1];
                }
                if (lines[i].toLowerCase().includes('file size') && lines[i + 1]) {
                    detectedFileSize = lines[i + 1];
                }
            }

            const anchors = Array.from(document.querySelectorAll('a, button'));
            const buttonsData = anchors.map(a => ({
                href: a.href || a.getAttribute('data-href') || '',
                text: (a.innerText || a.textContent || '').trim()
            })).filter(item => item.href && !item.href.startsWith('javascript:'));

            return {
                fileName: detectedFileName,
                fileSize: detectedFileSize,
                buttons: buttonsData
            };
        });

        return {
            apiJson: capturedApiResponse,
            domInfo: domData
        };

    } catch (err) {
        console.error(`❌ Error resolving ${ztUrl}: ${err.message}`);
        return { apiJson: null, domInfo: { fileName: 'N/A', fileSize: 'N/A', buttons: [] } };
    }
}

// 3. Main Info & Download Endpoint
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    console.log(`\n==============================================`);
    console.log(`🔥 [INFO DL] Processing Movie: ${movieUrl}`);

    let browser = null;
    try {
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

        const rawZtLinks = [];
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().trim();
            if (href.includes('zt-links')) {
                rawZtLinks.push({ href, text });
            }
        });

        console.log(`📦 Found ${rawZtLinks.length} wrapper links. Launching Puppeteer...`);

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
            const result = await resolveCsPlayerCompleteJson(page, item.href);
            
            // If API JSON was intercepted, include it
            if (result.apiJson) {
                downloads.push({
                    quality: item.text || "HD [API JSON]",
                    file_name: result.apiJson.file_name || result.domInfo.fileName,
                    size: result.apiJson.file_size || result.domInfo.fileSize,
                    language: "English / Sinhala Sub",
                    raw_json: result.apiJson,
                    link: result.apiJson.download_url || result.apiJson.url || item.href,
                    direct_link: result.apiJson.download_url || result.apiJson.url || item.href
                });
            }

            // Process DOM buttons and links found inside csplayer
            if (result.domInfo && result.domInfo.buttons.length > 0) {
                result.domInfo.buttons.forEach(btn => {
                    const lLower = btn.href.toLowerCase();
                    if (lLower.includes('drive.csplayer') || lLower.includes('/server') || lLower.includes('pixeldrain') || lLower.includes('ext=mp4') || lLower.includes('t.me')) {
                        let type = "Direct Server";
                        if (lLower.includes('pixeldrain')) type = "PixelDrain";
                        else if (lLower.includes('t.me')) type = "Telegram";
                        else if (lLower.includes('drive.csplayer') || lLower.includes('server')) type = "CSPlayer Direct";

                        const qMatch = item.text.match(/(2160p|4K|1080p|720p|480p)/i) || btn.text.match(/(2160p|4K|1080p|720p|480p)/i) || ['HD'];
                        const qualityLabel = `${qMatch[0].toUpperCase()} [${type}]`;

                        if (!downloads.some(d => d.link === btn.href)) {
                            downloads.push({
                                quality: qualityLabel,
                                file_name: result.domInfo.fileName,
                                size: result.domInfo.fileSize,
                                language: "English / Sinhala Sub",
                                button_text: btn.text,
                                link: btn.href,
                                direct_link: btn.href
                            });
                        }
                    }
                });
            }
        }

        await browser.close();

        console.log(`🎉 Successfully extracted data with interception and DOM parsing!`);
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
                downloads: downloads.length > 0 ? downloads : [{ quality: "HD [Telegram]", file_name: "N/A", size: "N/A", language: "English / Sinhala Sub", link: "https://t.me/CineSubzAdmin", direct_link: "https://t.me/CineSubzAdmin" }]
            }
        });

    } catch (err) {
        if (browser) await browser.close();
        console.error(`❌ [SCRAPER ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Cinesubz Ultimate Scraper API running on port ${PORT}`));
