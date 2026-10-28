const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://cinesubz.net/'
};

// Root Route
app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA CINESUBZ ULTIMATE API is Live 🚀",
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
        
        const response = await axios.get(latestUrl, { headers: HEADERS, timeout: 30000 });
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

            let quality = parent.find('.quality, .badge').text().trim() || 'WEB-DL';
            let rating = parent.find('.imdb-rate, .rating').text().trim() || 'N/A';

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
        const response = await axios.get(searchUrl, { headers: HEADERS, timeout: 30000 });
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

            let quality = parent.find('.quality, .badge').text().trim() || 'WEB-DL';
            let rating = parent.find('.imdb-rate, .rating').text().trim() || 'N/A';

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

// 🚀 Ultra-Robust Puppeteer Resolver for CSPlayer Timer & SuperCloud Link Extraction
async function resolveRealDownloadUrl(csPlayerUrl) {
    let finalUrl = csPlayerUrl;
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

        // Listen to all network requests to catch supercloud token URL instantly
        page.on('request', req => {
            const url = req.url();
            if (url.includes('supercloud') || url.includes('pixeldrain') || url.includes('token=')) {
                if (!url.includes('csplayer2.space')) {
                    finalUrl = url;
                }
            }
        });

        await page.goto(csPlayerUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        // ⏳ Wait 7 seconds for the CSPlayer timer to fully expire and unlock the download link
        await new Promise(r => setTimeout(r, 7000));

        // Check if page automatically redirected
        if (page.url() !== csPlayerUrl && !page.url().includes('csplayer2.space')) {
            return page.url();
        }

        // Extract the updated 'href' from the Direct Download button after timer finishes
        const buttonHref = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            const target = anchors.find(a => {
                const txt = (a.innerText || '').toLowerCase();
                return txt.includes('direct download') || txt.includes('download');
            });
            return target ? target.href : null;
        });

        if (buttonHref && !buttonHref.includes('csplayer2.space') && buttonHref.startsWith('http')) {
            finalUrl = buttonHref;
        } else {
            // Try clicking the button if href wasn't direct
            const clicked = await page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('a, button, div'));
                const btn = elements.find(el => {
                    const txt = (el.innerText || '').toLowerCase();
                    return txt.includes('direct download') || txt.includes('download');
                });
                if (btn) {
                    btn.click();
                    return true;
                }
                return false;
            });

            if (clicked) {
                await new Promise(r => setTimeout(r, 4000));
                if (page.url() !== csPlayerUrl && !page.url().includes('csplayer2.space')) {
                    finalUrl = page.url();
                }
            }
        }
    } catch (err) {
        console.log(`⚠️ Puppeteer resolver error: ${err.message}`);
    } finally {
        if (browser) await browser.close();
    }
    return finalUrl;
}

// 3. Info & Download Endpoint
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    res.setTimeout(60000, () => {
        if (!res.headersSent) {
            res.status(504).json({ status: false, error: "Gateway Timeout" });
        }
    });

    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    console.log(`\n==============================================`);
    console.log(`🔥 [ULTIMATE API DL] Processing Movie: ${movieUrl}`);

    try {
        const movieRes = await axios.get(movieUrl, { headers: HEADERS, timeout: 45000 });
        const $ = cheerio.load(movieRes.data);

        const title = $('meta[property="og:title"]').attr('content') || $('h1').text().trim() || 'Unknown';
        const image = $('meta[property="og:image"]').attr('content') || '';
        const quality = $('.quality').first().text().trim() || 'WEB-DL';
        const rating = $('span.rating, .imdb-rate').first().text().trim() || 'N/A';
        const director = $('span.director').text().trim() || 'N/A';

        let story = '';
        $('p').each((i, el) => {
            const txt = $(el).text().trim();
            if (txt.length > 50 && !txt.includes('උපසිරැසි') && !txt.includes('Download') && !story) {
                story = txt;
            }
        });

        const genres = [];
        $('.genres a, .sgeneros a, .cat-links a').each((i, el) => {
            genres.push($(el).text().trim());
        });

        const cast = [];
        $('.cast-item, .person, .actor').each((i, el) => {
            const name = $(el).find('.name, h4').text().trim();
            const role = $(el).find('.role, .character').text().trim();
            const img = $(el).find('img').attr('src') || '';
            if (name) cast.push({ name, role: role || 'Actor', image: img });
        });

        const gallery = [];
        $('.gallery img, .screenshots img, .slider img').each((i, el) => {
            const src = $(el).attr('src') || $(el).attr('data-src');
            if (src) gallery.push(src);
        });

        const downloads = [];
        const rawLinks = [];

        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().trim();
            const parentText = $(el).closest('div, p, li').text();

            if (href.includes('pixeldrain.com') || href.includes('t.me/') || href.includes('zt-links') || href.includes('drive.csplayer')) {
                rawLinks.push({ href, text: text || parentText });
            }
        });

        console.log(`📦 Found ${rawLinks.length} raw links. Resolving SuperCloud tokens via Puppeteer...`);

        for (const item of rawLinks) {
            let finalLink = item.href;
            let qName = "HD";

            if (item.text.match(/480p/i)) qName = "480p";
            else if (item.text.match(/720p/i)) qName = "720p";
            else if (item.text.match(/1080p/i)) qName = "1080p";
            else if (item.text.match(/2160p|4k/i)) qName = "2160p";

            if (item.href.includes('zt-links') || item.href.includes('drive.csplayer')) {
                try {
                    let portalUrl = item.href;
                    if (item.href.includes('zt-links')) {
                        const ztRes = await axios.get(item.href, { headers: HEADERS, timeout: 30000 });
                        const $zt = cheerio.load(ztRes.data);
                        $zt('a').each((_, ztel) => {
                            const zh = $zt(ztel).attr('href') || '';
                            if (zh.includes('drive.csplayer') || zh.includes('/server')) portalUrl = zh;
                        });
                    }

                    if (portalUrl.includes('/server')) {
                        const parsedUrl = new URL(portalUrl);
                        const apiUrl = `https://drive.csplayer2.space/api/download-data${parsedUrl.pathname}${parsedUrl.search}`;
                        const apiRes = await axios.get(apiUrl, { headers: HEADERS, timeout: 30000 });
                        if (apiRes.data && apiRes.data.redirect) {
                            let red = apiRes.data.redirect;
                            if (red.startsWith('/')) red = `https://drive.csplayer2.space${red}`;
                            portalUrl = red;
                        }
                    }

                    console.log(`🖱️ Unlocking token for ${qName} from portal: ${portalUrl}`);
                    finalLink = await resolveRealDownloadUrl(portalUrl);
                } catch (e) {
                    console.log(`⚠️ Resolution error: ${e.message}`);
                }
            }

            let typeLabel = "Direct High-Speed Server";
            if (finalLink.includes('pixeldrain')) typeLabel = "PixelDrain";
            else if (finalLink.includes('t.me/')) typeLabel = "Telegram Bot";

            if (!downloads.some(d => d.link === finalLink)) {
                downloads.push({
                    quality: `WEB-DL ${qName} [${typeLabel}]`,
                    size: "N/A",
                    language: "English",
                    link: finalLink
                });
            }
        }

        console.log(`🎉 Successfully generated ${downloads.length} final links!`);
        console.log(`==============================================\n`);

        if (!res.headersSent) {
            res.json({
                status: true,
                creator: "@Imalsha",
                site: "cinesubz",
                url: movieUrl,
                data: {
                    title,
                    image: image.trim(),
                    quality,
                    rating: rating || '8.0',
                    imdb: rating ? `${rating} (IMDb)` : 'N/A',
                    director,
                    language: "ENGLISH",
                    genres: genres.length > 0 ? genres : ["Action", "Adventure", "Sinhala Subtitles"],
                    story: story || 'No description available',
                    cast,
                    gallery,
                    trailer: "https://www.youtube.com/@cinesubz",
                    year: "2026",
                    duration: "145 min",
                    downloads: downloads.length > 0 ? downloads : [{ quality: "HD [Telegram]", size: "N/A", language: "English", link: "https://t.me/CineSubzAdmin" }]
                }
            });
        }

    } catch (err) {
        console.error(`❌ [API ERROR]: ${err.message}`);
        if (!res.headersSent) {
            res.status(500).json({ status: false, error: err.message });
        }
    }
});

app.listen(PORT, () => console.log(`Lightning Fast Cinesubz API running on port ${PORT}`));
