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
        message: "IMALSHA CINESUBZ ULTIMATE DL API is Live 🚀",
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

// 3. Ultimate Multi-Layered Info & Download Endpoint
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    console.log(`\n==============================================`);
    console.log(`🔍 [ULTIMATE API] Processing Movie URL: ${movieUrl}`);

    let browser;
    try {
        browser = await getBrowser();
        const page = await browser.newPage();

        await page.setUserAgent(HEADERS['User-Agent']);
        await page.setViewport({ width: 1280, height: 800 });

        await page.goto(movieUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await new Promise(r => setTimeout(r, 1500));

        // Scrape main movie metadata and wrapper/direct links
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
                const txt = a.innerText || '';

                if (!hLower.includes('facebook') && !hLower.includes('instagram') && !hLower.includes('#') && !hLower.includes('javascript:')) {
                    initialLinks.push({ url: href, text: txt + ' ' + (a.parentElement?.innerText || '') });
                }
            });

            return { title, image, quality, rating, director, story: story || 'No description available', initialLinks };
        });

        console.log(`🎬 Title: ${pageData.title}`);
        console.log(`🔗 Total links found on main page: ${pageData.initialLinks.length}`);

        let year = "2026";
        const yearMatch = pageData.title.match(/(\d{4})/);
        if (yearMatch) year = yearMatch[1];

        const downloads = [];
        const capturedUrls = new Set();

        // Process links found directly on the main page first
        for (const item of pageData.initialLinks) {
            capturedUrls.add(item.url);
        }

        // Now deep dive into wrapper pages (like csplayer, zt-links, etc.) using Network Interception & DOM
        const wrapperLinks = pageData.initialLinks.filter(l => l.url.toLowerCase().includes('csplayer') || l.url.toLowerCase().includes('zt-links') || l.url.toLowerCase().includes('space'));

        for (const wrap of wrapperLinks) {
            let subPage;
            try {
                subPage = await browser.newPage();
                await subPage.setUserAgent(HEADERS['User-Agent']);

                // 🕵️‍♂️ Network Interception: Capture any background JSON/XHR/Fetch responses
                subPage.on('response', async (response) => {
                    try {
                        const rUrl = response.url();
                        const ct = response.headers()['content-type'] || '';
                        if (ct.includes('json') || rUrl.includes('api') || rUrl.includes('get') || rUrl.includes('file')) {
                            const json = await response.json().catch(() => null);
                            if (json) {
                                JSON.stringify(json, (key, value) => {
                                    if (typeof value === 'string' && value.startsWith('http')) {
                                        capturedUrls.add(value);
                                    }
                                    return value;
                                });
                            }
                        }
                    } catch (e) {}
                });

                await subPage.goto(wrap.url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
                
                // Wait for loader & JS execution
                await new Promise(r => setTimeout(r, 4000));

                // Extract all DOM hrefs, data-attributes, and script contents
                const extraLinks = await subPage.evaluate(() => {
                    let fileSize = 'N/A';
                    const allText = document.body.innerText || '';
                    const matchSize = allText.match(/File Size:\s*([^\n]+)/i);
                    if (matchSize && matchSize[1]) {
                        fileSize = matchSize[1].trim();
                    }

                    const found = [];
                    document.querySelectorAll('a, button, [data-href], [data-url], [onclick]').forEach(el => {
                        const href = el.href || el.getAttribute('href') || el.getAttribute('data-href') || el.getAttribute('data-url') || '';
                        const onclick = el.getAttribute('onclick') || '';
                        if (href) found.push(href);
                        if (onclick) {
                            const m = onclick.match(/(https?:\/\/[^\s'"]+)/);
                            if (m) found.push(m[1]);
                        }
                    });

                    // Scan script tags
                    document.querySelectorAll('script').forEach(sc => {
                        const content = sc.textContent || sc.innerHTML || '';
                        const matches = content.match(/https?:\/\/[^\s"'<>]+/gi);
                        if (matches) {
                            matches.forEach(m => found.push(m));
                        }
                    });

                    // Scan full HTML body
                    const bodyMatches = document.body.innerHTML.match(/https?:\/\/[^\s"'<>]+/gi) || [];
                    bodyMatches.forEach(m => found.push(m));

                    return { fileSize, found };
                });

                await subPage.close();

                extraLinks.found.forEach(u => capturedUrls.add(u));

            } catch (subErr) {
                if (subPage) await subPage.close();
            }
        }

        // Filter and clean final download links
        for (let targetUrl of capturedUrls) {
            let hLower = targetUrl.toLowerCase();
            targetUrl = targetUrl.replace(/['"<>)]+$/, '');

            if (
                hLower.includes('cinesubzadmin') ||
                hLower.includes('facebook.com') ||
                hLower.includes('instagram.com') ||
                hLower.includes('twitter.com') ||
                hLower.includes('google.com') ||
                hLower.includes('#') ||
                hLower.includes('javascript:')
            ) continue;

            if (
                hLower.includes('pixeldrain.com') ||
                hLower.includes('supercloud') ||
                hLower.includes('t.me/') ||
                hLower.includes('telegram.me') ||
                hLower.includes('drive7.') ||
                hLower.includes('drive.') ||
                hLower.includes('kdrive') ||
                hLower.includes('csplayer2.space/server') ||
                targetUrl.endsWith('.mp4') ||
                targetUrl.endsWith('.mkv')
            ) {
                let type = "Direct Server";
                if (hLower.includes('pixeldrain')) type = "PixelDrain";
                else if (hLower.includes('t.me/') || hLower.includes('telegram.me')) type = "Telegram Bot";
                else if (hLower.includes('supercloud') || hLower.includes('drive7.')) type = "Direct High-Speed Server";
                else if (hLower.includes('csplayer2.space/server')) type = "Direct High-Speed Server";

                const qMatch = targetUrl.match(/(2160p|4K|1080p|720p|480p)/i) || pageData.title.match(/(2160p|4K|1080p|720p|480p)/i);
                const qualityName = qMatch ? qMatch[0].toUpperCase() : "WEB-DL";

                const qualityLabel = `${qualityName} [${type}]`;
                if (!downloads.some(d => d.link === targetUrl)) {
                    downloads.push({ quality: qualityLabel, size: "N/A", language: "English", link: targetUrl });
                }
            }
        }

        await browser.close();

        console.log(`🎉 Total Final Download Links Extracted: ${downloads.length}`);
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

app.listen(PORT, () => console.log(`Cinesubz Ultimate DL API running on port ${PORT}`));
