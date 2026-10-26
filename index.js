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
        message: "IMALSHA CINESUBZ REAL DL API is Live 🚀",
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

// 3. Direct Source Extraction Endpoint (Extracting Real Links from Main Cinesubz Movie Page)
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    console.log(`\n==============================================`);
    console.log(`🔍 [DIRECT SOURCE API] Processing Movie URL: ${movieUrl}`);

    let browser;
    try {
        browser = await getBrowser();
        const page = await browser.newPage();

        await page.setUserAgent(HEADERS['User-Agent']);
        await page.setViewport({ width: 1280, height: 800 });

        await page.goto(movieUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await new Promise(r => setTimeout(r, 2000));

        // Extract metadata and all embedded download links directly from the main Cinesubz movie page
        const scrapedData = await page.evaluate(() => {
            const title = document.querySelector('meta[property="og:title"]')?.content || document.querySelector('h1')?.innerText || 'Unknown';
            const image = document.querySelector('meta[property="og:image"]')?.content || '';
            const quality = document.querySelector('.quality')?.innerText || 'WEB-DL';
            const rating = document.querySelector('.imdb-rate, .rating-score')?.innerText || 'N/A';
            const director = document.querySelector('span.director, .director-name')?.innerText || 'N/A';

            let story = '';
            document.querySelectorAll('p').forEach(p => {
                const txt = p.innerText.trim();
                if (txt.length > 30 && !txt.includes('උපසිරැසි') && !txt.includes('Download') && !story) {
                    story = txt;
                }
            });

            // Gather all links present on the main Cinesubz movie page
            const rawLinks = [];
            document.querySelectorAll('a').forEach(a => {
                const href = a.href || '';
                const text = (a.innerText || a.textContent || '').trim();
                const parentText = (a.parentElement?.innerText || '').trim();
                const containerText = (a.closest('.download-section, .button-group, article, div')?.innerText || '').trim();
                
                if (href) {
                    rawLinks.push({ href, text, parentText, containerText });
                }
            });

            return { title, image, quality, rating, director, story: story || 'No description available', rawLinks };
        });

        await browser.close();

        console.log(`🎬 Title: ${scrapedData.title}`);
        console.log(`🔗 Total raw links found on main page: ${scrapedData.rawLinks.length}`);

        let year = "2026";
        const yearMatch = scrapedData.title.match(/(\d{4})/);
        if (yearMatch) year = yearMatch[1];

        const downloads = [];

        for (const item of scrapedData.rawLinks) {
            let targetUrl = item.href;
            let hLower = targetUrl.toLowerCase();
            let combinedText = (item.text + ' ' + item.parentText + ' ' + item.containerText).toLowerCase();

            // Filter out social/admin links
            if (hLower.includes('facebook') || hLower.includes('instagram') || hLower.includes('cinesubzadmin') || hLower.includes('#') || hLower.includes('javascript:')) {
                continue;
            }

            // Check if link points to PixelDrain, SuperCloud, or Telegram
            if (
                hLower.includes('pixeldrain.com') ||
                hLower.includes('supercloud') ||
                hLower.includes('t.me/') ||
                hLower.includes('telegram.me') ||
                hLower.includes('drive7.') ||
                hLower.includes('drive.') ||
                hLower.includes('kdrive') ||
                targetUrl.endsWith('.mp4') ||
                targetUrl.endsWith('.mkv')
            ) {
                let type = "Direct Server";
                if (hLower.includes('pixeldrain')) type = "PixelDrain";
                else if (hLower.includes('t.me/') || hLower.includes('telegram.me')) type = "Telegram Bot";
                else if (hLower.includes('supercloud') || hLower.includes('drive7.')) type = "Direct High-Speed Server";

                // Detect Quality (480p, 720p, 1080p, BluRay, etc.)
                const qMatch = combinedText.match(/(2160p|4K|1080p|720p|480p|bluray|web-dl|rip)/i);
                const qualityName = qMatch ? qMatch[0].toUpperCase() : "WEB-DL";

                // Detect File Size if present in text (e.g. 800 MB, 1.5 GB)
                const sizeMatch = combinedText.match(/(\d+(?:\.\d+)?\s*(?:mb|gb))/i);
                const size = sizeMatch ? sizeMatch[1].toUpperCase() : "N/A";

                const qualityLabel = `${qualityName} [${type}]`;
                if (!downloads.some(d => d.link === targetUrl)) {
                    downloads.push({ quality: qualityLabel, size, language: "English", link: targetUrl });
                }
            }
        }

        console.log(`🎉 Final Clean Download Links Extracted: ${downloads.length}`);
        console.log(`==============================================\n`);

        res.json({
            status: true,
            creator: "@Imalsha",
            site: "cinesubz",
            url: movieUrl,
            data: {
                title: scrapedData.title,
                image: scrapedData.image,
                quality: scrapedData.quality,
                rating: scrapedData.rating,
                imdb: scrapedData.rating + " (N/A)",
                director: scrapedData.director,
                language: "ENGLISH",
                genres: ["Action", "Adventure", "English", "Sinhala Subtitles"],
                story: scrapedData.story,
                cast: [],
                gallery: [],
                trailer: "https://www.youtube.com/@cinesubz",
                year,
                duration: "N/A",
                tag: "English",
                directors: scrapedData.director,
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

app.listen(PORT, () => console.log(`Cinesubz Real DL API running on port ${PORT}`));
