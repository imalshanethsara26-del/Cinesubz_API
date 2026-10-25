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

            let img = $(el).find('img').attr('src');
            if (!img) img = $(el).find('img').attr('data-src');
            if (!img) img = parent.find('img').attr('src');
            if (!img) img = parent.find('img').attr('data-src');
            if (!img) img = '';

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
        console.error(`❌ [LATEST ERROR]: ${err.message}`);
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

            let img = $(el).find('img').attr('src');
            if (!img) img = $(el).find('img').attr('data-src');
            if (!img) img = parent.find('img').attr('src');
            if (!img) img = parent.find('img').attr('data-src');
            if (!img) img = '';

            if (href.includes('cinesubz.') && (href.includes('/movies/') || href.includes('/tvshows/')) && title.length > 2) {
                title = title.replace(/\t|\n/g, '').trim();
                if (!results.some(r => r.link === href)) {
                    results.push({ title, image: img, link: href });
                }
            }
        });

        res.json({ status: true, creator: "@Imalsha", site: "cinesubz", results_count: results.length, data: results });
    } catch (err) {
        console.error(`❌ [SEARCH ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

// 3. Ultra-Fast Info & Download Endpoint (Single Browser Instance + Block Unnecessary Assets)
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    console.log(`\n==============================================`);
    console.log(`🔍 [ULTRA FAST DL API] Processing Movie URL: ${movieUrl}`);

    let browser;
    try {
        browser = await getBrowser();
        const page = await browser.newPage();

        // Block images, stylesheets, fonts, and media to make page load lightning fast
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent(HEADERS['User-Agent']);
        await page.setViewport({ width: 1280, height: 800 });

        await page.goto(movieUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await new Promise(r => setTimeout(r, 800));

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
                const txt = (a.innerText || '') + ' ' + (a.parentElement ? a.parentElement.innerText : '');
                const hLower = href.toLowerCase();

                if (hLower.includes('javascript:') || hLower.includes('#') || hLower.includes('.jpg') || hLower.includes('facebook.com') || hLower.includes('account')) return;

                if (href && (hLower.includes('zt-links') || hLower.includes('download') || hLower.includes('space') || hLower.includes('kdrive') || hLower.includes('csplayer') || hLower.includes('pixeldrain') || hLower.includes('/api-') || txt.toLowerCase().includes('download'))) {
                    if (!initialLinks.some(d => d.url === href)) {
                        initialLinks.push({ url: href, text: txt });
                    }
                }
            });

            return { title, image, quality, rating, director, story: story || 'No description available', initialLinks };
        });

        console.log(`🎬 Title: ${pageData.title}`);
        console.log(`🔗 Found ${pageData.initialLinks.length} wrapper link(s). Processing concurrently...`);

        let year = "2026";
        const yearMatch = pageData.title.match(/(\d{4})/);
        if (yearMatch) year = yearMatch[1];

        // 🚀 Reuse the SAME browser instance and open tabs concurrently via Promise.all
        const downloadPromises = pageData.initialLinks.map(async (item) => {
            let subPage;
            try {
                subPage = await browser.newPage();
                
                // Block assets on subpages too for max speed
                await subPage.setRequestInterception(true);
                subPage.on('request', (req) => {
                    if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });

                await subPage.setUserAgent(HEADERS['User-Agent']);
                
                await subPage.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
                
                await new Promise(r => setTimeout(r, 600));
                await subPage.evaluate(() => {
                    document.querySelectorAll('a, button').forEach(el => {
                        const txt = (el.innerText || '').toLowerCase();
                        if (txt.includes('download page') || txt.includes('go to') || txt.includes('click here')) {
                            el.click();
                        }
                    });
                }).catch(() => {});

                await subPage.waitForFunction(() => {
                    const bodyText = document.body.innerText;
                    return bodyText.includes('Direct Download') || bodyText.includes('Telegram Download');
                }, { timeout: 8000 }).catch(() => {});

                const extractedLinks = await subPage.evaluate(() => {
                    const results = [];
                    document.querySelectorAll('a, button').forEach(btn => {
                        const txt = btn.innerText || '';
                        const href = btn.href || '';
                        if (txt.toLowerCase().includes('direct download') || txt.toLowerCase().includes('telegram') || href.includes('pixeldrain') || href.includes('t.me')) {
                            results.push({ text: txt, href: href });
                        }
                    });
                    return results;
                });

                await subPage.close();

                const linksList = [];
                for (const btnInfo of extractedLinks) {
                    let targetUrl = btnInfo.href;
                    let linkText = btnInfo.text.toLowerCase();

                    if (!targetUrl || targetUrl.includes('#') || targetUrl.includes('javascript:')) continue;

                    const qMatch = item.text.match(/(2160p|4K|1080p|720p|480p|BluRay|WEB-DL|WEBRip|HDRip)/i);
                    const qualityName = qMatch ? qMatch[0].toUpperCase() : "WEB-DL";
                    const sMatch = item.text.match(/(\d+(\.\d+)?\s*(GB|MB))/i);
                    const size = sMatch ? sMatch[0] : "N/A";

                    let type = "Direct Server";
                    if (targetUrl.includes('pixeldrain')) type = "PixelDrain";
                    else if (targetUrl.includes('t.me/')) type = "Telegram Bot";

                    const qualityLabel = qualityName + " [" + type + "]";
                    linksList.push({ quality: qualityLabel, size, language: "English", link: targetUrl });
                }
                return linksList;

            } catch (subErr) {
                if (subPage) await subPage.close();
                return [];
            }
        });

        const allResults = await Promise.all(downloadPromises);
        await browser.close(); // Close main browser after all tasks finish

        const downloads = [];
        allResults.flat().forEach(d => {
            if (!downloads.some(existing => existing.link === d.link)) {
                downloads.push(d);
            }
        });

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
        console.error(`❌ [CRITICAL INFODL ERROR]: ${err.message}`);
        if (browser) await browser.close();
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Cinesubz Real DL API running on port ${PORT}`));
