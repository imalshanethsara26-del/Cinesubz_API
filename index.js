const express = require('express');
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
        message: "IMALSHA CINESUBZ ULTRA FAST API (No-Puppeteer Architecture) 🚀",
        endpoints: {
            latest: "/api/v1/cinesubz/latest?page=1",
            search: "/api/v1/cinesubz/search?q=movie_name",
            infodl: "/api/v1/cinesubz/infodl?url=movie_url",
            resolve: "/api/v1/cinesubz/resolve?url=zt_link_url"
        }
    });
});

// Helper: Fix & Normalize URLs
const resolveAbsoluteUrl = (extractedLink, targetPageUrl) => {
    if (!extractedLink) return '';
    try {
        if (extractedLink.startsWith('http://') || extractedLink.startsWith('https://')) {
            return extractedLink;
        }
        const parsedBase = new URL(targetPageUrl);
        if (extractedLink.startsWith('//')) {
            return `${parsedBase.protocol}${extractedLink}`;
        }
        if (extractedLink.startsWith('/')) {
            return `${parsedBase.protocol}//${parsedBase.host}${extractedLink}`;
        }
        return `${parsedBase.protocol}//${parsedBase.host}/${extractedLink}`;
    } catch (e) {
        return extractedLink;
    }
};

// Helper: Resolve ZT-Links using Axios Scraper Layer
const resolveZtLink = async (ztUrl) => {
    try {
        const response = await axios.get(ztUrl, {
            headers: HEADERS,
            timeout: 12000,
            maxRedirects: 5
        });

        const $ = cheerio.load(response.data);
        let rawLink = '';

        // 1. Scan anchor tags for CDN or Cloud Storage domains
        $('a').each((_, el) => {
            const href = $(el).attr('href') || '';
            if (
                href.includes('cloudflarestorage.com') ||
                href.includes('pixeldrain.com') ||
                href.includes('.mp4') ||
                href.includes('supercloud') ||
                href.includes('/server')
            ) {
                if (!rawLink) rawLink = href;
            }
        });

        // 2. Scan JavaScript variable blocks if link is obfuscated inside <script>
        if (!rawLink) {
            const scriptMatches = response.data.match(/https?:\/\/[^\s"'<>]+(?:cloudflarestorage|pixeldrain|\.mp4|supercloud)[^\s"'<>]+/i);
            if (scriptMatches) {
                rawLink = scriptMatches[0];
            } else {
                const relativeMatches = response.data.match(/["'](\/server[0-9]*\/[^\s"'<>]+)["']/i);
                if (relativeMatches) {
                    rawLink = relativeMatches[1];
                }
            }
        }

        // 3. Fallback to Response URL if server redirected directly
        if (!rawLink && response.request?.res?.responseUrl) {
            const finalUrl = response.request.res.responseUrl;
            if (!finalUrl.includes('zt-links')) {
                rawLink = finalUrl;
            }
        }

        if (rawLink) {
            return resolveAbsoluteUrl(rawLink, ztUrl);
        }
        return null;
    } catch (err) {
        return null;
    }
};

// 1. Latest Movies Endpoint
app.get('/api/v1/cinesubz/latest', async (req, res) => {
    try {
        const pageNum = req.query.page || 1;
        const latestUrl = pageNum == 1 ? "https://cinesubz.co/" : `https://cinesubz.co/page/${pageNum}/`;
        const response = await axios.get(latestUrl, { headers: HEADERS, timeout: 20000 });
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
        const response = await axios.get(searchUrl, { headers: HEADERS, timeout: 20000 });
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

// 3. Standalone Resolver Endpoint (Fast ZT Link Extractor)
app.get('/api/v1/cinesubz/resolve', async (req, res) => {
    const ztUrl = req.query.url;
    if (!ztUrl) return res.status(400).json({ status: false, message: "ZT Link URL required" });

    const directLink = await resolveZtLink(ztUrl);
    if (directLink) {
        let provider = "Direct High-Speed Server";
        if (directLink.includes('cloudflarestorage')) provider = "Cloudflare R2 Direct Server";
        else if (directLink.includes('pixeldrain')) provider = "PixelDrain Mirror";

        return res.json({
            status: true,
            creator: "@Imalsha",
            source: "fast_axios_resolver",
            count: 1,
            links: [{ provider, url: directLink }]
        });
    }

    res.status(404).json({ status: false, message: "Direct download link resolution failed" });
});

// 4. Main Movie Info & Instant Download Resolver Endpoint
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url || req.query.q;
    if (!movieUrl) return res.status(400).json({ status: false, message: "Movie URL required" });

    console.log(`⚡ [INSTANT API] Fetching details for: ${movieUrl}`);

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

        // Parallel resolution using Promise.all for high speed
        const downloadPromises = wrapperLinks.map(async (wrap) => {
            const resolvedUrl = await resolveZtLink(wrap.href);
            let qName = "HD";
            if (wrap.text.match(/480p/i)) qName = "480p";
            else if (wrap.text.match(/720p/i)) qName = "720p";
            else if (wrap.text.match(/1080p/i)) qName = "1080p";
            else if (wrap.text.match(/2160p|4k/i)) qName = "2160p";

            let typeLabel = "Direct High-Speed Server";
            if (resolvedUrl && resolvedUrl.includes('pixeldrain')) typeLabel = "PixelDrain";
            else if (resolvedUrl && resolvedUrl.includes('cloudflarestorage')) typeLabel = "Cloudflare R2 Direct";

            return {
                quality: `WEB-DL ${qName} [${typeLabel}]`,
                size: "N/A",
                language: "English",
                pay_link: resolvedUrl || wrap.href,
                link: wrap.href
            };
        });

        const downloads = await Promise.all(downloadPromises);

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
        console.error(`❌ [API ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Cinesubz Fast Resolver API is online on port ${PORT}`));
