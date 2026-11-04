const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://cinesubz.net/',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
};

// Root Endpoint
app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA PUPPETEER FULL INFODL & RESOLVER API 🚀",
        endpoints: {
            infodl: "/api/v1/cinesubz/infodl?url=movie_url",
            resolve: "/api/v1/cinesubz/resolve?url=zt_link_url"
        }
    });
});

// 🕵️‍♂️ Puppeteer Live Tracer & Network Interceptor for ZT-Links
const resolveZtLinkWithPuppeteer = async (ztUrl) => {
    console.log(`\n--------------------------------------------------`);
    console.log(`🚀 [PUPPETEER TRACE] Launching browser for: ${ztUrl}`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        
        let capturedDirectLink = '';

        // Network Request Interception to capture direct cloudflare/storage links
        page.on('request', (request) => {
            const reqUrl = request.url();
            if (reqUrl.includes('cloudflarestorage') || reqUrl.includes('pixeldrain') || reqUrl.includes('X-Amz-Signature') || reqUrl.includes('.mp4')) {
                console.log(`📡 [INTERCEPTED]: ${reqUrl}`);
                if (!capturedDirectLink) {
                    capturedDirectLink = reqUrl;
                }
            }
        });

        await page.goto(ztUrl, { waitUntil: 'networkidle2', timeout: 50000 });
        await new Promise(resolve => setTimeout(resolve, 4000));

        // Fallback to DOM scan if network event missed
        const domLink = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            for (let a of anchors) {
                const href = a.href || '';
                if (href.includes('cloudflarestorage') || href.includes('pixeldrain') || href.includes('X-Amz-Signature') || href.includes('.mp4')) {
                    return href;
                }
            }
            return null;
        });

        if (domLink && !capturedDirectLink) {
            capturedDirectLink = domLink;
            console.log(`🎯 [DOM SCRAPE MATCH]: ${domLink}`);
        }

        await browser.close();

        if (capturedDirectLink) {
            console.log(`✅ [RESOLVED]: ${capturedDirectLink}`);
            console.log(`--------------------------------------------------`);
            return capturedDirectLink;
        } else {
            console.log(`❌ [FAILED TO RESOLVE]`);
            console.log(`--------------------------------------------------`);
            return null;
        }

    } catch (err) {
        console.error(`❌ [PUPPETEER ERROR]: ${err.message}`);
        if (browser) await browser.close();
        console.log(`--------------------------------------------------`);
        return null;
    }
};

// 1. Standalone Resolver Endpoint
app.get('/api/v1/cinesubz/resolve', async (req, res) => {
    const ztUrl = req.query.url;
    if (!ztUrl) return res.status(400).json({ status: false, message: "ZT Link URL required" });

    const directLink = await resolveZtLinkWithPuppeteer(ztUrl);
    if (directLink) {
        let provider = "Direct High-Speed Server";
        if (directLink.includes('cloudflarestorage')) provider = "Cloudflare R2 Direct Server";
        else if (directLink.includes('pixeldrain')) provider = "PixelDrain Mirror";

        return res.json({
            status: true,
            creator: "@Imalsha",
            source: "puppeteer_resolver",
            count: 1,
            links: [{ provider, url: directLink }]
        });
    }

    res.status(404).json({ status: false, message: "Failed to resolve ZT-Link" });
});

// 2. Main Movie Info & Puppeteer Resolved Download Links Endpoint
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url || req.query.q;
    if (!movieUrl) return res.status(400).json({ status: false, message: "Movie URL required" });

    console.log(`\n⚡ [INFODL START] Processing movie details for: ${movieUrl}`);

    try {
        const movieRes = await axios.get(movieUrl, { headers: HEADERS, timeout: 25000 });
        const $ = cheerio.load(movieRes.data);

        const title = $('meta[property="og:title"]').attr('content') || $('h1').text().trim() || 'Unknown';
        const image = $('meta[property="og:image"]').attr('content') || '';
        const quality = $('.quality').first().text().trim() || 'WEB-DL';
        const rating = $('span.rating, .imdb-rate').first().text().trim() || '8.2';
        const imdb = rating !== 'N/A' ? `${rating} (IMDb)` : 'N/A';
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
            if (href.includes('zt-links') || href.includes('csplayer') || href.includes('space')) {
                wrapperLinks.push({ href, text });
            }
        });

        console.log(`📦 Found ${wrapperLinks.length} ZT-Links to resolve via Puppeteer...`);

        // Sequential or parallel resolution for movie qualities
        const downloads = [];
        for (let wrap of wrapperLinks) {
            const resolvedUrl = await resolveZtLinkWithPuppeteer(wrap.href);
            
            let qName = "HD";
            if (wrap.text.match(/480p/i)) qName = "480p";
            else if (wrap.text.match(/720p/i)) qName = "720p";
            else if (wrap.text.match(/1080p/i)) qName = "1080p";
            else if (wrap.text.match(/2160p|4k/i)) qName = "2160p";

            let typeLabel = "Direct High-Speed Server";
            if (resolvedUrl && resolvedUrl.includes('pixeldrain')) typeLabel = "PixelDrain";
            else if (resolvedUrl && resolvedUrl.includes('cloudflarestorage')) typeLabel = "Cloudflare R2 Direct";

            downloads.push({
                quality: `WEB-DL ${qName} [${typeLabel}]`,
                size: "N/A",
                language: "English",
                pay_link: resolvedUrl || wrap.href,
                link: wrap.href
            });
        }

        res.json({
            status: true,
            creator: "@Imalsha",
            site: "cinesubz",
            url: movieUrl,
            data: {
                title,
                image: image.trim(),
                quality,
                rating,
                imdb,
                director,
                language: "ENGLISH",
                genres: genres.length > 0 ? genres : ["Action", "Adventure", "Sinhala Subtitles"],
                story: story || 'No description available',
                cast: [],
                trailer: "https://www.youtube.com/@cinesubz",
                year: "2026",
                duration: "145 min",
                downloads
            }
        });

    } catch (err) {
        console.error(`❌ [INFODL ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Cinesubz Puppeteer Full API running on port ${PORT}`));
