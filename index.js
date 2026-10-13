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
            '--disable-gpu'
        ]
    });
}

app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "Advanced Puppeteer Cinesubz API is Live 🚀",
        endpoint: "/api/v1/cinesubz/infodl?url=movie_url"
    });
});

app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    let browser;
    try {
        console.log("🚀 [Advanced Puppeteer] Starting scan for:", movieUrl);
        browser = await getBrowser();
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

        await page.goto(movieUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Metadata සහ zt-links එකතු කරගැනීම
        const data = await page.evaluate(() => {
            const title = document.querySelector('meta[property="og:title"]')?.content || document.querySelector('h1')?.innerText || 'Unknown Movie';
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
                if (href && href.includes('/zt-links/')) {
                    const parentText = a.parentElement ? a.parentElement.innerText : '';
                    ztLinks.push({ url: href, text: a.innerText + ' ' + parentText });
                }
            });

            return { title, image, quality, rating, director, story: story || 'No description available', ztLinks };
        });

        let year = "2026";
        const yearMatch = data.title.match(/\((\d{4})\)/);
        if (yearMatch) year = yearMatch[1];

        const downloads = [];

        // Zt-links හරහා ගොස් අවසාන පේජ් එකේ HTML/Scripts සම්පූර්ණයෙන් ස්කෑන් කිරීම
        for (const item of data.ztLinks) {
            let ztPage;
            try {
                ztPage = await browser.newPage();
                await ztPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
                await ztPage.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 20000 });

                const redirectUrl = await ztPage.evaluate(() => {
                    let found = '';
                    document.querySelectorAll('a').forEach(a => {
                        const h = a.href;
                        if (h && !h.includes('cinesubz.lk') && (h.includes('space') || h.includes('redirect') || h.startsWith('http'))) {
                            found = h;
                        }
                    });
                    return found;
                });

                if (redirectUrl) {
                    const finalPage = await browser.newPage();
                    await finalPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
                    await finalPage.goto(redirectUrl, { waitUntil: 'networkidle2', timeout: 25000 });

                    // මුළු පේජ් එකේ HTML සහ ස්ක්‍රිප්ට් කෝඩ් එක ලබා ගැනීම
                    const fullHtml = await finalPage.content();

                    // Regex මඟින් PixelDrain, SuperCloud, Telegram Bot සහ Direct Server ලින්ක්ස් සියල්ල එකතු කිරීම
                    const linkRegex = /https?:\/\/[^\s"'<>]+\b(?:pixeldrain\.com|supercloud2\.space|kdrive\d*\.supercloud\d*\.space|t\.me|telegram\.me|drive|download|stream)[^\s"'<>]*/gi;
                    const matches = fullHtml.match(linkRegex) || [];

                    const qMatch = item.text.match(/(2160p|4K|1080p|720p|480p|BluRay|WEB-DL|HDRip)/i);
                    const qualityName = qMatch ? qMatch[0].toUpperCase() : "WEB-DL";
                    const sMatch = item.text.match(/(\d+(\.\d+)?\s*(GB|MB))/i);
                    const size = sMatch ? sMatch[0] : "N/A";

                    matches.forEach(link => {
                        // URL සනීපාරක්ෂාව (Cleaning URL quotes if caught)
                        link = link.replace(/["'>]/g, '');

                        if (link.includes('cinesubz.lk') || link.includes('telegram.org')) return;

                        let isBotLink = link.includes('t.me/') || link.includes('telegram.me/');
                        if (isBotLink && !link.includes('bot') && !link.includes('start=')) return;

                        let type = "Direct Server";
                        if (link.includes('pixeldrain')) type = "PixelDrain";
                        else if (isBotLink) type = "Telegram Bot";
                        else if (link.includes('space') || link.includes('kdrive')) type = "Direct High-Speed Server";

                        const qualityLabel = qualityName + " [" + type + "]";
                        if (!downloads.some(d => d.link === link)) {
                            downloads.push({
                                quality: qualityLabel,
                                size: size,
                                language: "English",
                                link: link
                            });
                        }
                    });

                    await finalPage.close();
                }
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
                title: data.title,
                image: data.image,
                quality: data.quality,
                rating: data.rating,
                imdb: data.rating + " (N/A)",
                director: data.director,
                language: "ENGLISH",
                genres: ["Action", "Adventure", "English", "Sinhala Subtitles"],
                story: data.story,
                cast: [],
                gallery: [],
                trailer: "https://www.youtube.com/@cinesubz",
                year,
                duration: "N/A",
                tag: "English",
                directors: data.director,
                stars: "N/A",
                country: "Sri Lanka / Global",
                downloads
            }
        });

    } catch (err) {
        if (browser) await browser.close();
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log("Advanced Puppeteer API running on port " + PORT));
