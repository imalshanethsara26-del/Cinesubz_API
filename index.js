const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA CINESUBZ NETWORK INTERCEPTOR API is Live 🚀",
        endpoint: "/api/v1/cinesubz/infodl?url=movie_url"
    });
});

app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    console.log(`\n==============================================`);
    console.log(`🕵️‍♂️ [INTERCEPTOR] Launching headless browser for: ${movieUrl}`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

        const capturedLinks = [];

        // 🔍 LISTEN TO ALL NETWORK REQUESTS & RESPONSES
        page.on('response', async (response) => {
            const reqUrl = response.url();
            const lowerUrl = reqUrl.toLowerCase();

            // Check if response contains direct download servers or wrappers
            if (
                lowerUrl.includes('pixeldrain') ||
                lowerUrl.includes('supercloud') ||
                lowerUrl.includes('drive7') ||
                lowerUrl.includes('csplayer') ||
                lowerUrl.includes('zt-links') ||
                lowerUrl.includes('telegram')
            ) {
                console.log(`🎯 [INTERCEPTED URL]: ${reqUrl}`);
                if (!capturedLinks.includes(reqUrl)) {
                    capturedLinks.push(reqUrl);
                }
            }
        });

        // Go to movie page
        await page.goto(movieUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait a few seconds for async scripts/ajax to load
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Try to click any download or wrapper buttons automatically if found
        try {
            const downloadBtnSelectors = ['.download-button', '.zt-link', 'a[href*="zt-links"]', 'a[href*="csplayer"]'];
            for (const sel of downloadBtnSelectors) {
                const elements = await page.$$(sel);
                for (const el of elements) {
                    await el.click().catch(() => {});
                }
            }
            await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (e) {
            console.log(`⚠️ Click simulation notice: ${e.message}`);
        }

        await browser.close();

        console.log(`🎉 Total Intercepted Links: ${capturedLinks.length}`);
        console.log(`==============================================\n`);

        res.json({
            status: true,
            creator: "@Imalsha",
            url: movieUrl,
            intercepted_links: capturedLinks
        });

    } catch (err) {
        if (browser) await browser.close();
        console.error(`❌ [INTERCEPTOR ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Interceptor API running on port ${PORT}`));
