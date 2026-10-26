const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
};

app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA CINESUBZ WP SEARCH API is Live 🚀",
        endpoint: "/api/v1/cinesubz/search-wp?q=spider"
    });
});

// WordPress Search API Endpoint
app.get('/api/v1/cinesubz/search-wp', async (req, res) => {
    try {
        const query = req.query.q || "spider";
        console.log(`\n🔍 [WP SEARCH] Searching WordPress API for: ${query}`);
        
        const wpApiUrl = `https://cinesubz.net/wp-json/wp/v2/posts?search=${encodeURIComponent(query)}`;
        
        const response = await axios.get(wpApiUrl, {
            headers: HEADERS,
            timeout: 15000
        });

        console.log(`🎉 WP Search Results found: ${response.data.length}`);

        res.json({
            status: true,
            creator: "@Imalsha",
            query,
            results_count: response.data.length,
            posts: response.data
        });

    } catch (err) {
        console.error(`❌ [WP SEARCH ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`WP Search API running on port ${PORT}`));
