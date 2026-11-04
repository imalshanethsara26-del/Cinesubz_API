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
            let title = $(el).find('h2, h3, .title').text().trim() || $(el).attr('title') || $(el).text().trim();
            let img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || parent.find('img').attr('src') || '';
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
            let title = $(el).find('h2, h3, .title').text().trim() || $(el).attr('title') || $(el).text().trim();
            let img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || parent.find('img').attr('src') || '';
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

// 3. Info & Download Endpoint (Live SSE Stream + Auto-Clicker & Deep Link Extractor)
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendLog = (msg) => {
        console.log(msg);
        res.write(`data: ${JSON.stringify({ log: msg })}\n\n`);
    };

    sendLog(`\n==============================================`);
    sendLog(`🔍 [AUTO-CLICK LIVE STREAM] Processing: ${movieUrl}`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

        sendLog(`1️⃣ Navigating to movie page...`);
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

        sendLog(`📦 Found ${wrapperLinks.length} wrapper links.`);

        const downloads = [];

        for (const wrap of wrapperLinks) {
            sendLog(`\n----------------------------------------------`);
            sendLog(`🚀 Scanning wrapper: ${wrap.href} (Text: ${wrap.text})`);
            
            try {
                const subPage = await browser.newPage();
                let foundDirectLink = '';

                // Intercept network requests to catch storage/mp4/pixeldrain links
                subPage.on('response', async response => {
                    const rUrl = response.url();
                    if (rUrl.includes('cloudflarestorage') || rUrl.includes('pixeldrain') || rUrl.includes('.mp4') || rUrl.includes('token=')) {
                        if (!foundDirectLink) foundDirectLink = rUrl;
                        sendLog(`🎯 [NETWORK MATCH] ${rUrl}`);
                    }
                });

                await subPage.goto(wrap.href, { waitUntil: 'networkidle2', timeout: 30000 });
                sendLog(`⏳ Waiting for countdown timer to finish...`);
                await new Promise(r => setTimeout(r, 5000)); // Wait for timer

                // 🖱️ AUTO CLICK THE DOWNLOAD / GO TO PAGE BUTTON
                try {
                    const downloadBtnSelector = 'a.btn, button, a[href*="csplayer"], a[href*="space"], #download, .btn-download, a';
                    await subPage.waitForSelector(downloadBtnSelector, { timeout: 4000 });
                    
                    const clicked = await subPage.evaluate(() => {
                        // Find button or anchor that looks like a download/go button
                        let buttons = document.querySelectorAll('a, button');
                        for (let btn of buttons) {
                            let text = btn.innerText.toLowerCase();
                            if (text.includes('download') || text.includes('go to') || text.includes('click') || text.includes('proceed')) {
                                btn.click();
                                return true;
                            }
                        }
                        // If no specific text found, click the first main anchor/button
                        if (buttons.length > 0) {
                            buttons[0].click();
                            return true;
                        }
                        return false;
                    });

                    if (clicked) {
                        sendLog(`🖱️ Successfully auto-clicked download/redirect button!`);
                        await new Promise(r => setTimeout(r, 4000)); // Wait for redirect/load after click
                    }
                } catch (clickErr) {
                    sendLog(`⚠️ Auto-click warning: ${clickErr.message}`);
                }

                // Check page scripts for hidden URLs
                const pageScripts = await subPage.evaluate(() => {
                    let scripts = document.querySelectorAll('script');
                    let code = '';
                    scripts.forEach(s => code += s.innerHTML + '\n');
                    return code;
                });

                const urlMatch = pageScripts.match(/https?:\/\/[^\s"'<>]+(?:cloudflarestorage|pixeldrain|\.mp4|token=)[^\s"'<>]+/i);
                if (urlMatch && !foundDirectLink) {
                    foundDirectLink = urlMatch[0];
                    sendLog(`💡 [JS SCRIPT MATCH] ${foundDirectLink}`);
                }

                // Check final elements on page
                const subHtml = await subPage.content();
                const $sub = cheerio.load(subHtml);

                if (!foundDirectLink) {
                    $sub('a').each((_, subEl) => {
                        const shref = $sub(subEl).attr('href') || '';
                        if (shref.includes('cloudflarestorage.com') || shref.includes('pixeldrain.com') || shref.includes('.mp4') || shref.includes('token=')) {
                            foundDirectLink = shref;
                        }
                    });
                }

                await subPage.close();

                if (foundDirectLink) {
                    sendLog(`✅ SUCCESS Direct Link: ${foundDirectLink}`);
                    let qName = wrap.text.match(/720p/i) ? "720p" : wrap.text.match(/1080p/i) ? "1080p" : wrap.text.match(/480p/i) ? "480p" : "HD";
                    let typeLabel = foundDirectLink.includes('pixeldrain') ? "PixelDrain" : "Cloudflare R2 Direct";

                    if (!downloads.some(d => d.link === foundDirectLink)) {
                        downloads.push({
                            quality: `WEB-DL ${qName} [${typeLabel}]`,
                            size: "N/A",
                            language: "English",
                            link: foundDirectLink
                        });
                    }
                } else {
                    sendLog(`❌ FAILED: No direct link found for this wrapper.`);
                }
            } catch (innerErr) {
                sendLog(`⚠️ Inner scan error: ${innerErr.message}`);
            }
        }

        await browser.close();
        sendLog(`🏁 Process Completed. Total Valid Links: ${downloads.length}`);

        const finalData = {
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
        };

        res.write(`data: ${JSON.stringify({ result: finalData })}\n\n`);
        res.end();

    } catch (err) {
        if (browser) await browser.close();
        sendLog(`❌ [API ERROR]: ${err.message}`);
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
    }
});

app.listen(PORT, () => console.log(`Cinesubz Auto-Click API running on port ${PORT}`));
