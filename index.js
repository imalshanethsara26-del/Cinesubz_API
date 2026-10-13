const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

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
        message: "IMALSHA CINESUBZ API is Live 🚀",
        endpoints: {
            search: "/api/v1/cinesubz/search?q=movie_name",
            infodl: "/api/v1/cinesubz/infodl?url=movie_url"
        }
    });
});

// Search Endpoint (Puppeteer හරහා Cloudflare මඟහරවා නිවැරදිව සර්ච් කිරීම)
app.get('/api/v1/cinesubz/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ status: false, message: "Search term required" });

    let browser;
    try {
        browser = await getBrowser();
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

        const searchUrl = "https://cinesubz.lk/?s=" + encodeURIComponent(query);
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

        const results = await page.evaluate(() => {
            const list = [];
            document.querySelectorAll('a').forEach(el => {
                let href = el.href;
                if (href === 'https://cinesubz.lk/movies/' || href === 'https://cinesubz.lk/tvshows/' || href === 'https://cinesubz.lk/') {
                    return;
                }
                if (href && href.includes('cinesubz.lk') && (href.includes('/movies/') || href.includes('/tvshows/'))) {
                    let title = el.querySelector('h2, h3, .title, .entry-title')?.innerText || el.innerText || '';
                    let img = el.querySelector('img')?.src || '';
                    if (!img) {
                        const parent = el.closest('article, .post, .item, div');
                        if (parent) {
                            img = parent.querySelector('img')?.src || '';
                        }
                    }
                    if (title && title.trim().length > 2 && !title.includes('All Movies') && !title.includes('TV Shows')) {
                        title = title.trim().replace(/\t|\n/g, '');
                        if (!list.some(r => r.link === href)) {
                            list.push({ title, image: img, link: href });
                        }
                    }
                }
            });
            return list;
        });

        await browser.close();
        res.json({ status: true, creator: "IMALSHA API", site: "cinesubz", results_count: results.length, data: results });

    } catch (err) {
        if (browser) await browser.close();
        res.status(500).json({ status: false, error: err.message });
    }
});

// Info & Download Endpoint (අපේ සාර්ථක වූ Puppeteer Direct High-Speed Download ලොජික් එක)
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    let browser;
    try {
        browser = await getBrowser();
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 800 });

        await page.goto(movieUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const pageData = await page.evaluate(() => {
            const title = document.querySelector('meta[property="og:title"]')?.content || document.querySelector('h1')?.innerText || 'Unknown';
            const image = document.querySelector('meta[property="og:image"]')?.content || '';
            const quality = document.querySelector('.quality')?.innerText || 'WEB-DL';
            const rating = document.querySelector('.imdb-rate')?.innerText || 'N/A';
            const director = document.querySelector('span.director')?.innerText || 'N/A';

            let story = '';
            document.querySelectorAll('.entry-content p, .su-spoiler-content p').forEach(p => {
                const txt = p.innerText.trim();
                if (txt.length > 30 && !txt.includes('උපසිරැසි') && !txt.includes('Download') && !story) {
                    story = txt;
                }
            });

            const ztLinks = [];
            document.querySelectorAll('a').forEach(a => {
                const href = a.href;
                if (href && (href.includes('/zt-links/') || href.includes('zt-links'))) {
                    const parentText = a.parentElement ? a.parentElement.innerText : '';
                    ztLinks.push({ url: href, text: a.innerText + ' ' + parentText });
                }
            });

            return { title, image, quality, rating, director, story: story || 'No description available', ztLinks };
        });

        let year = "2026";
        const yearMatch = pageData.title.match(/\((\d{4})\)/);
        if (yearMatch) year = yearMatch[1];

        const downloads = [];

        for (let i = 0; i < pageData.ztLinks.length; i++) {
            const item = pageData.ztLinks[i];
            let ztPage;
            try {
                ztPage = await browser.newPage();
                await ztPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
                
                await ztPage.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 20000 });

                const foundLinks = await ztPage.evaluate(() => {
                    const links = [];
                    document.querySelectorAll('a').forEach(a => {
                        const h = a.href;
                        if (h && !h.includes('cinesubz.lk') && !h.includes('cinesubz.net') && !h.includes('CineSubzAdmin')) {
                            links.push(h);
                        }
                    });
                    return links;
                });

                const qMatch = item.text.match(/(2160p|4K|1080p|720p|480p|BluRay|WEB-DL|HDRip)/i);
                const qualityName = qMatch ? qMatch[0].toUpperCase() : "WEB-DL";
                const sMatch = item.text.match(/(\d+(\.\d+)?\s*(GB|MB))/i);
                const size = sMatch ? sMatch[0] : "N/A";

                foundLinks.forEach(link => {
                    if (link.includes('telegram.org')) return;

                    let isBotLink = link.includes('t.me/') || link.includes('telegram.me/');
                    if (isBotLink && !link.includes('bot') && !link.includes('start=')) return;

                    let type = "Direct Server";
                    if (link.includes('pixeldrain')) type = "PixelDrain";
                    else if (isBotLink) type = "Telegram Bot";
                    else if (link.includes('space') || link.includes('kdrive') || link.includes('csplayer')) type = "Direct High-Speed Server";

                    const qualityLabel = qualityName + " [" + type + "]";
                    if (!downloads.some(d => d.link === link)) {
                        downloads.push({ quality: qualityLabel, size, language: "English", link });
                    }
                });

                await ztPage.close();
            } catch (ztErr) {
                if (ztPage) await ztPage.close();
            }
        }

        await browser.close();

        res.json({
            status: true,
            creator: "IMALSHA API",
            site: "cinesubz",
            data: {
                title: pageData.title,
                imdb_rating: pageData.rating,
                story: pageData.story,
                image: pageData.image,
                downloads
            }
        });

    } catch (err) {
        if (browser) await browser.close();
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Cinesubz API running on port ${PORT}`));
