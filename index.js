const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://cinesubz.net/',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
};

// Root Endpoint
app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA TRACE & RESOLVER API is Live 🚀",
        endpoints: {
            resolve: "/api/v1/cinesubz/resolve?url=zt_link_url",
            infodl: "/api/v1/cinesubz/infodl?url=movie_url"
        }
    });
});

// 🔍 TRACE & RESOLVE FUNCTION WITH FULL LIVE LOGGING
const traceAndResolveZtLink = async (ztUrl, logEmitter = console.log) => {
    logEmitter(`\n--------------------------------------------------`);
    logEmitter(`🔍 [TRACE START] Targeting ZT-Link: ${ztUrl}`);
    
    try {
        logEmitter(`1️⃣ Sending HTTP GET request via Axios with redirect tracking...`);
        const response = await axios.get(ztUrl, {
            headers: HEADERS,
            timeout: 15000,
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 400 // Accept redirects
        });

        logEmitter(`📥 [HTTP STATUS]: ${response.status}`);
        
        // Check if Axios followed redirects to a final destination
        if (response.request?.res?.responseUrl) {
            logEmitter(`📍 [RESPONSE URL]: ${response.request.res.responseUrl}`);
        }

        const htmlData = response.data;
        logEmitter(`📦 HTML Payload length: ${htmlData.length} bytes`);

        let resolvedUrl = '';

        // 2. Scan HTML anchor tags for r2.cloudflarestorage or signed storage links
        const $ = cheerio.load(htmlData);
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            if (href.includes('cloudflarestorage.com') || href.includes('X-Amz-Signature') || href.includes('pixeldrain.com')) {
                resolvedUrl = href;
                logEmitter(`🎯 [ANCHOR MATCH FOUND]: ${resolvedUrl}`);
            }
        });

        // 3. Deep Regex Scan inside JavaScript / HTML script blocks for AWS S3 pre-signed URLs
        if (!resolvedUrl) {
            logEmitter(`🔎 Anchor scan empty. Executing Deep Regex / Script Content Trace...`);
            
            // Match pattern for cloudflare storage / aws signed urls
            const s3SignedRegex = /https?:\/\/[^\s"'<>]+r2\.cloudflarestorage\.com[^\s"'<>]+/i;
            const match = htmlData.match(s3SignedRegex);

            if (match) {
                resolvedUrl = match[0];
                logEmitter(`💡 [REGEX S3 MATCH FOUND]: ${resolvedUrl}`);
            } else {
                // Fallback to generic mp4 or server links
                const genericMatch = htmlData.match(/https?:\/\/[^\s"'<>]+(?:server[0-9]+|\.mp4|token=)[^\s"'<>]+/i);
                if (genericMatch) {
                    resolvedUrl = genericMatch[0];
                    logEmitter(`💡 [GENERIC URL MATCH]: ${resolvedUrl}`);
                }
            }
        }

        if (resolvedUrl) {
            logEmitter(`✅ [SUCCESS] Resolved Final Link: ${resolvedUrl}`);
            logEmitter(`--------------------------------------------------\n`);
            return resolvedUrl;
        } else {
            logEmitter(`❌ [FAILED] Could not extract signed R2 link from this ZT page.`);
            logEmitter(`--------------------------------------------------\n`);
            return null;
        }

    } catch (err) {
        logEmitter(`❌ [TRACE ERROR]: ${err.message}`);
        logEmitter(`--------------------------------------------------\n`);
        return null;
    }
};

// Standalone Resolver Route (Live Trace Enabled)
app.get('/api/v1/cinesubz/resolve', async (req, res) => {
    const ztUrl = req.query.url;
    if (!ztUrl) return res.status(400).json({ status: false, message: "ZT Link URL required" });

    console.log(`\n🚀 [API REQUEST] /resolve called for: ${ztUrl}`);
    
    // Custom log emitter to also stream or print in terminal
    const directLink = await traceAndResolveZtLink(ztUrl, (msg) => console.log(msg));

    if (directLink) {
        return res.json({
            status: true,
            creator: "@Imalsha",
            source: "shifter_live_traced",
            count: 1,
            links: [
                {
                    provider: "Cloudflare R2 Direct Server",
                    url: directLink
                }
            ]
        });
    }

    res.status(404).json({ status: false, message: "Failed to resolve ZT-Link" });
});

app.listen(PORT, () => console.log(`Cinesubz Trace & Resolver API running on port ${PORT}`));
