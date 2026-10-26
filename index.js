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
        message: "IMALSHA CINESUBZ DEEP SCRIPT SCANNER API is Live 🚀",
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

// 3. Deep Script Scanner Info & Download Endpoint
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    console.log(`\n==============================================`);
    console.log(`🔍 [DEEP SCRIPT SCANNER] Processing Movie URL: ${movieUrl}`);

    let browser;
    try {
        browser = await getBrowser();
        const page = await browser.newPage();

        await page.setUserAgent(HEADERS['User-Agent']);
        await page.setViewport({ width: 1280, height: 800 });

        await page.goto(movieUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await new Promise(r => setTimeout(r, 2000));

        // Extract metadata and scan ALL script contents & DOM for hidden file links
        const scannedData = await page.evaluate(() => {
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

            const allFoundUrls = new Set();

            // 1. Scan all <a>, <button> elements and data attributes
            document.querySelectorAll('a, button, [data-href], [data-url], [data-link]').forEach(el => {
                const href = el.href || el.getAttribute('data-href') || el.getAttribute('data-url') || el.getAttribute('data-link') || '';
                if (href) allFoundUrls.add(href);
            });

            // 2. Scan ALL Script tags for embedded URLs or JSON data
            document.querySelectorAll('script').forEach(sc => {
                const content = sc.textContent || sc.innerHTML || '';
                const matches = content.match(/https?:\/\/[^\s"'<>]+/gi);
                if (matches) {
                    matches.forEach(m => allFoundUrls.add(m));
                }
            });

            // 3. Scan entire page HTML body
            const bodyMatches = document.body.innerHTML.match(/https?:\/\/[^\s"'<>]+/gi) || [];
            bodyMatches.forEach(m => allFoundUrls.add(m));

            return { title, image, quality, rating, director, story: story || 'No description available', urls: Array.from(allFoundUrls) };
        });

        await browser.close();

        console.log(`🎬 Title: ${scaredData = scannedData.title}`);
        console.log(`🔗 Total raw URLs found via deep scan: ${scannedData.urls.length}`);

        let year = "2026";
        const yearMatch = scannedData.title.match(/(\d{4})/);
        if (yearMatch) year = yearMatch[1];

        const downloads = [];

        for (let targetUrl of scannedData.urls) {
            let hLower = targetUrl.toLowerCase();
            targetUrl = targetUrl.replace(/['"<>)]+$/, '');

            if (
                hLower.includes('facebook.com') ||
                hLower.includes('instagram.com') ||
                hLower.includes('cinesubzadmin') ||
                hLower.includes('google.com') ||
                hLower.includes('cloudflare') ||
                hLower.includes('jquery') ||
                hLower.includes('#') ||
                hLower.includes('javascript:')
            ) continue;

            const isPixelDrain = hLower.includes('pixeldrain.com/api/file/');
            const isSuperCloud = hLower.includes('supercloud') || hLower.includes('drive7.');
            const isTelegramBot = hLower.includes('t.me/') && targetUrl.includes('?start=');
            const isDirectFile = hLower.includes('drive.csplayer2.space') && (targetUrl.includes('?ext=') || targetUrl.includes('.mp4') || targetUrl.includes('.mkv'));

            if (isPixelDrain || isSuperCloud || isTelegramBot || isDirectFile) {
                let type = "Direct Server";
                if (isPixelDrain) type = "PixelDrain";
                else if (isTelegramBot) type = "Telegram Bot";
                else if (isSuperCloud || isDirectFile) type = "Direct High-Speed Server";

                const qMatch = targetUrl.match(/(2160p|4K|1080p|720p|480p)/i) || scannedData.title.match(/(2160p|4K|1080p|720p|480p)/i) || ['WEB-DL'];
                const qualityName = qMatch[0].toUpperCase();

                const qualityLabel = `${qualityName} [${type}]`;
                if (!downloads.some(d => d.link === targetUrl)) {
                    downloads.push({ quality: qualityLabel, size: "N/A", language: "English", link: targetUrl });
                }
            }
        }

        console.log(`🎉 Final Clean Extracted Links: ${downloads.length}`);
        console.log(`==============================================\n`);

        res.json({
            status: true,
            creator: "@Imalsha",
            site: "cinesubz",
            url: movieUrl,
            data: {
                title: scannedData.title,
                image: scannedData.image,
                quality: scannedData.quality,
                rating: scannedData.rating,
                imdb: scannedData.rating + " (N/A)",
                director: scannedData.director,
                language: "ENGLISH",
                genres: ["Action", "Adventure", "English", "Sinhala Subtitles"],
                story: scannedData.story,
                cast: [],
                gallery: [],
                trailer: "https://www.youtube.com/@cinesubz",
                year,
                duration: "N/A",
                tag: "English",
                directors: scannedData.director,
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

app.listen(PORT, () => console.log(`Cinesubz Deep Script Scanner API running on port ${PORT}`));
