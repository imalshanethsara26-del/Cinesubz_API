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
    res.json({ status: true, message: "Debug Puppeteer API is Live 🚀" });
});

app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    console.log(`\n==================================================`);
    console.log(`🔍 [DEBUG START] Scanning Movie URL: ${movieUrl}`);
    console.log(`==================================================`);

    let browser;
    try {
        browser = await getBrowser();
        const page = await browser.newPage();
        
        // සැබෑ බ්‍රව්සරයක් ලෙස පෙනී සිටීමට User-Agent සහ Viewport සැකසීම
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 800 });

        console.log(`👉 [Step 1] Navigating to movie page...`);
        const response = await page.goto(movieUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log(`   ✅ Navigation Status: ${response ? response.status() : 'Unknown'}`);

        // පේජ් එකේ මාතෘකාව සහ zt-links සොයා ගැනීම
        const pageData = await page.evaluate(() => {
            const title = document.querySelector('meta[property="og:title"]')?.content || document.querySelector('h1')?.innerText || 'Unknown';
            
            const ztLinks = [];
            document.querySelectorAll('a').forEach(a => {
                const href = a.href;
                if (href && (href.includes('/zt-links/') || href.includes('zt-links'))) {
                    const parentText = a.parentElement ? a.parentElement.innerText : '';
                    ztLinks.push({ url: href, text: a.innerText + ' ' + parentText });
                }
            });

            // සියලුම a ටැග්ස් පරීක්ෂා කරමු (zt-links නැත්නම් වෙනත් ඒවා තියෙනවද බැලීමට)
            const allLinksCount = document.querySelectorAll('a').length;

            return { title, ztLinks, allLinksCount };
        });

        console.log(`   📌 Movie Title: ${pageData.title}`);
        console.log(`   🔗 Total Links on Page: ${pageData.allLinksCount}`);
        console.log(`   🎯 Found ZT-Links: ${pageData.ztLinks.length}`);
        
        if (pageData.ztLinks.length > 0) {
            pageData.ztLinks.forEach((item, i) => {
                console.log(`      [${i + 1}] URL: ${item.url} | Text: ${item.text.trim().substring(0, 40)}`);
            });
        } else {
            console.log(`   ⚠️ [WARNING] No ZT-Links found! Checking raw HTML snippet...`);
            const htmlSnippet = await page.evaluate(() => document.body.innerHTML.substring(0, 500));
            console.log(`   📄 HTML Snippet:`, htmlSnippet);
        }

        const downloads = [];

        // එක් එක් zt-link එක ඇතුළට යාම
        for (let i = 0; i < pageData.ztLinks.length; i++) {
            const item = pageData.ztLinks[i];
            let ztPage;
            try {
                console.log(`\n--------------------------------------------------`);
                console.log(`🔄 [Step 2.${i + 1}] Opening ZT-Link: ${item.url}`);
                
                ztPage = await browser.newPage();
                await ztPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
                
                const ztRes = await ztPage.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
                console.log(`   ✅ ZT Page Status: ${ztRes ? ztRes.status() : 'Unknown'}`);

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

                console.log(`   🔗 Resolved Redirect URL: ${redirectUrl || 'NONE FOUND'}`);

                if (redirectUrl) {
                    console.log(`   👉 [Step 3] Navigating to Final Redirect Page: ${redirectUrl}`);
                    const finalPage = await browser.newPage();
                    await finalPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
                    
                    await finalPage.goto(redirectUrl, { waitUntil: 'networkidle2', timeout: 25000 });
                    const fullHtml = await finalPage.content();

                    const linkRegex = /https?:\/\/[^\s"'<>]+\b(?:pixeldrain\.com|supercloud2\.space|kdrive\d*\.supercloud\d*\.space|t\.me|telegram\.me|drive|download|stream)[^\s"'<>]*/gi;
                    const matches = fullHtml.match(linkRegex) || [];
                    console.log(`   🎯 Regex found ${matches.length} potential links on final page.`);

                    const qMatch = item.text.match(/(2160p|4K|1080p|720p|480p|BluRay|WEB-DL|HDRip)/i);
                    const qualityName = qMatch ? qMatch[0].toUpperCase() : "WEB-DL";
                    const sMatch = item.text.match(/(\d+(\.\d+)?\s*(GB|MB))/i);
                    const size = sMatch ? sMatch[0] : "N/A";

                    matches.forEach(link => {
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
                            downloads.push({ quality: qualityLabel, size, language: "English", link });
                            console.log( + link);
                        }
                    });

                    await finalPage.close();
                }
                await ztPage.close();
            } catch (ztErr) {
                console.log(`   ❌ [ERROR in ZT Loop]: ${ztErr.message}`);
                if (ztPage) await ztPage.close();
            }
        }

        await browser.close();

        console.log(`\n==================================================`);
        console.log(`🎉 [DEBUG COMPLETE] Total Downloads Extracted: ${downloads.length}`);
        console.log(`==================================================\n`);

        res.json({
            status: true,
            creator: "@Imalsha",
            url: movieUrl,
            downloads_count: downloads.length,
            downloads
        });

    } catch (err) {
        console.log(`❌ [FATAL ERROR]: ${err.message}`);
        if (browser) await browser.close();
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log("Debug Puppeteer API running on port " + PORT));
