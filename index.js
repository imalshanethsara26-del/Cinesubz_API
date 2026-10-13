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
    res.json({ status: true, message: "Final Cinesubz API is Live 🚀" });
});

app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    console.log(`\n==================================================`);
    console.log(`🚀 [JOB START] Target URL: ${movieUrl}`);
    console.log(`==================================================`);

    let browser;
    try {
        browser = await getBrowser();
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 800 });

        console.log(`👉 Navigating to Main Movie Page...`);
        const response = await page.goto(movieUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log(`   ✅ Main Page Status: ${response ? response.status() : 'Unknown'}`);

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

        console.log(`   📌 Movie Title Found: ${pageData.title}`);
        console.log(`   🔗 Found ZT-Links Count: ${pageData.ztLinks.length}`);

        let year = "2026";
        const yearMatch = pageData.title.match(/\((\d{4})\)/);
        if (yearMatch) year = yearMatch[1];

        const downloads = [];

        for (let i = 0; i < pageData.ztLinks.length; i++) {
            const item = pageData.ztLinks[i];
            let ztPage;
            try {
                console.log(`\n--------------------------------------------------`);
                console.log(`🔄 Processing ZT-Link [${i + 1}]: ${item.url}`);
                
                ztPage = await browser.newPage();
                await ztPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
                
                await ztPage.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 20000 });

                // ZT පේජ් එකෙන් Direct Server / Redirect / Pixeldrain ලින්ක්ස් සෘජුවම අල්ලා ගැනීම
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

                console.log(`   🔗 Found Links inside ZT page: ${foundLinks.length}`);

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
                        console.log(`   🎯 [CAPTURED]: ${qualityLabel} -> ${link}`);
                    }
                });

                await ztPage.close();
            } catch (ztErr) {
                console.log(`   ❌ [ERROR]: ${ztErr.message}`);
                if (ztPage) await ztPage.close();
            }
        }

        await browser.close();

        console.log(`\n==================================================`);
        console.log(`🎉 [COMPLETED] Total Downloads Extracted: ${downloads.length}`);
        console.log(`==================================================\n`);

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
        console.log(`❌ [FATAL ERROR]: ${err.message}`);
        if (browser) await browser.close();
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log("Final Cinesubz API running on port " + PORT));
