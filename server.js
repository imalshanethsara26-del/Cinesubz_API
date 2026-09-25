const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Referer': 'https://cinesubz.co/'
};

// ZT-Links & Csplayer Bypass Logic for CineSubz
async function resolveFinalLinks(ztUrl) {
    try {
        const res1 = await axios.get(ztUrl, { headers: HEADERS, maxRedirects: 5, timeout: 10000 });
        const $ = cheerio.load(res1.data);
        let targetUrl = '';
        
        const formAction = $('form').attr('action');
        if (formAction) {
            targetUrl = formAction;
        } else {
            const scriptHtml = $('script').text();
            const match = scriptHtml.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/) || scriptHtml.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
            if (match) targetUrl = match[1];
        }

        if (!targetUrl) {
            $('a').each((i, el) => {
                const h = $(el).attr('href') || '';
                if (h.includes('csplayer') || h.includes('player') || h.includes('download')) targetUrl = h;
            });
        }

        if (!targetUrl) targetUrl = ztUrl;
        if (targetUrl.startsWith('/')) targetUrl = 'https://cinesubz.co' + targetUrl;
        else if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;

        const res2 = await axios.get(targetUrl, { headers: { ...HEADERS, 'Referer': ztUrl }, maxRedirects: 5, timeout: 10000 });
        const $2 = cheerio.load(res2.data);
        const directLinks = [];

        $2('a').each((i, el) => {
            const h = $2(el).attr('href') || '';
            const t = $2(el).text().trim();
            if (h && (h.includes('pixeldrain') || h.includes('telegram') || h.includes('t.me') || h.includes('drive.google') || h.includes('mega') || h.includes('gofile') || h.includes('file'))) {
                if (!directLinks.some(d => d.link === h)) {
                    directLinks.push({ name: t || 'Download Link', link: h });
                }
            }
        });

        if (directLinks.length === 0) {
            $2('a').each((i, el) => {
                const h = $2(el).attr('href') || '';
                const t = $2(el).text().trim();
                if (h && !h.includes('#') && !h.includes('javascript') && !h.includes('facebook') && !h.includes('twitter')) {
                    if (!directLinks.some(d => d.link === h)) {
                        directLinks.push({ name: t || 'Link', link: h });
                    }
                }
            });
        }

        return directLinks.length > 0 ? directLinks : [{ name: 'Direct Page', link: targetUrl }];
    } catch (e) {
        return [{ name: 'ZT Link', link: ztUrl }];
    }
}

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
        if (!query) return res.status(400).json({ status: false, message: "Search term required" });

        const searchUrl = "https://cinesubz.co/?s=" + encodeURIComponent(query);
        const response = await axios.get(searchUrl, { headers: HEADERS, timeout: 10000 });
        const $ = cheerio.load(response.data);
        const results = [];

        $('article, .item, .result-item, div[class*="item"]').each((i, el) => {
            const linkEl = $(el).find('a').first();
            const link = linkEl.attr('href') || $(el).attr('href') || '';
            
            let title = $(el).find('h2, h3, .title').text().trim();
            if (!title) title = linkEl.attr('title') || '';
            if (!title) title = linkEl.text().trim();

            let img = $(el).find('img').attr('src');
            if (!img) img = $(el).find('img').attr('data-src');
            if (img && img.startsWith('//')) img = 'https:' + img;
            if (!img) img = '';

            let quality = $(el).find('.quality, .badge-quality').text().trim() || 'WEB-DL';
            let rating = $(el).find('.rating, .score').text().trim() || 'N/A';

            if (link && (link.includes('/movies/') || link.includes('/tvshows/')) && title.length > 2) {
                title = title.replace(/\t|\n/g, ' ').replace(/\s+/g, ' ').trim();
                if (!results.some(r => r.link === link)) {
                    results.push({ title, image: img, quality, rating, link });
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
        const movieUrl = req.query.url || req.query.q;
        if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

        const response = await axios.get(movieUrl, { headers: HEADERS, timeout: 15000 });
        const $ = cheerio.load(response.data);

        let title = $('meta[property="og:title"]').attr('content');
        if (!title) {
            title = $('h1').first().text().trim();
        }
        if (!title) {
            title = '';
        }
        title = title.replace(' - CineSubz', '').replace(' Sinhala Subtitles', '').replace(' | සිංහල උපසිරැසි සමඟ', '').trim();

        let image = $('meta[property="og:image"]').attr('content');
        if (!image) {
            image = $('.poster img, article img').first().attr('src') || '';
        }
        if (image.startsWith('//')) {
            image = 'https:' + image;
        }

        let quality = $('.quality, .badge-quality').first().text().trim() || 'WEB-DL';
        let rating = $('.score, .rating').first().text().trim() || 'N/A';

        let story = '';
        $('.entry-content p, .description p, article p').each((i, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 30 && !text.includes('උපසිරැසි') && !text.toLowerCase().includes('download')) {
                if (!story) story = text;
            }
        });
        if (!story) story = 'තොරතුරු නොමැත.';

        const rawLinks = [];
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().trim();
            const parentText = $(el).parent().text().replace(/\s+/g, ' ').trim();
            const boxText = $(el).closest('div, li, tr').text().replace(/\s+/g, ' ').trim();
            const combined = text + ' ' + parentText + ' ' + boxText;

            if (href && (href.includes('zt-link') || href.includes('csplayer') || href.includes('/link/') || href.includes('/download/'))) {
                let qMatch = combined.match(/(1080p|720p|480p|2160p|4k|web-dl|bluray)/i);
                let q = qMatch ? qMatch[0].toUpperCase() : 'WEB-DL';
                let sizeMatch = combined.match(/(\d+(\.\d+)?\s*(gb|mb))/i);
                let size = sizeMatch ? sizeMatch[0].toUpperCase() : 'N/A';
                
                if (!rawLinks.some(r => r.link === href)) {
                    rawLinks.push({ quality: q, size: size, link: href });
                }
            }
        });

        const downloads = [];
        for (const item of rawLinks) {
            const finalDl = await resolveFinalLinks(item.link);
            downloads.push({
                quality: item.quality,
                size: item.size,
                language: 'English',
                zt_link: item.link,
                direct_buttons: finalDl
            });
        }

        res.json({
            status: true,
            creator: "IMALSHA API",
            site: "cinesubz",
            data: {
                title,
                image,
                quality,
                rating,
                story,
                downloads
            }
        });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Cinesubz API Server running on port ${PORT}`));
