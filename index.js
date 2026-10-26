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
        message: "IMALSHA CINESUBZ WP MOVIE TESTER is Live 🚀",
        endpoints: {
            test_movie: "/api/v1/cinesubz/test-movie-wp",
            test_wp: "/api/v1/cinesubz/test-wp"
        }
    });
});

// WordPress Specific Movie Post Test Endpoint
app.get('/api/v1/cinesubz/test-movie-wp', async (req, res) => {
    try {
        console.log(`\n🔍 [WP MOVIE TEST] Fetching specific Spider-Man movie via WP REST API...`);
        
        // Slug extracted directly from the movie URL
        const slug = "spider-man-brand-new-day-2026-sinhala-subtitles";
        const wpApiUrl = `https://cinesubz.net/wp-json/wp/v2/posts?slug=${slug}`;
        
        const response = await axios.get(wpApiUrl, {
            headers: HEADERS,
            timeout: 15000
        });

        console.log(`🎉 WP Movie API Response received! Posts found: ${response.data.length}`);

        res.json({
            status: true,
            creator: "@Imalsha",
            slug_tested: slug,
            found: response.data.length > 0,
            movie_data: response.data[0] || null
        });

    } catch (err) {
        console.error(`❌ [WP MOVIE TEST ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Cinesubz WP Movie Test API running on port ${PORT}`));
