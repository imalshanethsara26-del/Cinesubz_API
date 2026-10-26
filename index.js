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

// 3. Robust Info & Download Endpoint with Deep DOM & Attribute Extraction
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    console.log(`\n==============================================`);
    console.log(`🔍 [ROBUST DL API] Processing Movie URL: ${movieUrl}`);

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

            // Gather all wrapper/player links
            const initialLinks = [];
            document.querySelectorAll('a').forEach(a => {
                const href = a.href || '';
                const hLower = href.toLowerCase();
                const txt = a.innerText || '';

                if (hLower.includes('csplayer') || hLower.includes('zt-links') || hLower.includes('space') || txt.toLowerCase().includes('download')) {
                    if (!hLower.includes('facebook') && !hLower.includes('instagram') && !hLower.includes('#') && !hLower.includes('javascript:')) {
                        if (!initialLinks.some(d => d.url === href)) {
                            initialLinks.push({ url: href, text: txt + ' ' + (a.parentElement?.innerText || '') });
                        }
                    }
                }
            });

            return { title, image, quality, rating, director, story: story || 'No description available', initialLinks };
        });

        console.log(`🎬 Title: ${pageData.title}`);
        console.log(`🔗 Found ${pageData.initialLinks.length} wrapper link(s). Extracting deep links...`);

        let year = "2026";
        const yearMatch = pageData.title.match(/(\d{4})/);
        if (yearMatch) year = yearMatch[1];

        const downloads = [];

        for (let i = 0; i < pageData.initialLinks.length; i++) {
            const item = pageData.initialLinks[i];
            let subPage;
            try {
                subPage = await browser.newPage();
                await subPage.setUserAgent(HEADERS['User-Agent']);
                
                await subPage.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
                await new Promise(r => setTimeout(r, 3000)); // Wait for elements to fully render

                // Deep extraction of links from attributes, hrefs, and text
                const extractedData = await subPage.evaluate(() => {
                    let fileSize = 'N/A';
                    const allText = document.body.innerText || '';
                    const matchSize = allText.match(/File Size:\s*([^\n]+)/i);
                    if (matchSize && matchSize[1]) {
                        fileSize = matchSize[1].trim();
                    }

                    const foundLinks = [];
                    // Check all anchor tags, buttons, and elements with href/data-href/onclick
                    document.querySelectorAll('a, button, [data-href], [data-url], [onclick]').forEach(el => {
                        const txt = (el.innerText || el.textContent || '').toLowerCase();
                        const href = el.href || el.getAttribute('href') || el.getAttribute('data-href') || el.getAttribute('data-url') || '';
                        const onclick = el.getAttribute('onclick') || '';

                        const combinedAttr = href + ' ' + onclick;

                        if (combinedAttr.length > 5) {
                            foundLinks.push({ text: txt, url: combinedAttr });
                        }
                    });

                    return { fileSize, foundLinks };
                });

                await subPage.close();

                for (const lObj of extractedData.foundLinks) {
                    let targetUrl = lObj.url;
                    let txt = lObj.text;
                    let hLower = targetUrl.toLowerCase();

                    // If URL is embedded in onclick, try to extract it using regex
                    const urlMatch = targetUrl.match(/(https?:\/\/[^\s'"]+)/);
                    if (urlMatch) {
                        targetUrl = urlMatch[1];
                        hLower = targetUrl.toLowerCase();
                    }

                    if (hLower.includes('cinesubzadmin') || hLower.includes('facebook') || hLower.includes('instagram') || hLower.includes('#')) continue;

                    if (
                        hLower.includes('pixeldrain.com') ||
                        hLower.includes('supercloud') ||
                        hLower.includes('t.me/') ||
                        hLower.includes('telegram.me') ||
                        hLower.includes('drive.csplayer') ||
                        hLower.includes('drive') ||
                        hLower.includes('kdrive') ||
                        hLower.endsWith('.mp4') ||
                        hLower.endsWith('.mkv') ||
                        txt.includes('direct download') ||
                        txt.includes('telegram download')
                    ) {
                        let type = "Direct Server";
                        if (hLower.includes('pixeldrain')) type = "PixelDrain";
                        else if (hLower.includes('t.me/') || hLower.includes('telegram.me') || txt.includes('telegram')) type = "Telegram Bot";
                        else if (hLower.includes('supercloud') || hLower.includes('drive.csplayer') || txt.includes('direct download')) type = "Direct High-Speed Server";

                        const combinedText = item.text + ' ' + extractedData.fileSize;
                        const qMatch = combinedText.match(/(2160p|4K|1080p|720p|480p|BluRay|WEB-DL|WEBRip|HDRip)/i);
                        const qualityName = qMatch ? qMatch[0].toUpperCase() : "WEB-DL";
                        const size = extractedData.fileSize !== 'N/A' ? extractedData.fileSize : 'N/A';

                        const qualityLabel = `${qualityName} [${type}]`;
                        if (!downloads.some(d => d.link === targetUrl)) {
                            downloads.push({ quality: qualityLabel, size, language: "English", link: targetUrl });
                        }
                    }
                }

            } catch (subErr) {
                if (subPage) await subPage.close();
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

app.listen(PORT, () => console.log(`Cinesubz Real DL API running on port ${PORT}`));
