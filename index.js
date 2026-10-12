const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
let PORT = process.env.PORT;
if (!PORT) {
    PORT = 3000;
}

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

// Search Endpoint
app.get('/api/v1/cinesubz/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({ status: false, message: "Search term required" });
        }

        const searchUrl = "https://cinesubz.net/?s=" + encodeURIComponent(query);
        const response = await axios.get(searchUrl, { headers: HEADERS, timeout: 15000 });
        const $ = cheerio.load(response.data);
        const results = [];

        $('a').each((i, el) => {
            let href = $(el).attr('href');
            if (!href) {
                href = '';
            }
            
            const parent = $(el).closest('article, .post, .item, div');
            
            let title = $(el).find('h2, h3, .title').text().trim();
            if (!title) {
                title = $(el).attr('title');
            }
            if (!title) {
                title = $(el).text().trim();
            }

            let img = $(el).find('img').attr('src');
            if (!img) {
                img = $(el).find('img').attr('data-src');
            }
            if (!img) {
                img = parent.find('img').attr('src');
            }
            if (!img) {
                img = parent.find('img').attr('data-src');
            }
            if (!img) {
                img = '';
            }

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

// Info & Download Endpoint
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    try {
        const movieUrl = req.query.url;
        if (!movieUrl) {
            return res.status(400).json({ status: false, message: "URL required" });
        }

        const response = await axios.get(movieUrl, { headers: HEADERS, timeout: 20000 });
        const html = response.data;
        const $ = cheerio.load(html);

        // Title
        let title = $('h1.entry-title').text().trim();
        if (!title) title = $('h1').first().text().trim();
        if (!title) title = $('title').text().trim();

        // Image
        let image = $('meta[property="og:image"]').attr('content');
        if (!image) {
            const imgAttr = $('.poster img, .single-poster img, .entry-content img').first().attr('src');
            image = imgAttr ? imgAttr : '';
        }

        // Quality, Rating, Director, etc.
        let quality = $('.quality, .movie-quality').text().trim();
        if (!quality) quality = "WEB-DL";

        let rating = $('.imdb-rate, .rating, .score').first().text().trim();
        if (!rating) rating = "N/A";

        let director = $('span.director, .mr-director').text().trim();
        if (!director) director = "N/A";

        let year = "2026";
        const yearMatch = title.match(/\((\d{4})\)/);
        if (yearMatch) year = yearMatch[1];

        // Story
        let story = '';
        $('.entry-content p, .su-spoiler-content p, .synopsis p').each((i, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 30 && !text.includes('උපසිරැසි') && !text.includes('Sinhala Subtitles') && !text.includes('Download')) {
                if (!story) story = text;
            }
        });
        if (!story) story = 'No description available';

        // Cast extraction
        const cast = [];
        $('.cast-item, .actor, .person').each((i, el) => {
            const name = $(el).find('.name, h4, span').text().trim();
            let role = $(el).find('.role, .character').text().trim();
            if (!role) role = 'Actor';
            let img = $(el).find('img').attr('src');
            if (!img) img = '';
            if (name) {
                cast.push({ name, role, image: img });
            }
        });

        // Gallery images
        const gallery = [];
        $('.gallery img, .screenshots img, .entry-content img').each((i, el) => {
            let src = $(el).attr('src');
            if (!src) src = $(el).attr('data-src');
            if (src && src.startsWith('http') && !gallery.includes(src)) {
                gallery.push(src);
            }
        });

        // Downloads Extraction
        const downloads = [];

        // 1. First check direct download buttons on the main movie page
        $('a').each((i, el) => {
            let href = $(el).attr('href');
            if (!href) href = '';

            const btnText = $(el).text().trim();
            const parentText = $(el).parent().text().replace(/\s+/g, ' ').trim();
            const fullText = btnText + ' ' + parentText;

            if (href && (href.includes('pixeldrain') || href.includes('mega') || href.includes('telegram.me') || href.includes('t.me') || href.includes('supercloud') || href.includes('space') || href.includes('/zt-links/'))) {
                if (!href.includes('cinesubz.net') && !href.includes('javascript') && !href.includes('#')) {
                    const qMatch = fullText.match(/(2160p|4K|1080p|720p|480p|BluRay|WEB-DL|HDRip)/i);
                    let qName = qMatch ? qMatch[0].toUpperCase() : "WEB-DL";

                    const sMatch = fullText.match(/(\d+(\.\d+)?\s*(GB|MB))/i);
                    let size = sMatch ? sMatch[0] : "N/A";

                    let type = "Direct Server";
                    if (href.includes('pixeldrain')) type = "PixelDrain";
                    else if (href.includes('telegram') || href.includes('t.me')) type = "Telegram Bot";
                    else if (href.includes('space') || href.includes('kdrive')) type = "Direct High-Speed Server";

                    if (!downloads.some(d => d.link === href)) {
                        downloads.push({
                            quality: qName + " [" + type + "]",
                            size: size,
                            language: "English",
                            link: href
                        });
                    }
                }
            }
        });

        // 2. If zt-links exist, fetch them to grab underlying direct/pixel/telegram links
        const ztLinksToFetch = [];
        $('a').each((i, el) => {
            let href = $(el).attr('href');
            if (!href) href = '';

            if (href.includes('/zt-links/')) {
                const text = $(el).text() + ' ' + $(el).parent().text();
                const qMatch = text.match(/(2160p|4K|1080p|720p|480p|BluRay|WEB-DL|HDRip)/i);
                const sMatch = text.match(/(\d+(\.\d+)?\s*(GB|MB))/i);
                ztLinksToFetch.push({
                    url: href,
                    quality: qMatch ? qMatch[0].toUpperCase() : "WEB-DL",
                    size: sMatch ? sMatch[0] : "N/A"
                });
            }
        });

        for (const item of ztLinksToFetch) {
            try {
                const ztRes = await axios.get(item.url, { headers: HEADERS, timeout: 10000 });
                const $zt = cheerio.load(ztRes.data);
                
                let redirectUrl = '';
                $zt('a').each((i, el) => {
                    let h = $zt(el).attr('href');
                    if (!h) h = '';
                    if (h && !h.includes('cinesubz.net') && h.startsWith('http')) {
                        redirectUrl = h;
                    }
                });

                if (redirectUrl) {
                    const finalRes = await axios.get(redirectUrl, { headers: HEADERS, timeout: 10000 });
                    const $final = cheerio.load(finalRes.data);

                    $final('a').each((i, el) => {
                        let link = $final(el).attr('href');
                        if (!link) link = '';
                        const text = $final(el).text().trim();

                        if (link && !link.includes('cinesubz.net') && !link.includes('CineSubzAdmin') && !link.includes('javascript')) {
                            let type = "Direct Server";
                            if (link.includes('pixeldrain')) type = "PixelDrain";
                            else if (link.includes('telegram') || link.includes('t.me')) type = "Telegram Bot";

                            if (!downloads.some(d => d.link === link)) {
                                downloads.push({
                                    quality: item.quality + " [" + type + "]",
                                    size: item.size,
                                    language: "English",
                                    link: link
                                });
                            }
                        }
                    });
                }
            } catch (err) {
                // Ignore nested fetch error
            }
        }

        res.json({
            status: true,
            creator: "@Imalsha",
            site: "cinesubz",
            url: movieUrl,
            data: {
                title,
                image,
                quality,
                rating,
                imdb: rating + " (N/A)",
                director,
                language: "ENGLISH",
                genres: ["Action", "Adventure", "English", "Sinhala Subtitles"],
                story,
                cast,
                gallery,
                trailer: "https://www.youtube.com/@cinesubz",
                year,
                duration: "N/A",
                tag: "English",
                directors: director,
                stars: "N/A",
                country: "Sri Lanka / Global",
                downloads
            }
        });

    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log("Cinesubz API running on port " + PORT));
