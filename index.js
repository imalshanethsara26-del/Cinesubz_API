const express = require('express');
const axios = require('axios');
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
        message: "IMALSHA CINESUBZ MASTER API is Live 🚀",
        endpoint: "/api/v1/cinesubz/get-movie?q=Spider-Man"
    });
});

// Filtered Master endpoint to pick actual movie posts and fetch Zeta player links
app.get('/api/v1/cinesubz/get-movie', async (req, res) => {
    try {
        const query = req.query.q || "Spider-Man";
        console.log(`\n🔍 [AUTO-RESOLVE] Searching for movie query: ${query}`);
        
        // 1. Search post by query in WordPress API
        const searchRes = await axios.get(`https://cinesubz.net/wp-json/wp/v2/posts?search=${encodeURIComponent(query)}`, {
            headers: HEADERS,
            timeout: 15000
        });
        
        if (!searchRes.data || searchRes.data.length === 0) {
            return res.json({ status: false, message: "Movie not found via WordPress search" });
        }
        
        // Filter out collection posts like MCU complete collection
        let targetPost = null;
        for (const post of searchRes.data) {
            const title = post.title.rendered.toLowerCase();
            if (!title.includes('complete collection') && !title.includes('universe')) {
                targetPost = post;
                break;
            }
        }
        
        // If all matched are collections, fallback to the first one
        if (!targetPost) targetPost = searchRes.data[0];
        
        const postId = targetPost.id;
        const postTitle = targetPost.title.rendered;
        
        console.log(`🎯 Selected Real Movie Post ID: ${postId} -> ${postTitle}`);
        
        // 2. Fetch Zeta Player data using the real post ID
        const playerApiUrl = `https://cinesubz.net/wp-json/zetaplayer/v2/movie/${postId}`;
        let playerData = null;
        
        try {
            const playerRes = await axios.get(playerApiUrl, { headers: HEADERS, timeout: 10000 });
            playerData = playerRes.data;
        } catch (e) {
            console.log(`⚠️ Player API failed with 'movie' type, trying 'post' type...`);
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
            matched_movie: {
                id: postId,
                title: postTitle,
                link: targetPost.link,
                date: targetPost.date
            },
            player_links: playerData
        });

    } catch (err) {
        console.error(`❌ [MASTER ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Master API running on port ${PORT}`));
