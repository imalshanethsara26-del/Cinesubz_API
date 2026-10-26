const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
};

// Root Status Route
app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA CINESUBZ WP API TESTER is Live 🚀",
        endpoints: {
            test_wp: "/api/v1/cinesubz/test-wp",
            latest: "/api/v1/cinesubz/latest?page=1",
            search: "/api/v1/cinesubz/search?q=movie_name"
        }
    });
});

// WordPress REST API Test Endpoint
app.get('/api/v1/cinesubz/test-wp', async (req, res) => {
    try {
        console.log(`\n🔍 [WP-JSON TEST] Fetching WordPress REST API...`);
        
        // Fetching WordPress posts JSON directly from Cinesubz
        const wpApiUrl = "https://cinesubz.net/wp-json/wp/v2/posts?per_page=5";
        const response = await axios.get(wpApiUrl, {
            headers: HEADERS,
            timeout: 15000
        });

        console.log(`🎉 Successfully fetched WP REST API data! Posts count: ${response.data.length}`);

        res.json({
            status: true,
            creator: "@Imalsha",
            posts_count: response.data.length,
            sample_post: response.data[0] || null
        });

    } catch (err) {
        console.error(`❌ [WP TEST ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Cinesubz WP Test API running on port ${PORT}`));
