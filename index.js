const axios = require('axios');

async function traceApi(targetUrl) {
    console.log(`\n================ 🔍 API TRACING START ================`);
    console.log(`🎯 Target URL: ${targetUrl}`);
    
    // Custom Axios instance to inspect every redirect step
    const instance = axios.create({
        maxRedirects: 0, // Disable automatic following so we can catch every redirect step manually
        validateStatus: function (status) {
            return status >= 200 && status < 400; // Catch 2xx and 3xx (Redirects)
        }
    });

    let currentUrl = targetUrl;
    let hop = 1;

    while (hop <= 10) {
        try {
            console.log(`\n--------------------------------------------------`);
            console.log(`🚀 [HOP ${hop}] Sending GET Request to: ${currentUrl}`);
            
            const response = await instance.get(currentUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Referer': 'https://cinesubz.net/'
                }
            });

            console.log(`📥 [RESPONSE STATUS]: ${response.status} ${response.statusText}`);
            console.log(`📋 [RESPONSE HEADERS]:`, JSON.stringify(response.headers, null, 2));

            // Check if it's a redirect (301, 302, 307, 308)
            if (response.status >= 300 && response.status < 400 && response.headers.location) {
                let nextUrl = response.headers.location;
                // Handle relative redirect URLs
                if (nextUrl.startsWith('/')) {
                    const parsed = new URL(currentUrl);
                    nextUrl = `${parsed.protocol}//${parsed.host}${nextUrl}`;
                }
                console.log(`🔄 [REDIRECT DETECTED] ➡️ Moving to: ${nextUrl}`);
                currentUrl = nextUrl;
                hop++;
            } else {
                console.log(`✅ [FINAL DESTINATION REACHED] No more redirects.`);
                console.log(`📦 [DATA PREVIEW]:`, typeof response.data === 'object' ? JSON.stringify(response.data, null, 2).substring(0, 500) + '...' : response.data.substring(0, 500));
                break;
            }

        } catch (err) {
            console.error(`❌ [TRACING ERROR]: ${err.message}`);
            if (err.response) {
                console.error(`   Status: ${err.response.status}`);
                console.error(`   Headers:`, err.response.headers);
            }
            break;
        }
    }
    console.log(`\n================ 🏁 API TRACING END ==================\n`);
}

// 🎯 චමිදුගේ API එක මෙතැනට දාලා ට්‍රැක් කරමු
const chaminduApiUrl = "https://api.chamindu.site/api/v1/movies/cinesubz/infodl?q=https%3A%2F%2Fcinesubz.lk%2Fmovies%2Fspider-man-brand-new-day-2026-sinhala-subtitles%2F&api_key=chama_api_5dc8403e460b74f6f8eda19f55746e08";

traceApi(chaminduApiUrl);
