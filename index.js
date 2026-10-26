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
        message: "IMALSHA ZETAFLIX API TESTER is Live 🚀",
        endpoint: "/api/v1/cinesubz/test-player?id=96894"
    });
});

// Test Zeta Player / Source Endpoint
app.get('/api/v1/cinesubz/test-player', async (req, res) => {
    try {
        const movieId = req.query.id || "96894"; // Let's test with a post/movie ID
        console.log(`\n🔍 [ZETA PLAYER TEST] Testing player endpoint for ID: ${movieId}`);
        
        // Zetaflix / zetaplayer endpoint pattern from discovery
        const playerApiUrl = `https://cinesubz.net/wp-json/zetaplayer/v2/movie/${movieId}`;
        
        const response = await axios.get(playerApiUrl, {
            headers: HEADERS,
            timeout: 15000
        });

        console.log(`🎉 Zeta Player API Response received!`);

        res.json({
            status: true,
            creator: "@Imalsha",
            movie_id: movieId,
            player_data: response.data
        });

    } catch (err) {
        console.error(`❌ [ZETA PLAYER ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.response?.data || err.message });
    }
});

app.listen(PORT, () => console.log(`Zetaflix Player API running on port ${PORT}`));
