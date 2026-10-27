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
        message: "IMALSHA CINESUBZ WP-JSON INSPECTOR API is Live 🚀",
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

// Helper: Try to fetch WordPress REST API JSON for the movie page
async function checkWordPressRestApi(movieUrl) {
    try {
        // Extract slug or post name from url, or query WP REST API search
        const urlObj = new URL(movieUrl);
        const pathSegments = urlObj.pathname.split('/').filter(Boolean);
        const slug = pathSegments[pathSegments.length - 1];

        const wpApiUrl = `https://cinesubz.net/wp-json/wp/v2/posts?slug=${slug}`;
        console.log(`🔍 [WP-JSON INSPECT] Fetching WordPress REST API: ${wpApiUrl}`);

        const res = await axios.get(wpApiUrl, { headers: HEADERS, timeout: 8000 });
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
            const post = res.data[0];
            console.log(`✨ Found WordPress Post ID: ${post.id}`);
            console.log(`📋 WP Post Meta/Content snippet:`, JSON.stringify(post.content.rendered).substring(0, 200));
            return post;
        }
    } catch (err) {
        console.log(`⚠️ WP-JSON fetch note: ${err.message}`);
    }
    return null;
}

// 3. Info & Download Endpoint
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    console.log(`\n==============================================`);
    console.log(`🔥 [INFO DL] Processing Movie URL: ${movieUrl}`);

    // Step A: Inspect WordPress REST API first
    const wpPostData = await checkWordPressRestApi(movieUrl);

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

        console.log(`📦 Found ${rawZtLinks.length} wrapper zt-links on movie page. Launching Puppeteer...`);

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
            console.log(`\n------------------------------------------`);
            console.log(`🔍 [RESOLVER] Navigating to wrapper: ${item.href}`);
            await page.goto(item.href, { waitUntil: 'domcontentloaded', timeout: 25000 });

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

            await new Promise(r => setTimeout(r, 2500));

            const playerUrl = page.url();
            console.log(`🌐 Landed on Player Page: ${playerUrl}`);

            // Extract all links on player page
            const playerLinks = await page.evaluate(() => {
                const anchors = Array.from(document.querySelectorAll('a'));
                return anchors.map(a => ({ href: a.href, text: (a.innerText || '').trim() })).filter(a => a.href && !a.href.startsWith('javascript:'));
            });

            console.log(`📦 Found ${playerLinks.length} links on player page.`);
            playerLinks.forEach(pl => {
                console.log(`   Link: ${pl.href} | Text: ${pl.text}`);
                const lLower = pl.href.toLowerCase();
                if (lLower.includes('/server') || lLower.includes('pixeldrain') || lLower.includes('ext=mp4') || lLower.includes('t.me')) {
                    let type = "Direct Server";
                    if (lLower.includes('pixeldrain')) type = "PixelDrain";
                    else if (lLower.includes('t.me')) type = "Telegram";
                    else if (lLower.includes('server')) type = "CSPlayer Direct";

                    const qMatch = item.text.match(/(2160p|4K|1080p|720p|480p)/i) || pl.text.match(/(2160p|4K|1080p|720p|480p)/i) || ['HD'];
                    const qualityLabel = `${qMatch[0].toUpperCase()} [${type}]`;

                    if (!downloads.some(d => d.link === pl.href)) {
                        downloads.push({
                            quality: qualityLabel,
                            size: "N/A",
                            language: "English / Sinhala Sub",
                            link: pl.href,
                            direct_link: pl.href
                        });
                    }
                }
            });
        }

        await browser.close();

        console.log(`\n🎉 Successfully extracted ${downloads.length} download links!`);
        console.log(`==============================================\n`);

        res.json({
            status: true,
            creator: "@Imalsha",
            site: "cinesubz",
            url: movieUrl,
            wp_rest_api: wpPostData ? { id: wpPostData.id, slug: wpPostData.slug } : null,
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

app.listen(PORT, () => console.log(`WP-JSON Inspector Cinesubz API running on port ${PORT}`));
