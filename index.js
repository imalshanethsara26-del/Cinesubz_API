const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://cinesubz.net/'
};

app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA CINESUBZ DIRECT URL EXTRACTOR is Live 🚀",
        endpoint: "/api/v1/cinesubz/extract?url=movie_page_url"
    });
});

// Direct URL & Post ID Extractor
app.get('/api/v1/cinesubz/extract', async (req, res) => {
    try {
        const movieUrl = req.query.url || "https://cinesubz.net/movies/spider-man-brand-new-day-2026-sinhala-subtitles/";
        console.log(`\n🔍 [DIRECT EXTRACT] Fetching page: ${movieUrl}`);
        
        // 1. Fetch movie page HTML using Axios & Cheerio to find WordPress Post ID
        const htmlRes = await axios.get(movieUrl, { headers: HEADERS, timeout: 15000 });
        const $ = cheerio.load(htmlRes.data);
        
        // Zetaflix/WordPress themes usually put post id in body classes like 'postid-XXXX' or article classes
        let postId = null;
        const bodyClass = $('body').attr('class') || '';
        const match = bodyClass.match(/postid-(\d+)/);
        
        if (match && match[1]) {
            postId = match[1];
        } else {
            // Fallback: check alternate meta or link tags for post id
            const shortlink = $('link[rel="shortlink"]').attr('href') || '';
            const pMatch = shortlink.match(/\?p=(\d+)/);
            if (pMatch && pMatch[1]) postId = pMatch[1];
        }
        
        console.log(`🎯 Extracted Post ID: ${postId || 'Not Found'}`);
        
        if (!postId) {
            return res.json({ status: false, message: "Could not extract WordPress Post ID from the given URL" });
        }
        
        // 2. Fetch Zeta Player API using the extracted Post ID
        const playerApiUrl = `https://cinesubz.net/wp-json/zetaplayer/v2/movie/${postId}`;
        let playerData = null;
        
        try {
            const playerRes = await axios.get(playerApiUrl, { headers: HEADERS, timeout: 10000 });
            playerData = playerRes.data;
        } catch (e) {
            console.log(`⚠️ Player API with 'movie' failed, trying 'post'...`);
            try {
                const altRes = await axios.get(`https://cinesubz.net/wp-json/zetaplayer/v2/post/${postId}`, { headers: HEADERS, timeout: 10000 });
                playerData = altRes.data;
            } catch (err2) {
                playerData = { error: err2.message };
            }
        }
        
        res.json({
            status: true,
            creator: "@Imalsha",
            movie_url: movieUrl,
            post_id: postId,
            player_links: playerData
        });

    } catch (err) {
        console.error(`❌ [EXTRACT ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Direct Extractor API running on port ${PORT}`));
