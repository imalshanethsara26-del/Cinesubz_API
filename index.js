const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA CINESUBZ NATIVE PUPPETEER API is Live 🚀",
        endpoint: "/api/v1/cinesubz/extract?url=movie_page_url"
    });
});

app.get('/api/v1/cinesubz/extract', async (req, res) => {
    const movieUrl = req.query.url || "https://cinesubz.net/movies/spider-man-brand-new-day-2026-sinhala-subtitles/";
    
    console.log(`\n==============================================`);
    console.log(`🚀 [NATIVE PUPPETEER] Processing: ${movieUrl}`);
    console.log(`==============================================`);

    let browser = null;

    try {
        // 1. Launch Headless Browser (Optimized for Render environment)
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        
        // Set realistic User-Agent & Viewport
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 800 });

        console.log(`🌐 Navigating to movie page...`);
        await page.goto(movieUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Extract Movie Title
        const title = await page.evaluate(() => {
            const h1 = document.querySelector('h1.entry-title, h1.title, h1');
            return h1 ? h1.innerText.trim() : document.title;
        });

        console.log(`🎯 Movie Title: "${title}"`);

        // 2. Find the download trigger link (e.g. api redirect link)
        console.log(`🔍 Searching for download trigger links...`);
        const downloadTriggerUrl = await page.evaluate(() => {
            const btn = document.querySelector('a.button, a.link-btn, .download-links a, a[href*="/api/"], a[href*="csplayer"]');
            return btn ? btn.href : null;
        });

        let downloadLinks = [];

        if (downloadTriggerUrl) {
            console.log(`🔗 Found trigger link: ${downloadTriggerUrl}`);
            console.log(`⏳ Navigating to redirect/timer page and waiting for countdown...`);
            
            // Go to the redirect page
            await page.goto(downloadTriggerUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Wait for 5 seconds to let the timer run and the final player page (csplayer2.space) to load
            await new Promise(r => setTimeout(r, 5000));

            // Scrape final download links from the resolved page
            downloadLinks = await page.evaluate(() => {
                const links = [];
                document.querySelectorAll('a').forEach(a => {
                    const href = a.href;
                    const text = a.innerText.trim();
                    if (href && !href.startsWith('#')) {
                        const isFileHost = 
                            href.includes('pixeldrain') || 
                            href.includes('megaup') || 
                            href.includes('drive.google') || 
                            href.includes('1drv.ms') || 
                            href.includes('terabox') ||
                            href.includes('t.me/') ||
                            href.includes('download');

                        if (isFileHost) {
                            if (!links.some(l => l.href === href)) {
                                links.push({ text: text || 'Download Link', href });
                            }
                        }
                    }
                });
                return links;
            });
        } else {
            console.log(`⚠️ Trigger link not found directly, scanning current page...`);
            downloadLinks = await page.evaluate(() => {
                const links = [];
                document.querySelectorAll('a').forEach(a => {
                    const href = a.href;
                    const text = a.innerText.trim();
                    if (href && !href.startsWith('#')) {
                        if (href.includes('pixeldrain') || href.includes('megaup') || href.includes('drive.google') || href.includes('terabox') || href.includes('t.me/')) {
                            if (!links.some(l => l.href === href)) {
                                links.push({ text: text || 'Download Link', href });
                            }
                        }
                    }
                });
                return links;
            });
        }

        await browser.close();
        console.log(`🎉 Successfully extracted ${downloadLinks.length} actual download links!`);
        console.log(`==============================================\n`);

        res.json({
            status: true,
            creator: "@Imalsha",
            movie_url: movieUrl,
            title: title,
            links_count: downloadLinks.length,
            links: downloadLinks
        });

    } catch (err) {
        if (browser) await browser.close();
        console.error(`❌ [PUPPETEER ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Native Puppeteer API running on port ${PORT}`));
