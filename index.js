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
    'Accept-Language': 'en-US,en;q=0.9'
};

app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA CINESUBZ ULTIMATE EXTRACTOR API is Live 🚀",
        endpoint: "/api/v1/cinesubz/extract?url=movie_page_url"
    });
});

// Ultimate Multi-Method Extractor
app.get('/api/v1/cinesubz/extract', async (req, res) => {
    const movieUrl = req.query.url || "https://cinesubz.net/movies/spider-man-brand-new-day-2026-sinhala-subtitles/";
    
    console.log(`\n==================================================`);
    console.log(`🚀 [ULTIMATE START] Processing URL: ${movieUrl}`);
    console.log(`==================================================`);

    let postId = null;
    let movieTitle = "";
    let moviePoster = "";
    let downloadLinks = [];
    let methodUsed = "";

    try {
        // STEP 1: Fetching page to extract Post ID, Title, and Poster
        console.log(`\n🔍 [STEP 1] Fetching target page HTML...`);
        const htmlRes = await axios.get(movieUrl, { headers: HEADERS, timeout: 20000 });
        const $ = cheerio.load(htmlRes.data);

        movieTitle = $('h1.entry-title, h1.title, .s-item-title h1').text().trim() || $('title').text();
        moviePoster = $('img.attachment-post-thumbnail, .poster img, .s-item-cover img').attr('src'] || '';

        // Extracting Post ID from body class or shortlink
        const bodyClass = $('body').attr('class') || '';
        const match = bodyClass.match(/postid-(\d+)/);
        if (match && match[1]) {
            postId = match[1];
        } else {
            const shortlink = $('link[rel="shortlink"]').attr('href') || '';
            const pMatch = shortlink.match(/\?p=(\d+)/);
            if (pMatch && pMatch[1]) postId = pMatch[1];
        }

        console.log(`🎯 [STEP 1 RESULT] Extracted Title: "${movieTitle}"`);
        console.log(`🎯 [STEP 1 RESULT] Extracted Post ID: ${postId || 'Not Found'}`);

        // METHOD A: Try Zeta Player / Source API if Post ID exists
        if (postId) {
            console.log(`\n🔄 [METHOD A] Attempting Zeta Player API with ID: ${postId}...`);
            try {
                const zetaUrl = `https://cinesubz.net/wp-json/zetaplayer/v2/movie/${postId}`;
                const zetaRes = await axios.get(zetaUrl, { headers: HEADERS, timeout: 15000 });
                
                if (zetaRes.data && (zetaRes.data.embed_url || zetaRes.data.play_url || Array.isArray(zetaRes.data))) {
                    downloadLinks.push({ type: 'zeta_api', data: zetaRes.data });
                    methodUsed = "Zeta Player API";
                    console.log(`✅ [METHOD A SUCCESS] Retrieved data from Zeta Player API!`);
                } else {
                    console.log(`⚠️ [METHOD A EMPTY] Zeta API returned empty payload.`);
                }
            } catch (errA) {
                console.log(`❌ [METHOD A FAILED]: ${errA.message}`);
            }
        }

        // METHOD B: Direct HTML & Button Scraping (Fallback 1)
        if (downloadLinks.length === 0) {
            console.log(`\n🔄 [METHOD B] Attempting Direct HTML Button & Link Scrape...`);
            
            $('a.button, a.link-btn, .download-links a, .s-dist-btn, .links_table a, .m-movies-links a, .wp-block-button__link').each((i, el) => {
                const text = $(el).text().trim();
                const href = $(el).attr('href');
                if (href && !href.includes('#') && !downloadLinks.some(l => l.href === href)) {
                    downloadLinks.push({ text, href });
                }
            });

            if (downloadLinks.length > 0) {
                methodUsed = "Direct HTML Buttons";
                console.log(`✅ [METHOD B SUCCESS] Found ${downloadLinks.length} links via HTML buttons!`);
            } else {
                console.log(`⚠️ [METHOD B EMPTY] No button links found.`);
            }
        }

        // METHOD C: Deep File-Host Pattern Scraping (Fallback 2 - Pixeldrain, Mega, Google Drive, etc.)
        if (downloadLinks.length === 0) {
            console.log(`\n🔄 [METHOD C] Attempting Deep File-Host Pattern Scan...`);
            
            $('a').each((i, el) => {
                const href = $(el).attr('href');
                const text = $(el).text().trim() || 'Download Link';
                if (href && (
                    href.includes('pixeldrain') || 
                    href.includes('megaup') || 
                    href.includes('drive.google') || 
                    href.includes('1drv.ms') ||
                    href.includes('terabox') ||
                    href.includes('zippyshare')
                )) {
                    if (!downloadLinks.some(l => l.href === href)) {
                        downloadLinks.push({ text, href });
                    }
                }
            });

            if (downloadLinks.length > 0) {
                methodUsed = "Deep File-Host Pattern Scan";
                console.log(`✅ [METHOD C SUCCESS] Found ${downloadLinks.length} host links!`);
            } else {
                console.log(`⚠️ [METHOD C EMPTY] No host links found.`);
            }
        }

        console.log(`\n==================================================`);
        console.log(`🏁 [FINAL STATUS] Method Succeeded: ${methodUsed || 'None'}`);
        console.log(`📦 [FINAL STATUS] Total Links Found: ${downloadLinks.length}`);
        console.log(`==================================================\n`);

        res.json({
            status: true,
            creator: "@Imalsha",
            movie_url: movieUrl,
            post_id: postId || null,
            title: movieTitle,
            poster: moviePoster,
            method_used: methodUsed || "Failed to extract",
            links_count: downloadLinks.length,
            links: downloadLinks
        });

    } catch (err) {
        console.error(`❌ [ULTIMATE CRITICAL ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Ultimate Extractor API running on port ${PORT}`));
