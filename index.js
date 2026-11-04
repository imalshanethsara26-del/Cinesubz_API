const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const puppeteer = require('puppeteer');

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

// 3. Info & Download Endpoint (Full Terminal Debugger + Puppeteer)
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    res.setTimeout(90000, () => {
        if (!res.headersSent) {
            res.status(504).json({ status: false, error: "Gateway Timeout" });
        }
    });

    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    console.log(`\n==============================================`);
    console.log(`🔍 [DEBUGGER START] Processing Movie: ${movieUrl}`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

        console.log(`1️⃣ Navigating to main movie page...`);
        await page.goto(movieUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        const html = await page.content();
        const $ = cheerio.load(html);

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

        const wrapperLinks = [];
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().trim();
            if (href.includes('zt-links') || href.includes('api') || href.includes('csplayer') || href.includes('space')) {
                wrapperLinks.push({ href, text });
            }
        });

        console.log(`📦 Found ${wrapperLinks.length} wrapper/download links to inspect.`);

        const downloads = [];

        for (const wrap of wrapperLinks) {
            console.log(`\n----------------------------------------------`);
            console.log(`🚀 Opening wrapper link: ${wrap.href} (Text: ${wrap.text})`);
            
            try {
                const subPage = await browser.newPage();

                // 🕵️‍♂️ TRACK ALL NETWORK REQUESTS ON THIS SUBPAGE
                subPage.on('request', request => {
                    console.log(`🌐 [REQ] --> ${request.method()} : ${request.url()}`);
                });

                // 📥 TRACK ALL NETWORK RESPONSES (Look for JSON APIs or hidden file links)
                subPage.on('response', async response => {
                    const rUrl = response.url();
                    const rStatus = response.status();
                    if (rUrl.includes('cloudflare') || rUrl.includes('pixeldrain') || rUrl.includes('.mp4') || rUrl.includes('token=')) {
                        console.log(`🎯 [FOUND MATCH IN NETWORK] (${rStatus}) ${rUrl}`);
                    }
                });

                // Go to intermediate / player page
                await subPage.goto(wrap.href, { waitUntil: 'networkidle2', timeout: 30000 });

                // Wait a bit for timers or AJAX loads to complete
                console.log(`⏳ Waiting for timer/dynamic elements to load...`);
                await new Promise(r => setTimeout(r, 6000));

                // Try to click the "Go to Download Page" or "Direct Download" button if it exists
                try {
                    const downloadBtnSelector = 'a.btn, button, a[href*="csplayer"], a[id*="download"]';
                    await subPage.waitForSelector(downloadBtnSelector, { timeout: 5000 });
                    
                    const btnExists = await subPage.$(downloadBtnSelector);
                    if (btnExists) {
                        console.log(`🖱️ Clicking download/redirect button on page...`);
                        await Promise.all([
                            btnExists.click(),
                            subPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {})
                        ]);
                    }
                } catch (btnErr) {
                    console.log(`⚠️ No clickable button found or click timed out: ${btnErr.message}`);
                }

                // Check final URL of the subpage after redirects/clicks
                const finalSubUrl = subPage.url();
                console.log(`📍 Final Sub-page URL after processing: ${finalSubUrl}`);

                const subHtml = await subPage.content();
                const $sub = cheerio.load(subHtml);

                let foundDirectLink = '';
                
                $sub('a').each((_, subEl) => {
                    const shref = $sub(subEl).attr('href') || '';
                    if (shref.includes('cloudflarestorage.com') || shref.includes('pixeldrain.com') || shref.includes('.mp4') || shref.includes('token=')) {
                        foundDirectLink = shref;
                    }
                });

                if (!foundDirectLink && (finalSubUrl.includes('cloudflare') || finalSubUrl.includes('pixeldrain') || finalSubUrl.endsWith('.mp4'))) {
                    foundDirectLink = finalSubUrl;
                }

                await subPage.close();

                if (foundDirectLink) {
                    console.log(`✅ SUCCESS! Extracted Direct Link: ${foundDirectLink}`);
                    let qName = "HD";
                    if (wrap.text.match(/480p/i)) qName = "480p";
                    else if (wrap.text.match(/720p/i)) qName = "720p";
                    else if (wrap.text.match(/1080p/i)) qName = "1080p";
                    else if (wrap.text.match(/2160p|4k/i)) qName = "2160p";

                    let typeLabel = "Direct High-Speed Server";
                    if (foundDirectLink.includes('pixeldrain')) typeLabel = "PixelDrain";
                    else if (foundDirectLink.includes('cloudflarestorage')) typeLabel = "Cloudflare R2 Direct";

                    if (!downloads.some(d => d.link === foundDirectLink)) {
                        downloads.push({
                            quality: `WEB-DL ${qName} [${typeLabel}]`,
                            size: "N/A",
                            language: "English",
                            link: foundDirectLink
                        });
                    }
                } else {
                    console.log(`❌ FAILED to extract link from wrapper: ${wrap.href}`);
                }

            } catch (innerErr) {
                console.log(`⚠️ Error processing wrapper link: ${innerErr.message}`);
            }
        }

        await browser.close();
        console.log(`🏁 [DEBUGGER END] Total extracted downloads: ${downloads.length}`);
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
                    cast: [],
                    trailer: "https://www.youtube.com/@cinesubz",
                    year: "2026",
                    duration: "145 min",
                    downloads: downloads.length > 0 ? downloads : [{ quality: "HD [Telegram]", size: "N/A", language: "English", link: "https://t.me/CineSubzAdmin" }]
                }
            });
        }

    } catch (err) {
        if (browser) await browser.close();
        console.error(`❌ [API ERROR]: ${err.message}`);
        if (!res.headersSent) {
            res.status(500).json({ status: false, error: err.message });
        }
    }
});

app.listen(PORT, () => console.log(`Cinesubz Debugger API running on port ${PORT}`));
