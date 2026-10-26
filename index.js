const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA CINESUBZ SMART PUPPETEER API is Live 🚀",
        endpoint: "/api/v1/cinesubz/extract?url=movie_page_url"
    });
});

app.get('/api/v1/cinesubz/extract', async (req, res) => {
    const movieUrl = req.query.url || "https://cinesubz.net/movies/spider-man-brand-new-day-2026-sinhala-subtitles/";
    
    console.log(`\n==============================================`);
    console.log(`🚀 [SMART PUPPETEER] Processing: ${movieUrl}`);
    console.log(`==============================================`);

    let browser = null;

    try {
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
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 800 });

        console.log(`🌐 Navigating to movie page...`);
        await page.goto(movieUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const title = await page.evaluate(() => {
            const h1 = document.querySelector('h1.entry-title, h1.title, h1');
            return h1 ? h1.innerText.trim() : document.title;
        });

        console.log(`🎯 Movie Title: "${title}"`);

        // 1. Find the actual movie download trigger link (Strictly filtering out ads & badges)
        console.log(`🔍 Searching for real movie download buttons...`);
        const downloadTriggerUrl = await page.evaluate(() => {
            const allLinks = Array.from(document.querySelectorAll('a'));
            
            // Find a link that is inside the movie content and matches download criteria
            const target = allLinks.find(a => {
                const href = a.href || '';
                const text = (a.innerText || '').toLowerCase();
                
                // EXCLUDE ADS & BADGES DEFINITELY
                if (
                    href.includes('bestweb.lk') || 
                    href.includes('1xbet') || 
                    href.includes('facebook.com') || 
                    href.includes('whatsapp.com') ||
                    href.includes('t.me/share')
                ) {
                    return false;
                }

                // MUST be a valid movie download trigger (has resolution text or download keyword)
                const isMovieDownloadBtn = 
                    text.includes('download') || 
                    text.includes('webrip') || 
                    text.includes('hd') || 
                    text.includes('720p') || 
                    text.includes('1080p') || 
                    href.includes('/api/') || 
                    href.includes('csplayer');

                return isMovieDownloadBtn;
            });

            return target ? target.href : null;
        });

        let downloadLinks = [];

        if (downloadTriggerUrl) {
            console.log(`🔗 Found valid download trigger link: ${downloadTriggerUrl}`);
            console.log(`⏳ Navigating to redirect/timer page...`);
            
            await page.goto(downloadTriggerUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Wait for 5 seconds for the timer and player page to load
            await new Promise(r => setTimeout(r, 5000));

            // Scrape final host links (Pixeldrain, Direct, Telegram)
            downloadLinks = await page.evaluate(() => {
                const links = [];
                document.querySelectorAll('a').forEach(a => {
                    const href = a.href || '';
                    const text = a.innerText.trim();
                    
                    if (href && !href.startsWith('#')) {
                        // EXCLUDE ANY JUNK ON THE REDIRECT PAGE TOO
                        if (href.includes('bestweb.lk') || href.includes('1xbet')) return;

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
            console.log(`⚠️ Trigger link not found directly, scanning page content...`);
            downloadLinks = await page.evaluate(() => {
                const links = [];
                document.querySelectorAll('a').forEach(a => {
                    const href = a.href || '';
                    const text = a.innerText.trim();
                    
                    if (href && !href.startsWith('#')) {
                        if (href.includes('bestweb.lk') || href.includes('1xbet')) return;

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

app.listen(PORT, () => console.log(`Smart Puppeteer API running on port ${PORT}`));
