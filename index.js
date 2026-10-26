// WordPress REST API Test Endpoint
app.get('/api/v1/cinesubz/test-wp', async (req, res) => {
    try {
        console.log(`\n🔍 [WP-JSON TEST] Fetching WordPress REST API...`);
        
        // Fetching WordPress posts JSON directly
        const wpApiUrl = "https://cinesubz.net/wp-json/wp/v2/posts?per_page=5";
        const response = await axios.get(wpApiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        });

        console.log(`🎉 Successfully fetched WP REST API data!`);

        res.json({
            status: true,
            creator: "@Imalsha",
            posts_count: response.data.length,
            sample_post: response.data[0] || null // Let's inspect the first post structure
        });

    } catch (err) {
        console.error(`❌ [WP TEST ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});
