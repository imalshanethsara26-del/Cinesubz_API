const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
};

// Root Status Route
app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA CINESUBZ API is Live 🚀",
        endpoints: {
            search: "/api/v1/cinesubz/search?q=movie_name",
            infodl: "/api/v1/cinesubz/infodl?url=movie_url"
        }
    });
});

// Search Endpoint (කිසිදු වෙනසක් කර නැත)
app.get('/api/v1/cinesubz/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ status: false, message: "Search term required" });

        const searchUrl = "https://cinesubz.net/?s=" + encodeURIComponent(query);
        const response = await axios.get(searchUrl, { headers: HEADERS, timeout: 15000 });
        const $ = cheerio.load(response.data);
        const results = [];

        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const parent = $(el).closest('article, .post, .item, div');
            
            let title = $(el).find('h2, h3, .title').text().trim();
            if (!title) title = $(el).attr('title') || '';
            if (!title) title = $(el).text().trim();

            let img = $(el).find('img').attr('src');
            if (!img) img = $(el).find('img').attr('data-src');
            if (!img) img = parent.find('img').attr('src');
            if (!img) img = parent.find('img').attr('data-src') || '';

            if (href.includes('cinesubz.net') && (href.includes('/movies/') || href.includes('/tvshows/')) && title.length > 2) {
                title = title.replace(/\t|\n/g, '').trim();
                if (!results.some(r => r.link === href)) {
                    results.push({ title, image: img, link: href });
                }
            }
        });

        res.json({ status: true, creator: "IMALSHA API", site: "cinesubz", results_count: results.length, data: results });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// Info & Download Endpoint (Direct download links පමණක් නිවැරදිව ලබා ගැනීමට සකසා ඇත)
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    try {
        const movieUrl = req.query.url;
        if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

        const response = await axios.get(movieUrl, { headers: HEADERS, timeout: 15000 });
        const $ = cheerio.load(response.data);

        // Title
        let title = $('h1.entry-title').text().trim();
        if (!title) title = $('h1').first().text().trim();
        if (!title) title = $('title').text().trim();

        // Image
        let image = $('meta[property="og:image"]').attr('content');
        if (!image) {
            const imgAttr = $('.poster img, .single-poster img, .entry-content img').first().attr('src');
            image = imgAttr || '';
        }

        // IMDb
        let imdb_rating = $('.imdb-rate, .rating, .score, span[itemprop="ratingValue"]').first().text().trim();
        if (!imdb_rating) {
            const pageText = $.text();
            const match = pageText.match(/IMDb\s*:?\s*([\d\.]+(\/10)?)/i);
            if (match) imdb_rating = match[1];
        }
        if (!imdb_rating) imdb_rating = "N/A";

        // Story
        let story = '';
        $('.entry-content p, .su-spoiler-content p, .synopsis p').each((i, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 30 && !text.includes('උපසිරැසි') && !text.includes('Sinhala Subtitles') && !text.includes('Download')) {
                if (!story) story = text;
            }
        });
        if (!story) story = 'No description available';

        // Collect zt-links first
        const ztLinks = [];
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().trim();
            const parentText = $(el).parent().text().replace(/\s+/g, ' ').trim();
            const fullText = text + ' ' + parentText;

            if (href && href.includes('/zt-links/')) {
                const qMatch = fullText.match(/(2160p|4K|1080p|720p|480p|BluRay|WEB-DL|HDRip)/i);
                const quality = qMatch ? qMatch[0].toUpperCase() : "HD";

                const sMatch = fullText.match(/(\d+(\.\d+)?\s*(GB|MB))/i);
                const size = sMatch ? sMatch[0] : "N/A";

                if (!ztLinks.some(z => z.ztUrl === href)) {
                    ztLinks.push({ quality, size, ztUrl: href });
                }
            }
        });

        const downloads = [];

        // Traverse through zt-links and final redirect pages
        for (const item of ztLinks) {
            let linkResolved = false;
            try {
                // 1. Fetch zt-link page
                const ztRes = await axios.get(item.ztUrl, { headers: HEADERS, timeout: 20000 });
                const ztHtml = ztRes.data;
                const $zt = cheerio.load(ztHtml);
                
                let redirectUrl = '';

                // Look for "Go to Download Page" button link
                $zt('a').each((i, el) => {
                    const href = $zt(el).attr('href') || '';
                    const btnText = $zt(el).text().trim();
                    if (href && (btnText.includes('Download Page') || href.includes('space') || href.includes('redirect'))) {
                        if (!href.includes('cinesubz.net') && !href.includes('javascript') && !href.includes('#')) {
                            redirectUrl = href;
                        }
                    }
                });

                if (!redirectUrl) {
                    $zt('a').each((i, el) => {
                        const href = $zt(el).attr('href') || '';
                        if (href && !href.includes('cinesubz.net') && !href.includes('javascript') && !href.includes('#')) {
                            redirectUrl = href;
                        }
                    });
                }

                // 2. Fetch final redirect page (csplayer2.space) and extract Direct Download links
                if (redirectUrl) {
                    const finalRes = await axios.get(redirectUrl, { headers: HEADERS, timeout: 20000 });
                    const finalHtml = finalRes.data;
                    const $final = cheerio.load(finalHtml);

                    $final('a').each((i, el) => {
                        const link = $final(el).attr('href') || '';
                        const btnText = $final(el).text().trim();

                        // Telegram හෝ Admin ලින්ක්ස් සම්පූර්ණයෙන්ම ඉවත් කර Direct Download ලින්ක්ස් පමණක් ලබා ගැනීම
                        if (link && !link.includes('cinesubz.net') && !link.includes('javascript') && !link.includes('#') && !link.includes('t.me') && !link.includes('telegram.org') && !link.includes('CineSubzAdmin')) {
                            if (btnText.toLowerCase().includes('direct') || btnText.toLowerCase().includes('download') || link.includes('pixeldrain') || link.includes('mega') || link.includes('drive') || link.includes('file')) {
                                downloads.push({
                                    name: `${btnText} - ${item.quality} (${item.size})`,
                                    quality: item.quality,
                                    size: item.size,
                                    direct_link: link
                                });
                                linkResolved = true;
                            }
                        }
                    });
                }

                if (!linkResolved) {
                    downloads.push({
                        name: `Download Link - ${item.quality} (${item.size})`,
                        quality: item.quality,
                        size: item.size,
                        direct_link: redirectUrl || item.ztUrl
                    });
                }

            } catch (e) {
                downloads.push({
                    name: `Download Link - ${item.quality} (${item.size})`,
                    quality: item.quality,
                    size: item.size,
                    direct_link: item.ztUrl
                });
            }
        }

        res.json({
            status: true,
            creator: "IMALSHA API",
            site: "cinesubz",
            data: {
                title,
                imdb_rating,
                story,
                image,
                downloads
            }
        });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Cinesubz API running on port ${PORT}`));
