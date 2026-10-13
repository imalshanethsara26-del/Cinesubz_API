const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
let PORT = process.env.PORT || 3000;

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

app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "Cinesubz Complete API is Live 🚀",
        endpoints: {
            search: "/api/v1/cinesubz/search?q=movie_name",
            infodl: "/api/v1/cinesubz/infodl?url=movie_url"
        }
    });
});

// Search Endpoint (සර්ච් කිරීම සඳහා)
app.get('/api/v1/cinesubz/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ status: false, message: "Search term required (?q=...)" });

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
                if (href && href.includes('cinesubz.lk') && (href.includes('/movies/') || href.includes('/tvshows/'))) {
                    let title = el.querySelector('h2, h3, .title, .entry-title')?.innerText || el.innerText || '';
                    let img = el.querySelector('img')?.src || '';
                    if (title.trim().length > 2) {
                        if (!list.some(r => r.link === href)) {
                            list.push({ title: title.trim().replace(/\t|\n/g, ''), image: img, link: href });
                        }
                    }
                }
            });
            return list;
        });

        await browser.close();
        res.json({ status: true, creator: "@Imalsha", site: "cinesubz", results_count: results.length, data: results });

    } catch (err) {
        if (browser) await browser.close();
        res.status(500).json({ status: false, error: err.message });
    }
});

// Info & Download Endpoint (සැබෑ මූවී විස්තර සහ ලින්ක්ස් ලබා ගැනීම)
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required (?url=...)" });

    let browser;
    try {
        browser = await getBrowser();
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 800 });

        await page.goto(movieUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // සැබෑ මූවී විස්තර (Metadata) සහ zt-links සයිට් එකෙන්ම ලබා ගැනීම
        const pageData = await page.evaluate(() => {
            const title = document.querySelector('meta[property="og:title"]')?.content || document.querySelector('h1')?.innerText || 'Unknown Movie';
            const image = document.querySelector('meta[property="og:image"]')?.content || '';
            const quality = document.querySelector('.quality')?.innerText || 'WEB-DL';
            const rating = document.querySelector('.imdb-rate, .rating')?.innerText || 'N/A';
            
            // අධ්‍යක්ෂකවරයා සෙවීම
            let director = 'N/A';
            document.querySelectorAll('.director, span, div').forEach(el => {
                if (el.innerText.includes('Director') || el.innerText.includes('අධ්‍යක්ෂණය')) {
                    const txt = el.innerText.replace(/Director:|අධ්‍යක්ෂණය:/gi, '').trim();
                    if (txt.length > 2 && txt.length < 50) director = txt;
                }
            });

            // සැබෑ කතාව (Story / Synopsis) සෙවීම
            let story = '';
            const descEl = document.querySelector('.entry-content, .synopsis, .description');
            if (descEl) {
                const pTag = descEl.querySelector('p');
                story = pTag ? pTag.innerText.trim() : descEl.innerText.trim();
            }
            if (!story || story.length < 20) {
                document.querySelectorAll('p').forEach(p => {
                    const txt = p.innerText.trim();
                    if (txt.length > 40 && !txt.includes('උපසිරැසි') && !txt.includes('Download') && !story) {
                        story = txt;
                    }
                });
            }

            // ජනප්‍රිය ප්‍රභේද (Genres) සෙවීම
            const genres = [];
            document.querySelectorAll('.genres a, .cat-links a, .genre a').forEach(a => {
                genres.push(a.innerText.trim());
            });

            // නළුවන් (Cast) සෙවීම
            const cast = [];
            document.querySelectorAll('.cast a, .star-cast a, .actors a').forEach(a => {
                cast.push(a.innerText.trim());
            });

            // ZT Links සෙවීම
            const ztLinks = [];
            document.querySelectorAll('a').forEach(a => {
                const href = a.href;
                if (href && (href.includes('/zt-links/') || href.includes('zt-links'))) {
                    const parentText = a.parentElement ? a.parentElement.innerText : '';
                    ztLinks.push({ url: href, text: a.innerText + ' ' + parentText });
                }
            });

            return { 
                title, 
                image, 
                quality, 
                rating, 
                director, 
                story: story || 'No description available', 
                genres: genres.length > 0 ? genres : ["Action", "Adventure", "Sinhala Subtitles"],
                cast: cast.length > 0 ? cast : [],
                ztLinks 
            };
        });

        // වර්ෂය (Year) ටයිට්ල් එකෙන් හෝ වෙනත් තැනකින් ලබා ගැනීම
        let year = "2026";
        const yearMatch = pageData.title.match(/\((\d{4})\)/);
        if (yearMatch) year = yearMatch[1];

        const downloads = [];

        // Zt-links හරහා ගොස් ඩවුන්ලෝඩ් ලින්ක්ස් කැප්චර් කිරීම
        for (const item of pageData.ztLinks) {
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
                genres: pageData.genres,
                story: pageData.story,
                cast: pageData.cast,
                gallery: [],
                trailer: "https://www.youtube.com/@cinesubz",
                year,
                duration: "N/A",
                tag: "English",
                directors: pageData.director,
                stars: pageData.cast.slice(0, 3).join(', ') || "N/A",
                country: "Sri Lanka / Global",
                downloads
            }
        });

    } catch (err) {
        if (browser) await browser.close();
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log("Complete Cinesubz API running on port " + PORT));
