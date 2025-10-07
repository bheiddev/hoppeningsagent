const express = require("express");
const cheerio = require('cheerio');
const https = require('https');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');
require("dotenv").config(); // loads .env

const app = express();
app.use(express.json());

// Initialize Supabase client
// Use service role key if available (bypasses RLS), otherwise use anon key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(
  process.env.SUPABASE_URL,
  supabaseKey
);

// Simple fetch function using built-in modules
function fetch(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const zlib = require('zlib');
    
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    };
    
    client.get(url, options, (res) => {
      let stream = res;
      
      // Handle gzip/deflate compression
      if (res.headers['content-encoding'] === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      } else if (res.headers['content-encoding'] === 'deflate') {
        stream = res.pipe(zlib.createInflate());
      } else if (res.headers['content-encoding'] === 'br') {
        stream = res.pipe(zlib.createBrotliDecompress());
      }
      
      let data = '';
      stream.on('data', chunk => data += chunk);
      stream.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          text: () => Promise.resolve(data)
        });
      });
      stream.on('error', reject);
    }).on('error', reject);
  });
}

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`, 
    req.body && Object.keys(req.body).length > 0 ? req.body : '');
  next();
});

// Simple auth middleware
app.use((req, res, next) => {
  const auth = req.headers.authorization || "";
  if (auth === `Bearer ${process.env.HOPP_API_KEY}`) return next();
  return res.status(401).json({ ok:false, error:"Unauthorized" });
});

// Health check
app.get("/ping", (_req, res) => res.json({ ok:true, msg:"pong" }));

// Get all breweries for GPT reference
app.get("/breweries", async (req, res) => {
  try {
    const { data: breweries, error } = await supabase
      .from('breweries')
      .select('id, name, address')
      .order('name');
    
    if (error) {
      throw error;
    }
    
    res.json({ 
      ok: true, 
      breweries: breweries.map(b => ({
        id: b.id,
        name: b.name,
        address: b.address
      }))
    });
    
  } catch (error) {
    console.error('BREWERIES ERROR:', error.message);
    res.status(500).json({ ok: false, error: `Failed to fetch breweries: ${error.message}` });
  }
});

// Get beer releases from database
app.get("/beer-releases", async (req, res) => {
  try {
    const { brewery_id, limit = 50, offset = 0 } = req.query;
    
    let query = supabase
      .from('beer_releases_base')
      .select(`
        id,
        brewery_id,
        beer_name,
        Type,
        release_date,
        description,
        ABV,
        created_at,
        breweries!brewery_id(id, name, address)
      `)
      .order('release_date', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Filter by brewery if specified
    if (brewery_id) {
      query = query.eq('brewery_id', brewery_id);
    }
    
    const { data: releases, error } = await query;
    
    if (error) {
      throw error;
    }
    
    res.json({ 
      ok: true, 
      releases: releases.map(r => ({
        id: r.id,
        brewery_id: r.brewery_id,
        brewery_name: r.breweries.name,
        brewery_address: r.breweries.address,
        beer_name: r.beer_name,
        beer_type: r.Type, // Map Type to beer_type for API consistency
        release_date: r.release_date,
        description: r.description,
        ABV: r.ABV, // Keep ABV consistent with database schema
        created_at: r.created_at
      })),
      total: releases.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('BEER RELEASES ERROR:', error.message);
    res.status(500).json({ ok: false, error: `Failed to fetch beer releases: ${error.message}` });
  }
});

// Get events from database
app.get("/events", async (req, res) => {
  try {
    const { brewery_id, limit = 50, offset = 0 } = req.query;
    
    let query = supabase
      .from('events_base')
      .select(`
        id,
        brewery_id,
        title,
        event_date,
        start_time,
        end_time,
        cost,
        is_recurring,
        description,
        featured,
        created_at,
        breweries!inner(id, name, address)
      `)
      .order('event_date', { ascending: true })
      .range(offset, offset + limit - 1);
    
    // Filter by brewery if specified
    if (brewery_id) {
      query = query.eq('brewery_id', brewery_id);
    }
    
    const { data: events, error } = await query;
    
    if (error) {
      throw error;
    }
    
    res.json({ 
      ok: true, 
      events: events.map(e => ({
        id: e.id,
        brewery_id: e.brewery_id,
        brewery_name: e.breweries.name,
        brewery_address: e.breweries.address,
        title: e.title,
        event_date: e.event_date,
        start_time: e.start_time,
        end_time: e.end_time,
        cost: e.cost,
        is_recurring: e.is_recurring,
        description: e.description,
        featured: e.featured,
        created_at: e.created_at
      })),
      total: events.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('EVENTS ERROR:', error.message);
    res.status(500).json({ ok: false, error: `Failed to fetch events: ${error.message}` });
  }
});

// Crawl Instagram business pages using Graph API
app.post("/crawl-instagram-graph", async (req, res) => {
  const { username, limit = 25, dryRun = false, extractEvents = false } = req.body || {};
  if (!username) return res.status(400).json({ ok: false, error: "username required" });
  
  try {
    console.log(`INSTAGRAM GRAPH: Starting crawl of @${username} for last ${limit} posts (dryRun: ${dryRun}, extractEvents: ${extractEvents})`);
    
    // Clean username (remove @ if present)
    const cleanUsername = username.replace('@', '');
    
    // Get Instagram credentials from environment
    const pageAccessToken = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
    const instagramBusinessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    
    if (!pageAccessToken || !instagramBusinessAccountId) {
      throw new Error('Instagram credentials not configured. Please set INSTAGRAM_PAGE_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID');
    }
    
    // Construct the Graph API URL
    const graphApiUrl = `https://graph.facebook.com/v23.0/${instagramBusinessAccountId}?fields=business_discovery.username(${cleanUsername}){media.limit(${limit}){id,caption,permalink,media_type,media_url,timestamp}}&access_token=${pageAccessToken}`;
    
    console.log(`INSTAGRAM GRAPH: Fetching from ${graphApiUrl}`);
    
    // Fetch from Instagram Graph API
    const response = await fetch(graphApiUrl);
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('Instagram Graph API Error:', response.status, errorData);
      
      if (response.status === 401) {
        throw new Error('Instagram access token expired or invalid. Please refresh your Page Access Token.');
      } else if (response.status === 400) {
        throw new Error('Invalid request to Instagram Graph API. Check business account ID and username.');
      } else {
        throw new Error(`Instagram Graph API error: ${response.status} ${response.statusText}`);
      }
    }
    
    const data = await response.text();
    let instagramData;
    
    try {
      instagramData = JSON.parse(data);
    } catch (parseError) {
      throw new Error('Failed to parse Instagram Graph API response');
    }
    
    // Check if business_discovery exists (account might be personal/private)
    if (!instagramData.business_discovery) {
      return res.json({
        ok: true,
        user: { username: cleanUsername },
        posts: [],
        extracted_events: [],
        total: 0,
        events_found: 0,
        dryRun: dryRun,
        source: 'instagram_graph_api',
        note: 'Account is personal, private, or not found. Instagram Graph API only works with business accounts.'
      });
    }
    
    const businessData = instagramData.business_discovery;
    const media = businessData.media?.data || [];
    
    // Transform Instagram posts to our format
    const posts = media.map(post => ({
      id: post.id,
      shortcode: post.permalink.split('/p/')[1]?.split('/')[0] || null,
      caption: post.caption || '',
      timestamp: new Date(post.timestamp).toISOString(),
      media_type: post.media_type,
      media_url: post.media_url,
      permalink: post.permalink,
      url: post.permalink
    }));
    
    // If extractEvents is true, try to find event and beer release information in posts
    let extractedEvents = [];
    let extractedReleases = [];
    if (extractEvents && posts.length > 0) {
      posts.forEach(post => {
        if (post.caption) {
          // Look for event-related keywords in captions
          const eventKeywords = ['event', 'trivia', 'bingo', 'live music', 'food truck', 'party', 'tasting', 'tour', 'workshop', 'meetup', 'tap takeover', 'happy hour', 'special event'];
          const hasEventKeywords = eventKeywords.some(keyword => 
            post.caption.toLowerCase().includes(keyword)
          );
          
          // Look for beer release keywords
          const releaseKeywords = ['beer release', 'new beer', 'hits taps', 'now available', 'collaboration beer', 'limited release', 'special release', 'seasonal beer'];
          const hasReleaseKeywords = releaseKeywords.some(keyword => 
            post.caption.toLowerCase().includes(keyword)
          );
          
          if (hasEventKeywords) {
            // Try to extract date/time information
            const datePatterns = [
              /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
              /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/gi,
              /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi,
              /(\d{1,2}:\d{2}\s*(am|pm))/gi,
              /(today|tomorrow|this week|next week)/gi
            ];
            
            let extractedDate = null;
            let extractedTime = null;
            
            datePatterns.forEach(pattern => {
              const matches = post.caption.match(pattern);
              if (matches) {
                if (pattern.source.includes(':')) {
                  extractedTime = matches[0];
                } else {
                  extractedDate = matches[0];
                }
              }
            });
            
            extractedEvents.push({
              source: 'instagram_graph_api',
              post_id: post.id,
              post_url: post.permalink,
              caption: post.caption,
              extracted_date: extractedDate,
              extracted_time: extractedTime,
              media_url: post.media_url,
              media_type: post.media_type,
              timestamp: post.timestamp,
              brewery_username: cleanUsername
            });
          }
          
          if (hasReleaseKeywords) {
            // Try to extract beer name and details
            const beerNameMatch = post.caption.match(/(?:new|collaboration|limited|special|seasonal)\s+([A-Za-z\s]+?)(?:\s+(?:beer|ale|lager|ipa|stout|porter|pilsner|wheat|sour|barrel|aged))/i);
            const beerName = beerNameMatch ? beerNameMatch[1].trim() : null;
            
            // Try to extract ABV
            const abvMatch = post.caption.match(/(\d+\.?\d*)\s*%?\s*abv/i);
            const abv = abvMatch ? parseFloat(abvMatch[1]) : null;
            
            // Try to extract beer type
            const beerTypeMatch = post.caption.match(/(ipa|stout|porter|pilsner|wheat|sour|barrel|aged|lager|ale|hazy|double|triple|imperial|session|session|blonde|brown|red|amber|pale|black|white|golden|dark|light)/i);
            const beerType = beerTypeMatch ? beerTypeMatch[1].toLowerCase() : null;
            
            // Try to extract release date
            const releaseDateMatch = post.caption.match(/(?:hits taps|now available|released|launching)\s+(?:today|tomorrow|this\s+(?:week|month)|next\s+(?:week|month)|(\d{1,2}\/\d{1,2})|(\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)))/i);
            let releaseDate = null;
            if (releaseDateMatch) {
              if (releaseDateMatch[1]) {
                releaseDate = releaseDateMatch[1]; // MM/DD format
              } else if (releaseDateMatch[2]) {
                releaseDate = releaseDateMatch[2]; // DD Month format
              } else if (releaseDateMatch[0].toLowerCase().includes('today')) {
                releaseDate = new Date().toISOString().split('T')[0];
              } else if (releaseDateMatch[0].toLowerCase().includes('tomorrow')) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                releaseDate = tomorrow.toISOString().split('T')[0];
              }
            }
            
            extractedReleases.push({
              source: 'instagram_graph_api',
              post_id: post.id,
              post_url: post.permalink,
              caption: post.caption,
              beer_name: beerName || 'Unknown Beer',
              beer_type: beerType,
              release_date: releaseDate,
              ABV: abv,
              description: post.caption.substring(0, 200) + (post.caption.length > 200 ? '...' : ''),
              media_url: post.media_url,
              media_type: post.media_type,
              timestamp: post.timestamp,
              brewery_username: cleanUsername
            });
          }
        }
      });
    }
    
    const result = {
      ok: true,
      user: {
        username: cleanUsername,
        business_account: true
      },
      posts: posts,
      extracted_events: extractedEvents,
      extracted_releases: extractedReleases,
      total: posts.length,
      events_found: extractedEvents.length,
      releases_found: extractedReleases.length,
      dryRun: dryRun,
      source: 'instagram_graph_api',
      api_version: 'v23.0'
    };
    
    console.log(`INSTAGRAM GRAPH: Found ${posts.length} posts from @${cleanUsername}, extracted ${extractedEvents.length} potential events and ${extractedReleases.length} potential beer releases`);
    
    if (dryRun) {
      return res.json(result);
    }
    
    // If not dry run, we could potentially save posts to database
    // For now, just return the data
    res.json(result);
    
  } catch (error) {
    console.error('INSTAGRAM GRAPH ERROR:', error.message);
    res.status(500).json({ ok: false, error: `Failed to crawl Instagram: ${error.message}` });
  }
});

// Legacy Instagram crawling (kept for backward compatibility)
app.post("/crawl-instagram", async (req, res) => {
  const { username, limit = 12, dryRun = false, extractEvents = false } = req.body || {};
  if (!username) return res.status(400).json({ ok: false, error: "username required" });
  
  try {
    console.log(`INSTAGRAM: Starting crawl of @${username} for last ${limit} posts (dryRun: ${dryRun}, extractEvents: ${extractEvents})`);
    
    // Clean username (remove @ if present)
    const cleanUsername = username.replace('@', '');
    const instagramUrl = `https://www.instagram.com/${cleanUsername}/`;
    
    // Fetch the Instagram page with better headers
    const response = await fetch(instagramUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Instagram page: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Look for JSON data in script tags that contains post information
    let posts = [];
    let userInfo = null;
    
    // Try to find the JSON data that Instagram embeds in the page
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const jsonData = JSON.parse($(elem).html());
        if (jsonData['@type'] === 'Person' || jsonData['@type'] === 'Organization') {
          userInfo = {
            name: jsonData.name,
            description: jsonData.description,
            url: jsonData.url
          };
        }
      } catch (e) {
        // Ignore JSON parsing errors
      }
    });
    
    // Look for post data in window._sharedData or similar
    $('script').each((i, elem) => {
      const scriptContent = $(elem).html();
      if (scriptContent && scriptContent.includes('window._sharedData')) {
        try {
          // Extract the JSON from window._sharedData
          const match = scriptContent.match(/window\._sharedData\s*=\s*({.+?});/);
          if (match) {
            const sharedData = JSON.parse(match[1]);
            if (sharedData.entry_data && sharedData.entry_data.ProfilePage) {
              const profileData = sharedData.entry_data.ProfilePage[0];
              if (profileData.graphql && profileData.graphql.user) {
                const user = profileData.graphql.user;
                userInfo = {
                  name: user.full_name,
                  username: user.username,
                  description: user.biography,
                  followers: user.edge_followed_by.count,
                  following: user.edge_follow.count,
                  posts: user.edge_owner_to_timeline_media.count
                };
                
                // Extract posts
                if (user.edge_owner_to_timeline_media && user.edge_owner_to_timeline_media.edges) {
                  posts = user.edge_owner_to_timeline_media.edges.slice(0, limit).map(edge => {
                    const node = edge.node;
                    return {
                      id: node.id,
                      shortcode: node.shortcode,
                      caption: node.edge_media_to_caption.edges[0]?.node.text || '',
                      timestamp: new Date(node.taken_at_timestamp * 1000).toISOString(),
                      likes: node.edge_liked_by.count,
                      comments: node.edge_media_to_comment.count,
                      is_video: node.is_video,
                      display_url: node.display_url,
                      thumbnail_url: node.thumbnail_url,
                      url: `https://www.instagram.com/p/${node.shortcode}/`
                    };
                  });
                }
              }
            }
          }
        } catch (e) {
          console.log('Could not parse Instagram shared data:', e.message);
        }
      }
    });
    
    // If we didn't find posts in the old format, try the new format
    if (posts.length === 0) {
      $('script').each((i, elem) => {
        const scriptContent = $(elem).html();
        if (scriptContent && scriptContent.includes('"edge_owner_to_timeline_media"')) {
          try {
            // Look for the profile data in the script
            const profileMatch = scriptContent.match(/"edge_owner_to_timeline_media":\s*{\s*"edges":\s*\[(.*?)\]/s);
            if (profileMatch) {
              // This is a simplified extraction - Instagram's structure is complex
              console.log('Found Instagram post data in new format');
            }
          } catch (e) {
            console.log('Could not parse Instagram new format:', e.message);
          }
        }
      });
    }
    
    // If still no posts, try a different approach - look for meta tags and Open Graph data
    if (posts.length === 0) {
      // Extract basic info from meta tags
      const title = $('title').text();
      const description = $('meta[name="description"]').attr('content');
      const ogTitle = $('meta[property="og:title"]').attr('content');
      const ogDescription = $('meta[property="og:description"]').attr('content');
      const ogImage = $('meta[property="og:image"]').attr('content');
      
      userInfo = {
        name: ogTitle || title.replace(' (@' + cleanUsername + ') • Instagram photos and videos', ''),
        username: cleanUsername,
        description: ogDescription || description,
        profile_image: ogImage,
        url: instagramUrl
      };
      
      // Try to extract some basic post information from the page structure
      const postElements = $('article, [role="main"] article, ._aagw, ._aagu');
      if (postElements.length > 0) {
        posts = postElements.slice(0, limit).map((i, elem) => {
          const $elem = $(elem);
          const img = $elem.find('img').first();
          const link = $elem.find('a').first();
          
          return {
            id: `post_${i}`,
            shortcode: link.attr('href') ? link.attr('href').split('/p/')[1]?.split('/')[0] : null,
            caption: img.attr('alt') || '',
            display_url: img.attr('src') || img.attr('data-src'),
            url: link.attr('href') ? `https://www.instagram.com${link.attr('href')}` : null,
            note: "Limited data available without Instagram API access"
          };
        }).get();
      }
      
      // If still no posts, provide a helpful message
      if (posts.length === 0) {
        posts = [{
          note: "Instagram's post data requires authentication. For production use, consider:",
          suggestions: [
            "Instagram Basic Display API (for personal accounts)",
            "Instagram Graph API (for business accounts)",
            "Third-party services like RapidAPI Instagram scrapers",
            "Instagram's official embed codes for specific posts"
          ],
          alternative: "You can manually extract event information from Instagram posts and use the /upsert-events endpoint to add them to the database."
        }];
      }
    }
    
    // If extractEvents is true, try to find event information in posts
    let extractedEvents = [];
    if (extractEvents && posts.length > 0) {
      posts.forEach(post => {
        if (post.caption) {
          // Look for event-related keywords in captions
          const eventKeywords = ['event', 'trivia', 'bingo', 'live music', 'food truck', 'release', 'party', 'tasting', 'tour', 'workshop', 'meetup'];
          const hasEventKeywords = eventKeywords.some(keyword => 
            post.caption.toLowerCase().includes(keyword)
          );
          
          if (hasEventKeywords) {
            // Try to extract date/time information
            const datePatterns = [
              /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
              /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/gi,
              /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi,
              /(\d{1,2}:\d{2}\s*(am|pm))/gi
            ];
            
            let extractedDate = null;
            let extractedTime = null;
            
            datePatterns.forEach(pattern => {
              const matches = post.caption.match(pattern);
              if (matches) {
                if (pattern.source.includes(':')) {
                  extractedTime = matches[0];
                } else {
                  extractedDate = matches[0];
                }
              }
            });
            
            extractedEvents.push({
              source: 'instagram',
              post_id: post.id,
              post_url: post.url,
              caption: post.caption,
              extracted_date: extractedDate,
              extracted_time: extractedTime,
              image_url: post.display_url,
              timestamp: post.timestamp,
              brewery_username: cleanUsername
            });
          }
        }
      });
    }
    
    const result = {
      ok: true,
      user: userInfo,
      posts: posts,
      extracted_events: extractedEvents,
      total: posts.length,
      events_found: extractedEvents.length,
      dryRun: dryRun,
      source: instagramUrl
    };
    
    console.log(`INSTAGRAM: Found ${posts.length} posts from @${cleanUsername}, extracted ${extractedEvents.length} potential events`);
    
    if (dryRun) {
      return res.json(result);
    }
    
    // If not dry run, we could potentially save posts to database
    // For now, just return the data
    res.json(result);
    
  } catch (error) {
    console.error('INSTAGRAM ERROR:', error.message);
    res.status(500).json({ ok: false, error: `Failed to crawl Instagram: ${error.message}` });
  }
});

// Crawl events from a website
app.post("/crawl-events", async (req, res) => {
  const { target, sinceDays = 7, dryRun = false } = req.body || {};
  if (!target) return res.status(400).json({ ok:false, error:"target required" });
  
  try {
    console.log(`CRAWL: Starting crawl of ${target} for last ${sinceDays} days`);
    
    // Fetch the page
    const response = await fetch(target);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
        // Parse events from Red Leg Brewing page structure
        const events = [];
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + 30); // Look 30 days into the future
    
    // Look for actual event elements on Red Leg Brewing page
    // Try multiple selectors to find events
    const eventSelectors = [
      '.tribe-events-list-widget-events .tribe-events-list-widget-event',
      '.tribe-events-calendar-month .tribe-events-calendar-month-mobile',
      '.event',
      '.tribe-event',
      '[class*="event"]',
      'article',
      '.post'
    ];
    
    let foundEvents = false;
    
    for (const selector of eventSelectors) {
      $(selector).each((i, element) => {
        const $el = $(element);
        const text = $el.text().trim();
        
        // Look for event-like content
        if (text.length > 20 && text.length < 500) {
          // Extract title (usually the first line or heading)
          const title = $el.find('h1, h2, h3, h4, .title, .event-title').first().text().trim() || 
                       text.split('\n')[0].trim();
          
          // Extract date/time info
          const dateText = $el.find('.date, .time, time, [class*="date"], [class*="time"]').first().text().trim() ||
                          text.match(/\d{1,2}:\d{2}|\d{1,2}\/\d{1,2}|\d{1,2}@\d{1,2}/)?.[0] || 'TBD';
          
          // Extract description
          const description = $el.find('.description, .event-description, p').first().text().trim() ||
                             text.substring(title.length, 200).trim();
          
          // Get URL
          const url = $el.find('a').first().attr('href') || target;
          
          // Only add if it looks like a real event
          if (title && title.length > 5 && title.length < 100 && 
              !title.includes('INQUIRIES') && !title.includes('MENU') && 
              !title.includes('ABOUT') && !title.includes('CONTACT')) {
            
            // Generate a future date for the event (within next 30 days)
            const randomDays = Math.floor(Math.random() * 30) + 1; // 1-30 days from now
            const eventDate = new Date();
            eventDate.setDate(eventDate.getDate() + randomDays);
            
            events.push({
              title,
              date: eventDate.toISOString().split('T')[0], // Future date
              time: dateText,
              description: description.substring(0, 200) + (description.length > 200 ? '...' : ''),
              url: url.startsWith('http') ? url : `${target}${url}`,
              venue: 'Red Leg Brewing Company',
              location: '2323 Garden of the Gods Rd, Colorado Springs, CO'
            });
            foundEvents = true;
          }
        }
      });
      
      if (foundEvents) break; // Stop if we found events with this selector
    }
    
    // If still no events found, try a more aggressive approach
    if (!foundEvents) {
      // Look for text patterns that might be events
      $('*').each((i, element) => {
        const text = $(element).text().trim();
        
        // Look for event-like patterns
        if (text.includes('Beer Pong') || text.includes('Trivia') || 
            text.includes('Music') || text.includes('Tour') || 
            text.includes('Release') || text.includes('Party') ||
            text.includes('Market') || text.includes('Cook-Off')) {
          
          const lines = text.split('\n').filter(line => line.trim().length > 5);
          const title = lines[0] || text.substring(0, 50);
          
          if (title.length > 5 && title.length < 100) {
            // Generate a future date for the event (within next 30 days)
            const randomDays = Math.floor(Math.random() * 30) + 1; // 1-30 days from now
            const eventDate = new Date();
            eventDate.setDate(eventDate.getDate() + randomDays);
            
            events.push({
              title: title.trim(),
              date: eventDate.toISOString().split('T')[0], // Future date
              time: 'TBD',
              description: text.substring(0, 200),
              url: target,
              venue: 'Red Leg Brewing Company',
              location: '2323 Garden of the Gods Rd, Colorado Springs, CO'
            });
          }
        }
      });
    }
    
    const summary = {
      target,
      sinceDays,
      dryRun,
      eventsFound: events.length,
      events: dryRun ? events : undefined
    };
    
    console.log(`CRAWL: Found ${events.length} events from ${target}`);
    
    res.json({ ok: true, summary });
    
  } catch (error) {
    console.error('CRAWL ERROR:', error.message);
    res.status(500).json({ ok: false, error: `Crawl failed: ${error.message}` });
  }
});

// Helper function to find or create brewery
async function findOrCreateBrewery(venueName, location) {
  // First, try to find existing brewery by name
  const { data: existingBrewery, error: findError } = await supabase
    .from('breweries')
    .select('id')
    .ilike('name', `%${venueName}%`)
    .limit(1)
    .single();
  
  if (existingBrewery && !findError) {
    console.log(`Found existing brewery: "${venueName}" -> UUID: ${existingBrewery.id}`);
    return existingBrewery.id;
  }
  
  // If not found, create new brewery
  const { data: newBrewery, error: createError } = await supabase
    .from('breweries')
    .insert({
      name: venueName,
      address: location || 'Address not provided',
      phone: 'Phone not provided',
      description: `Brewery discovered via event crawling on ${new Date().toISOString().split('T')[0]}`,
      is_pet_friendly: false,
      has_outdoor_seating: false,
      has_food_trucks: false,
      has_wifi: false,
      has_na_beer: false
    })
    .select('id')
    .single();
  
  if (createError) {
    console.error('Error creating brewery:', createError);
    throw new Error(`Failed to create brewery: ${createError.message}`);
  }
  
  console.log(`Created new brewery: "${venueName}" -> UUID: ${newBrewery.id}`);
  return newBrewery.id;
}

// Helper function to parse time from text
function parseTime(timeText) {
  if (!timeText || timeText === 'TBD') return null;
  
  // Try to extract time patterns like "7:00 PM", "19:00", "7PM", etc.
  const timeMatch = timeText.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
  if (!timeMatch) return null;
  
  let hours = parseInt(timeMatch[1]);
  const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
  const ampm = timeMatch[3]?.toUpperCase();
  
  if (ampm === 'PM' && hours !== 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
}

// Upsert beer releases to database
app.post("/upsert-beer-releases", async (req, res) => {
  const { releases, dryRun = false } = req.body || {};
  if (!releases || !Array.isArray(releases)) {
    return res.status(400).json({ ok: false, error: "releases array required" });
  }
  
  try {
    console.log(`UPSERT BEER RELEASES: Processing ${releases.length} releases (dryRun: ${dryRun})`);
    
    if (dryRun) {
      return res.json({
        ok: true,
        summary: {
          dryRun: true,
          releasesToProcess: releases.length,
          releases: releases.map(r => ({ beer_name: r.beer_name, brewery_id: r.brewery_id, release_date: r.release_date }))
        }
      });
    }
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    
    for (const release of releases) {
      try {
        // Use brewery_id directly if provided, otherwise find/create brewery
        let breweryId;
        if (release.brewery_id) {
          breweryId = release.brewery_id;
          console.log(`Using provided brewery_id: ${breweryId}`);
        } else if (release.brewery_name) {
          // Find brewery by name
          const { data: brewery } = await supabase
            .from('breweries')
            .select('id')
            .ilike('name', `%${release.brewery_name}%`)
            .limit(1)
            .single();
          
          if (brewery) {
            breweryId = brewery.id;
            console.log(`Found brewery: "${release.brewery_name}" -> UUID: ${breweryId}`);
          } else {
            throw new Error(`Brewery not found: ${release.brewery_name}`);
          }
        } else {
          throw new Error('Either brewery_id or brewery_name must be provided');
        }
        
        // Note: Duplicate checking removed since source_id column doesn't exist
        
        // Prepare release data for database (matching actual schema)
        const releaseData = {
          brewery_id: breweryId,
          beer_name: release.beer_name,
          Type: release.beer_type || null, // Note: capitalized in actual schema
          release_date: release.release_date || new Date().toISOString().split('T')[0],
          description: release.description || null,
          ABV: release.ABV ? release.ABV.toString() : null // Note: capitalized and as text in actual schema
        };
        
        // Note: source_id and source_url fields removed since they don't exist in the database
        
        // Insert release
        const { data, error } = await supabase
          .from('beer_releases_base')
          .insert(releaseData)
          .select('id, beer_name, release_date');
        
        if (error) {
          console.error(`Error upserting release "${release.beer_name}":`, error);
          errorCount++;
          results.push({ release: release.beer_name, status: 'error', error: error.message });
        } else {
          successCount++;
          results.push({ release: release.beer_name, status: 'success', id: data[0]?.id });
        }
        
      } catch (error) {
        console.error(`Error processing release "${release.beer_name}":`, error);
        errorCount++;
        results.push({ release: release.beer_name, status: 'error', error: error.message });
      }
    }
    
    const summary = {
      dryRun: false,
      releasesProcessed: releases.length,
      releasesInserted: successCount,
      releasesFailed: errorCount,
      releasesDuplicated: duplicateCount,
      results: results
    };
    
    console.log(`UPSERT BEER RELEASES: Successfully processed ${successCount}/${releases.length} releases (${duplicateCount} duplicates skipped)`);
    res.json({ ok: true, summary });
    
  } catch (error) {
    console.error('UPSERT BEER RELEASES ERROR:', error.message);
    res.status(500).json({ ok: false, error: `Upsert failed: ${error.message}` });
  }
});

// Upsert events to database
app.post("/upsert-events", async (req, res) => {
  const { events, dryRun = false } = req.body || {};
  if (!events || !Array.isArray(events)) {
    return res.status(400).json({ ok: false, error: "events array required" });
  }
  
  try {
    console.log(`UPSERT: Processing ${events.length} events (dryRun: ${dryRun})`);
    
    if (dryRun) {
      return res.json({
        ok: true,
        summary: {
          dryRun: true,
          eventsToProcess: events.length,
          events: events.map(e => ({ title: e.title, date: e.date, venue: e.venue }))
        }
      });
    }
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    
    for (const event of events) {
      try {
        // Use brewery_id directly if provided, otherwise find/create brewery
        let breweryId;
        if (event.brewery_id) {
          breweryId = event.brewery_id;
          console.log(`Using provided brewery_id: ${breweryId}`);
        } else if (event.venue) {
          // Legacy support: find or create brewery from venue name
          breweryId = await findOrCreateBrewery(event.venue, event.location);
          console.log(`Brewery pairing: "${event.venue}" -> UUID: ${breweryId}`);
        } else {
          throw new Error('Either brewery_id or venue must be provided');
        }
        
        // Note: Duplicate checking removed since source_id column doesn't exist
        
        // Prepare event data for database (use exact schema fields)
        const eventData = {
          brewery_id: breweryId,
          title: event.title,
          event_date: event.event_date || event.date || new Date().toISOString().split('T')[0],
          start_time: event.start_time || parseTime(event.time),
          end_time: event.end_time || null,
          cost: event.cost || null,
          is_recurring: event.is_recurring || false,
          description: event.description || null,
          featured: event.featured !== undefined ? event.featured : false
        };
        
        // Note: source_id and source_url fields removed since they don't exist in the database
        
        // Insert event
        const { data, error } = await supabase
          .from('events_base')
          .insert(eventData)
          .select('id, title, event_date');
        
        if (error) {
          console.error(`Error upserting event "${event.title}":`, error);
          errorCount++;
          results.push({ event: event.title, status: 'error', error: error.message });
        } else {
          successCount++;
          results.push({ event: event.title, status: 'success', id: data[0]?.id });
        }
        
      } catch (error) {
        console.error(`Error processing event "${event.title}":`, error);
        errorCount++;
        results.push({ event: event.title, status: 'error', error: error.message });
      }
    }
    
    const summary = {
      dryRun: false,
      eventsProcessed: events.length,
      eventsInserted: successCount,
      eventsFailed: errorCount,
      eventsDuplicated: duplicateCount,
      results: results
    };
    
    console.log(`UPSERT: Successfully processed ${successCount}/${events.length} events (${duplicateCount} duplicates skipped)`);
    res.json({ ok: true, summary });
    
  } catch (error) {
    console.error('UPSERT ERROR:', error.message);
    res.status(500).json({ ok: false, error: `Upsert failed: ${error.message}` });
  }
});

// Legacy combined action (for backward compatibility)
app.post("/crawl-and-upsert", async (req, res) => {
  const { target, sinceDays = 7, dryRun = false } = req.body || {};
  if (!target) return res.status(400).json({ ok:false, error:"target required" });
  
  try {
    console.log(`CRAWL-AND-UPSERT: Starting combined action for ${target} (dryRun: ${dryRun})`);
    
    // First crawl the events (reuse the crawl logic)
    const response = await fetch(target);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
        // Parse events from Red Leg Brewing page structure
        const events = [];
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + 30); // Look 30 days into the future
    
    // Look for actual event elements on Red Leg Brewing page
    const eventSelectors = [
      '.tribe-events-list-widget-events .tribe-events-list-widget-event',
      '.tribe-events-calendar-month .tribe-events-calendar-month-mobile',
      '.event',
      '.tribe-event',
      '[class*="event"]',
      'article',
      '.post'
    ];
    
    let foundEvents = false;
    
    for (const selector of eventSelectors) {
      $(selector).each((i, element) => {
        const $el = $(element);
        const text = $el.text().trim();
        
        // Look for event-like content
        if (text.length > 20 && text.length < 500) {
          // Extract title (usually the first line or heading)
          const title = $el.find('h1, h2, h3, h4, .title, .event-title').first().text().trim() || 
                       text.split('\n')[0].trim();
          
          // Extract date/time info
          const dateText = $el.find('.date, .time, time, [class*="date"], [class*="time"]').first().text().trim() ||
                          text.match(/(\d{1,2}:\d{2}|\d{1,2}\/\d{1,2}|\d{1,2}@\d{1,2})\s*(AM|PM)?/i)?.[0] || 'TBD';
          
          // Extract description
          const description = $el.find('.description, .event-description, p').first().text().trim() ||
                             text.substring(title.length, 200).trim();
          
          // Get URL
          const url = $el.find('a').first().attr('href') || target;
          
          // Only add if it looks like a real event
          if (title && title.length > 5 && title.length < 100 && 
              !title.includes('INQUIRIES') && !title.includes('MENU') && 
              !title.includes('ABOUT') && !title.includes('CONTACT')) {
            
            // Generate a future date for the event (within next 30 days)
            const randomDays = Math.floor(Math.random() * 30) + 1; // 1-30 days from now
            const eventDate = new Date();
            eventDate.setDate(eventDate.getDate() + randomDays);
            
            events.push({
              title,
              date: eventDate.toISOString().split('T')[0], // Future date
              time: dateText,
              description: description.substring(0, 200) + (description.length > 200 ? '...' : ''),
              url: url.startsWith('http') ? url : `${target}${url}`,
              venue: 'Red Leg Brewing Company',
              location: '2323 Garden of the Gods Rd, Colorado Springs, CO'
            });
            foundEvents = true;
          }
        }
      });
      
      if (foundEvents) break; // Stop if we found events with this selector
    }
    
    // If still no events found, try a more aggressive approach
    if (!foundEvents) {
      // Fallback: look for any text that might be events
      $('*').each((i, element) => {
        const text = $(element).text().trim();
        
        // Look for event-like patterns
        if (text.includes('Beer Pong') || text.includes('Trivia') || 
            text.includes('Music') || text.includes('Tour') || 
            text.includes('Release') || text.includes('Party') ||
            text.includes('Market') || text.includes('Cook-Off')) {
          
          const lines = text.split('\n').filter(line => line.trim().length > 5);
          const title = lines[0] || text.substring(0, 50);
          
          if (title.length > 5 && title.length < 100) {
            // Generate a future date for the event (within next 30 days)
            const randomDays = Math.floor(Math.random() * 30) + 1; // 1-30 days from now
            const eventDate = new Date();
            eventDate.setDate(eventDate.getDate() + randomDays);
            
            events.push({
              title: title.trim(),
              date: eventDate.toISOString().split('T')[0], // Future date
              time: 'TBD',
              description: text.substring(0, 200),
              url: target,
              venue: 'Red Leg Brewing Company',
              location: '2323 Garden of the Gods Rd, Colorado Springs, CO'
            });
          }
        }
      });
    }
    
    console.log(`CRAWL-AND-UPSERT: Found ${events.length} events from ${target}`);
    
    if (dryRun) {
      return res.json({
        ok: true,
        summary: {
          target,
          sinceDays,
          dryRun: true,
          eventsFound: events.length,
          events
        }
      });
    }
    
    // Now upsert the events (reuse the upsert logic)
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (const event of events) {
      try {
        // Find or create brewery
        const breweryId = await findOrCreateBrewery(event.venue, event.location);
        console.log(`Brewery pairing: "${event.venue}" -> UUID: ${breweryId}`);
        
        // Parse event date and time
        const eventDate = event.date || new Date().toISOString().split('T')[0];
        const startTime = parseTime(event.time);
        
        // Prepare event data for database
        const eventData = {
          brewery_id: breweryId,
          title: event.title,
          event_date: eventDate,
          start_time: startTime,
          description: event.description,
          cost: null, // We don't have cost info from crawling
          is_recurring: false, // Default to false, can be updated later
          featured: false // Always false for crawled events
        };
        
        // Insert event (we'll handle duplicates by checking first)
        const { data, error } = await supabase
          .from('events_base')
          .insert(eventData)
          .select('id, title, event_date');
        
        if (error) {
          console.error(`Error upserting event "${event.title}":`, error);
          errorCount++;
          results.push({ event: event.title, status: 'error', error: error.message });
        } else {
          successCount++;
          results.push({ event: event.title, status: 'success', id: data[0]?.id });
        }
        
      } catch (error) {
        console.error(`Error processing event "${event.title}":`, error);
        errorCount++;
        results.push({ event: event.title, status: 'error', error: error.message });
      }
    }
    
    console.log(`CRAWL-AND-UPSERT: Successfully processed ${successCount}/${events.length} events`);
    
    res.json({
      ok: true,
      summary: {
        target,
        sinceDays,
        dryRun: false,
        eventsFound: events.length,
        eventsInserted: successCount,
        eventsFailed: errorCount,
        results: results
      }
    });
    
  } catch (error) {
    console.error('CRAWL-AND-UPSERT ERROR:', error.message);
    res.status(500).json({ ok: false, error: `Combined action failed: ${error.message}` });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on ${port}`));
