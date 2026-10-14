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
        res.status(500).json({ status: false, error: err.message });
    }
});

// 3. Info & Download Endpoint (Clicking Direct Download buttons to intercept True Final URL)
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    console.log(`\n==============================================`);
    console.log(`🔍 [REAL DL API] Processing Movie URL: ${movieUrl}`);

    let browser;
    try {
        browser = await getBrowser();
        const page = await browser.newPage();
        await page.setUserAgent(HEADERS['User-Agent']);
        await page.setViewport({ width: 1280, height: 800 });

        await page.goto(movieUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
        await new Promise(r => setTimeout(r, 2000));

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
        console.log(`🔗 Found ${pageData.initialLinks.length} initial redirect link(s).`);

        let year = "2026";
        const yearMatch = pageData.title.match(/(\d{4})/);
        if (yearMatch) year = yearMatch[1];

        const downloads = [];

        for (let i = 0; i < pageData.initialLinks.length; i++) {
            const item = pageData.initialLinks[i];
            console.log(`\n⏳ Navigating Wrapper Link ${i + 1}/${pageData.initialLinks.length}: ${item.url}`);
            
            let subPage;
            try {
                subPage = await browser.newPage();
                await subPage.setUserAgent(HEADERS['User-Agent']);
                
                await subPage.goto(item.url, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
                
                // 1. Click "Go to Download Page" timer button
                try {
                    await new Promise(r => setTimeout(r, 2000));
                    await subPage.evaluate(() => {
                        document.querySelectorAll('a, button').forEach(el => {
                            const txt = el.innerText.toLowerCase();
                            if (txt.includes('download page') || txt.includes('go to') || txt.includes('click here')) {
                                el.click();
                            }
                        });
                    });
                    await subPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
                    
                    // Wait for CS Player buttons to appear
                    await subPage.waitForFunction(() => {
                        const bodyText = document.body.innerText;
                        return bodyText.includes('Direct Download') || bodyText.includes('Telegram Download') || bodyText.includes('File Size');
                    }, { timeout: 15000 }).catch(() => {});
                    
                    await new Promise(r => setTimeout(r, 2000));
                } catch (e) {}

                // 2. 🚀 SMART CLICK INTERCEPTION: Find "Direct Download" or "Telegram" buttons and click them to get the real destination URL!
                const realDownloadUrls = await subPage.evaluate(async () => {
                    const results = [];
                    const buttons = Array.from(document.querySelectorAll('a, button'));
                    
                    for (const btn of buttons) {
                        const txt = (btn.innerText || '').toLowerCase();
                        const href = btn.href || '';
                        
                        if (txt.includes('direct download') || txt.includes('telegram') || href.includes('pixeldrain') || href.includes('t.me')) {
                            results.push({ text: btn.innerText, href: href });
                        }
                    }
                    return results;
                });

                // Let's also check if clicking the button opens a new tab or triggers a navigation
                // We can extract all outbound links or listen for popup/navigation when clicking
                for (const btnInfo of realDownloadUrls) {
                    let targetUrl = btnInfo.href;
                    let linkText = btnInfo.text.toLowerCase();

                    if (!targetUrl || targetUrl.includes('#') || targetUrl.includes('javascript:')) continue;

                    const qMatch = item.text.match(/(2160p|4K|1080p|720p|480p|BluRay|WEB-DL|WEBRip|HDRip)/i);
                    const qualityName = qMatch ? qMatch[0].toUpperCase() : "WEB-DL";
                    const sMatch = item.text.match(/(\d+(\.\d+)?\s*(GB|MB))/i);
                    const size = sMatch ? sMatch[0] : "N/A";

                    if (targetUrl.includes('pixeldrain') || targetUrl.includes('t.me/') || targetUrl.includes('space') || targetUrl.endsWith('.mp4') || targetUrl.endsWith('.mkv') || linkText.includes('download') || linkText.includes('telegram')) {
                        
                        let type = "Direct High-Speed Server";
                        if (targetUrl.includes('pixeldrain') || linkText.includes('pixeldrain')) type = "PixelDrain";
                        else if (targetUrl.includes('t.me/') || linkText.includes('telegram')) type = "Telegram Bot";

                        const qualityLabel = qualityName + " [" + type + "]";
                        if (!downloads.some(d => d.link === targetUrl)) {
                            downloads.push({ quality: qualityLabel, size, language: "English", link: targetUrl });
                            console.log(`   ✅ Real Download Link Captured: [${qualityLabel}] -> ${targetUrl}`);
                        }
                    }
                }

                await subPage.close();
            } catch (subErr) {
                console.error(`   ❌ Failed to process sub-page: ${subErr.message}`);
                if (subPage) await subPage.close();
            }
        }

        await browser.close();
        console.log(`\n🎉 Total Final Download Links Extracted: ${downloads.length}`);
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
        console.error(`❌ Critical Error: ${err.message}`);
        if (browser) await browser.close();
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Cinesubz Real DL API running on port ${PORT}`));
