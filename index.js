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
        message: "IMALSHA CINESUBZ BOT-READY API is Live 🚀",
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

// Advanced Resolver: Clicks "Direct Download" inside csplayer to get real final link
async function resolveZtLinkAndClickDownload(page, ztUrl) {
    try {
        console.log(`\n🔍 [RESOLVER] Navigating to wrapper: ${ztUrl}`);
        await page.goto(ztUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

        // Step 1: Click "Go to Download Page" on zt-links page
        for (let attempt = 1; attempt <= 3; attempt++) {
            await new Promise(r => setTimeout(r, 1200));
            const clicked = await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('a, button, div.btn'));
                const target = btns.find(b => {
                    const text = (b.innerText || '').toUpperCase();
                    return text.includes('GO TO DOWNLOAD') || text.includes('DOWNLOAD PAGE') || text.includes('CLICK HERE');
                });
                if (target) { target.click(); return true; }
                return false;
            });
            if (clicked) break;
        }

        try {
            await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 6000 });
        } catch (e) {}

        console.log(`🌐 Landed on Player Page: ${page.url()}`);

        // Step 2: On csplayer page, find and click "Direct Download (New)" or "Direct Download 1"
        for (let attempt = 1; attempt <= 3; attempt++) {
            await new Promise(r => setTimeout(r, 1500));

            const clickedDownloadBtn = await page.evaluate(() => {
                const anchors = Array.from(document.querySelectorAll('a, button, div'));
                const dlBtn = anchors.find(a => {
                    const txt = (a.innerText || '').toUpperCase();
                    return txt.includes('DIRECT DOWNLOAD') || txt.includes('DOWNLOAD (NEW)');
                });
                if (dlBtn) {
                    dlBtn.click();
                    return true;
                }
                return false;
            });

            if (clickedDownloadBtn) {
                console.log(`✨ Clicked Direct Download button on player page!`);
                break;
            }
        }

        // Wait a moment for redirect or new link generation
        await new Promise(r => setTimeout(r, 2000));

        let finalDirectUrl = page.url();
        
        // If page didn't redirect, check if any direct anchor appeared
        const extractedHref = await page.evaluate(() => {
            const downloadAnchor = document.querySelector('a[href*="server"], a[href*="dl."], a[href*="pixeldrain"], a[href*="storage"]');
            return downloadAnchor ? downloadAnchor.href : null;
        });

        if (extractedHref && !extractedHref.includes('csplayer2.space')) {
            finalDirectUrl = extractedHref;
        }

        console.log(`✨ [FINAL REAL LINK]: ${finalDirectUrl}`);
        return finalDirectUrl;

    } catch (err) {
        console.error(`❌ [RESOLVER ERROR]: ${err.message}`);
        return ztUrl;
    }
}

// 3. Info & Download Endpoint with Deep Click Resolution
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
            const realDownloadLink = await resolveZtLinkAndClickDownload(page, item.href);
            
            const lLower = realDownloadLink.toLowerCase();
            let type = "Direct Server";
            if (lLower.includes('pixeldrain')) type = "PixelDrain";
            else if (lLower.includes('t.me')) type = "Telegram";
            else if (lLower.includes('supercloud')) type = "SuperCloud";

            const qMatch = item.text.match(/(2160p|4K|1080p|720p|480p)/i) || ['HD'];
            const qualityLabel = `${qMatch[0].toUpperCase()} [${type}]`;

            if (!downloads.some(d => d.link === realDownloadLink)) {
                downloads.push({
                    quality: qualityLabel,
                    size: "N/A",
                    language: "English / Sinhala Sub",
                    link: realDownloadLink,
                    direct_link: realDownloadLink
                });
            }
        }

        await browser.close();

        console.log(`🎉 Successfully extracted ${downloads.length} real direct download links for bot!`);
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

app.listen(PORT, () => console.log(`Bot-Ready Cinesubz API running on port ${PORT}`));
