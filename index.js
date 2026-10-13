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
        message: "IMALSHA CINESUBZ API is Live 🚀",
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

            if (href.includes('cinesubz.net') && (href.includes('/movies/') || href.includes('/tvshows/')) && title.length > 2) {
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

            if (href.includes('cinesubz.net') && (href.includes('/movies/') || href.includes('/tvshows/')) && title.length > 2) {
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

// 3. Info & Download Endpoint (Deep extraction: Enters zt-links and extracts actual Direct/PixelDrain file links)
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    console.log(`\n==============================================`);
    console.log(`🔍 [API LOG] Processing InfoDL Request for: ${movieUrl}`);

    let browser;
    try {
        browser = await getBrowser();
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 800 });

        await page.goto(movieUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });

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

            // Grab zt-links
            const ztLinks = [];
            document.querySelectorAll('a').forEach(a => {
                const href = a.href || '';
                const txt = (a.innerText || '') + ' ' + (a.parentElement ? a.parentElement.innerText : '');
                
                if (href && (href.includes('zt-links') || href.includes('download'))) {
                    if (!href.includes('account') && !href.includes('cinesubz.net/movies/') && !href.includes('cinesubz.lk/movies/')) {
                        if (!ztLinks.some(d => d.url === href)) {
                            ztLinks.push({ url: href, text: txt });
                        }
                    }
                }
            });

            return { title, image, quality, rating, director, story: story || 'No description available', ztLinks };
        });

        console.log(`🎬 Title: ${pageData.title}`);
        console.log(`🔗 Found ${pageData.ztLinks.length} zt-link(s).`);

        let year = "2026";
        const yearMatch = pageData.title.match(/\((\d{4})\)/);
        if (yearMatch) year = yearMatch[1];

        const downloads = [];

        for (let i = 0; i < pageData.ztLinks.length; i++) {
            const item = pageData.ztLinks[i];
            console.log(`\n⏳ Checking ZT-Link ${i + 1}/${pageData.ztLinks.length}: ${item.url}`);
            
            let subPage;
            try {
                subPage = await browser.newPage();
                await subPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
                
                await subPage.goto(item.url, { waitUntil: 'networkidle2', timeout: 25000 }).catch(() => {});
                await new Promise(r => setTimeout(r, 2000));

                // Extract all outbound links inside the ZT page (this usually contains csplayer/space or direct file links)
                const intermediateLinks = await subPage.evaluate(() => {
                    const list = [];
                    document.querySelectorAll('a').forEach(a => {
                        const h = a.href || '';
                        const t = (a.innerText || '').trim();
                        if (h && !h.includes('cinesubz')) {
                            list.push({ href: h, text: t });
                        }
                    });
                    return list;
                });

                const qMatch = item.text.match(/(2160p|4K|1080p|720p|480p|BluRay|WEB-DL|WEBRip|HDRip)/i);
                const qualityName = qMatch ? qMatch[0].toUpperCase() : "WEB-DL";
                const sMatch = item.text.match(/(\d+(\.\d+)?\s*(GB|MB))/i);
                const size = sMatch ? sMatch[0] : "N/A";

                // Now, if the link points to a player/space page, let's deep-dive one step further to get the real file link!
                for (let j = 0; j < intermediateLinks.length; j++) {
                    const intLink = intermediateLinks[j].href;

                    if (intLink.includes('pixeldrain') || intLink.endsWith('.mp4') || intLink.endsWith('.mkv') || intLink.includes('telegram.me') || intLink.includes('t.me')) {
                        // Direct file / bot link found immediately
                        let type = "Direct Server";
                        if (intLink.includes('pixeldrain')) type = "PixelDrain";
                        else if (intLink.includes('t.me/')) type = "Telegram Bot";

                        const qualityLabel = qualityName + " [" + type + "]";
                        if (!downloads.some(d => d.link === intLink)) {
                            downloads.push({ quality: qualityLabel, size, language: "English", link: intLink });
                            console.log(`   ✅ Direct File Link Found: [${qualityLabel}] -> ${intLink}`);
                        }
                    } else if (intLink.includes('space') || intLink.includes('kdrive') || intLink.includes('csplayer')) {
                        // It's a player page, let's open it to grab the actual download button link inside it!
                        console.log(`   🚀 Entering Player Page: ${intLink}`);
                        let playerPage;
                        try {
                            playerPage = await browser.newPage();
                            await playerPage.goto(intLink, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
                            await new Promise(r => setTimeout(r, 1500));

                            const realFileLinks = await playerPage.evaluate(() => {
                                const rList = [];
                                document.querySelectorAll('a').forEach(el => {
                                    const h = el.href || '';
                                    const txt = (el.innerText || '').toLowerCase();
                                    if (h && (txt.includes('download') || h.includes('pixeldrain') || h.endsWith('.mp4') || h.endsWith('.mkv'))) {
                                        rList.push(h);
                                    }
                                });
                                return rList;
                            });

                            playerPage.close();

                            realFileLinks.forEach(rfLink => {
                                if (rfLink.includes('cinesubz')) return;
                                let type = "Direct High-Speed Server";
                                if (rfLink.includes('pixeldrain')) type = "PixelDrain";

                                const qualityLabel = qualityName + " [" + type + "]";
                                if (!downloads.some(d => d.link === rfLink)) {
                                    downloads.push({ quality: qualityLabel, size, language: "English", link: rfLink });
                                    console.log(`   ✅ Extracted Real File from Player: [${qualityLabel}] -> ${rfLink}`);
                                }
                            });
                        } catch (pe) {
                            if (playerPage) await playerPage.close();
                        }
                    }
                }

                await subPage.close();
            } catch (subErr) {
                console.error(`   ❌ Failed to scrape ZT-page: ${subErr.message}`);
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
        console.error(`❌ Critical InfoDL Error: ${err.message}`);
        if (browser) await browser.close();
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Cinesubz API running on port ${PORT}`));
