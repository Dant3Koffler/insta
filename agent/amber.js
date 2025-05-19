import 'dotenv/config';
import { TwitterApi } from 'twitter-api-v2';
import { OpenAI }     from 'openai';
import axios          from 'axios';
import fs             from 'fs/promises';
import { createToken } from '../src/pumpfun.js';

//
// —— Init clients & globals ——
console.log('Loading environment and initializing clients…');
const twitter = new TwitterApi({
  appKey:       process.env.TWITTER_API_KEY,
  appSecret:    process.env.TWITTER_API_KEY_SECRET,
  accessToken:  process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});
console.log('✅ Twitter client initialized');

const aiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
console.log('✅ OpenAI client initialized');

//
// —— DexScreener client ——
const dexscreener = axios.create({ baseURL: 'https://api.dexscreener.com' });
console.log('✅ DexScreener client initialized');

let botUserId;
const seenMentions = new Set();

//
// —— Timing constants ——
const MIN_DELAY_MS              = 22 * 60 * 1000;      // 22 minutes
const MAX_DELAY_MS              = 3.42 * 3600 * 1000;  // 3.42 hours
const NORMAL_MENTION_INTERVAL   = 2 * 60 * 1000;       // 2 minutes

//
// —— Load influencer handles from CT.txt ——
console.log('Reading CT.txt for influencer handles…');
const influencerHandles = (
  await fs.readFile(new URL('./CT.txt', import.meta.url), 'utf-8')
)
  .split(/\r?\n/)
  .map(l => l.trim().replace(/^@/, ''))
  .filter(Boolean);
console.log('✅ Loaded influencer handles:', influencerHandles);

const influencerMap = {};   // handle → userId

//
// —— GPT function definitions & examples ——
const entityFunction = {
  name: "extract_entities",
  description: "extract tickers names and slang from tweet text",
  parameters: {
    type: "object",
    properties: {
      tickers: { type: "array", items: { type: "string" } },
      names:   { type: "array", items: { type: "string" } },
      slang:   { type: "array", items: { type: "string" } }
    },
    required: ["tickers","names","slang"]
  }
};

const examples = [
  { role: "system", content: "you are a precise entity extractor for crypto tweets respond only with function_call no punctuation or emojis" },
  { role: "user",   content: "just bought some bitcoin and solana before the next pump" },
  { role: "assistant", function_call: { name: "extract_entities", arguments: {"tickers":[],"names":["bitcoin","solana"],"slang":[]} } },
  { role: "user",   content: "lambo gang going ape on dogecoin right now haha" },
  { role: "assistant", function_call: { name: "extract_entities", arguments: {"tickers":["DOGE"],"names":[],"slang":["lambo gang","ape"]} } },
];

//
// —— Resolve influencer handles → user IDs ——
async function resolveInfluencers() {
  console.log('Resolving influencer handles to user IDs…');
  for (const handle of influencerHandles) {
    try {
      const resp = await twitter.v2.userByUsername(handle);
      influencerMap[handle] = resp.data.id;
      console.log(`✅ Resolved @${handle} → ${resp.data.id}`);
    } catch {
      console.warn(`⚠️ could not resolve @${handle}`);
    }
  }
}

//
// —— Fetch new tweets from influencers ——
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function fetchNewInfluencerTweets() {
  console.log('Fetching new influencer tweets…');
  const tweets = [];
  const handles = Object.keys(influencerMap);
  for (const grp of chunk(handles, 20)) {
    const query = grp.map(h => `from:${h}`).join(' OR ');
    const res = await twitter.v2.search(query, {
      max_results:    50,
      'tweet.fields': ['entities','text','id']
    });
    (res.data || []).forEach(t => tweets.push(t));
  }
  console.log(`Total tweets fetched: ${tweets.length}`);
  return tweets;
}

//
// —— GPT-powered entity extraction ——
async function extractEntitiesGPT(text) {
  console.log('Extracting entities via GPT for text:', text);
  const resp = await aiClient.chat.completions.create({
    model:     "gpt-4",
    messages:  [...examples, { role: "user", content: text }],
    functions: [entityFunction],
    function_call: { name: "extract_entities" }
  });
  const args = JSON.parse(resp.choices[0].message.function_call.arguments);
  console.log('✅ Entities extracted:', args);
  return args;
}

//
// —— Normalize entities via DexScreener ——
async function normalizeEntities({ tickers, names, slang }) {
  console.log('Normalizing entities via DexScreener:', { tickers, names, slang });
  const canonical = new Set(tickers);
  for (const term of [...names, ...slang]) {
    try {
      console.log(`→ Searching DexScreener for term: ${term}`);
      const res = await dexscreener.get(`/latest/dex/search?q=${encodeURIComponent(term)}`);
      const pair = res.data.pairs?.[0];
      const sym  = pair?.baseToken?.symbol;
      if (sym) {
        canonical.add(sym.toUpperCase());
        console.log(`   ✓ Matched ${term} → ${sym.toUpperCase()}`);
      }
    } catch {
      console.warn(`   ⚠️ DexScreener search failed for term: ${term}`);
    }
  }
  const result = [...canonical];
  console.log('✅ Normalized entities to:', result);
  return result;
}

//
// —— Rank by frequency ——
function rankEntities(all) {
  console.log('Ranking entities frequency over all mentions:', all);
  const freq = {};
  all.flat().forEach(sym => {
    freq[sym] = (freq[sym]||0) + 1;
  });
  return Object.entries(freq)
    .sort(([,a],[,b]) => b - a)
    .map(([sym]) => sym);
}

//
// —— Filter to memecoins via DexScreener trending ——
async function filterToMemecoins(tickers) {
  console.log('Filtering to memecoins via DexScreener trending:', tickers);
  try {
    const res = await dexscreener.get('/latest/dex/trending');
    const trendingSymbols = res.data.pairs.map(p => p.baseToken.symbol.toUpperCase());
    const memes = tickers.filter(sym => trendingSymbols.includes(sym.toUpperCase()));
    return memes.length ? memes : tickers.slice(0,3);
  } catch {
    console.warn('⚠️ DexScreener trending fetch failed');
    return tickers.slice(0,3);
  }
}

//
// —— Tweet influencer-driven memecoin hype ——
async function tweetInfluencerTrend() {
  console.log('--- Running tweetInfluencerTrend ---');
  const tweets = await fetchNewInfluencerTweets();
  if (!tweets.length) return;

  const raw    = await Promise.all(tweets.map(t => extractEntitiesGPT(t.text)));
  const norm   = await Promise.all(raw.map(e => normalizeEntities(e)));
  const ranked = rankEntities(norm);
  const trend  = await filterToMemecoins(ranked);
  if (!trend.length) return;

  const top    = trend.slice(0,3).join(', ');
  const prompt = `you are amber the snarky ai agent for insta meme
several influencers are hyping these memecoins on crypto twitter ${top}
roast that unstoppable memecoin mania in one tweet
respond only in lowercase letters with no punctuation or emojis`;
  const resp = await aiClient.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role:'user', content: prompt }],
    max_tokens: 60
  });
  await twitter.v2.tweet({ text: resp.choices[0].message.content.trim() });
  console.log('✅ Influencer trend tweet posted');
}

//
// —— Fetch Solana seeds via DexScreener trending ——
async function fetchSolanaSeeds() {
  console.log('Fetching Solana seeds via DexScreener trending…');
  try {
    const res = await dexscreener.get('/latest/dex/trending');
    const solPairs = res.data.pairs.filter(p => p.chain?.toLowerCase() === 'solana');
    const seeds = solPairs.map(p => p.baseToken.symbol.toUpperCase());
    return seeds.length ? seeds : ['SOL'];
  } catch {
    console.warn('⚠️ DexScreener solana seeds fetch failed');
    return ['SOL'];
  }
}

//
// —— Additional unused pipeline functions (metrics, roasting) ——
async function fetchTweets(query, max = 50) {
  const res = await twitter.v2.search(query, {
    'tweet.fields': 'public_metrics',
    max_results:    max
  });
  return res.data || [];
}

function analyzeMetrics(tweets) {
  if (!tweets.length) return { avgSent:0, avgEng:0 };
  let totalSent = 0, totalEng = 0;
  for (const t of tweets) {
    totalSent += t.text.length/280;
    totalEng  += t.public_metrics.retweet_count + t.public_metrics.like_count;
  }
  return { avgSent: totalSent/tweets.length, avgEng: totalEng/tweets.length };
}

function scoreMoon(sent, eng) {
  const engNorm = Math.min(1, eng/100);
  return Math.round(sent*50 + engNorm*50);
}

function decide(score) {
  return score >= 70 ? 'go for launch'
       : score >= 40 ? 'meh needs more juice'
       :                'too flat';
}

async function roast(trend, metrics, decision) {
  const prompt = `you are amber the snarky ai agent for insta meme stanford sophomore paul yoon's solana pumpfun memecoin launcher
your mission
mine social chatter for undertheradar solana memecoins
score moon potential 0 to 100
deliver a snarky oneliner followed by a summary line sentiment ${metrics.avgSent.toFixed(2)} engagement ${metrics.avgEng.toFixed(1)} score ${metrics.score} arrow ${decision}
trend ${trend}
respond only in lowercase letters with no punctuation or emojis`;
  const res = await aiClient.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role:'user', content: prompt }],
    max_tokens: 120
  });
  return res.choices[0].message.content.trim();
}

//
// —— DexScreener-based assessment function ——
async function assessCoinProposal(proposal) {
  console.log(`Assessing "${proposal}" via DexScreener…`);

  // 1. Search DexScreener for similar tokens
  const searchRes = await dexscreener.get(`/latest/dex/search?q=${encodeURIComponent(proposal)}`);
  const sims = searchRes.data.pairs
    .map(p => p.baseToken.symbol.toUpperCase())
    .filter(sym => sym !== proposal.toUpperCase())
    .slice(0, 3);

  // 2. Fetch trending data for 24h change
  const trendRes = await dexscreener.get('/latest/dex/trending');
  const trending = trendRes.data.pairs;

  // 3. Build performance summary
  const perf = sims.map(sym => {
    const pair = trending.find(p => p.baseToken.symbol.toUpperCase() === sym);
    const change = pair?.priceChange24hPercent ?? 0;
    return { symbol: sym, change: change.toFixed(1) };
  });

  const lines = perf.length
    ? perf.map(p => `• ${p.symbol} ${p.change}% over 24h`).join('\n')
    : '• no clear peers found';

  // 4. Ask GPT for a snarky verdict
  const prompt = `you are amber the snarky ai agent for insta meme
a user asked if launching ${proposal.toUpperCase()} is a good idea
here is how similar tokens performed recently
${lines}
give a snarky two- or three-sentence verdict on whether ${proposal.toUpperCase()} is smart or just hype
respond only in lowercase letters with no punctuation or emojis`;
  const res = await aiClient.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 80
  });
  return res.choices[0].message.content.trim();
}

//
// —— General mention reply ——
async function replyGeneral(mention) {
  const txt = mention.text.replace(/@amber\.meme/gi, '').trim();
  const prompt = `you are amber the snarky ai agent for insta meme
when asked about anything not related to memecoins or token minting reply like a normal human with your signature snark
user says ${txt}
respond only in lowercase letters with no punctuation or emojis`;
  const res = await aiClient.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role:'user', content: prompt }],
    max_tokens: 100
  });
  return res.choices[0].message.content.trim();
}

// Add blacklist file path
const BLACKLIST_FILE = './blacklist.json';

// Add function to manage blacklist
async function loadBlacklist() {
  try {
    const data = await fs.readFile(BLACKLIST_FILE, 'utf-8');
    return new Set(JSON.parse(data));
  } catch {
    return new Set();
  }
}

async function saveBlacklist(blacklist) {
  await fs.writeFile(BLACKLIST_FILE, JSON.stringify([...blacklist]));
}

// Add restart function
async function restartAmberAgent() {
  console.log('🔄 Restarting Amber Agent...');
  try {
    await startAmberAgent();
  } catch (error) {
    console.error('❌ Failed to restart Amber Agent:', error);
    // Try again after 1 minute
    setTimeout(restartAmberAgent, 60 * 1000);
  }
}

//
// —— Check mentions and handle mint/assess/general ——
async function checkMentions() {
  console.log('--- Checking mentions ---');
  console.log('botUserId is', botUserId);

  // Load blacklist
  const blacklist = await loadBlacklist();

  let resp;
  try {
    resp = await twitter.v2.userMentionTimeline(botUserId, {
      max_results:    20,
      expansions:     ['attachments.media_keys','author_id'],
      'media.fields': ['url'],
      'tweet.fields': ['entities','text','attachments']
    });
  } catch (e) {
    console.error('❌ Error fetching mentions:', e);
    if (e.code === 403) {
      console.log('⚠️ Got 403 error, will restart after 1 minute...');
      setTimeout(restartAmberAgent, 60 * 1000); // Restart after 1 minute
    }
    return scheduleNextMentionCheck(NORMAL_MENTION_INTERVAL);
  }

  // **DEBUG: print the raw structure you got back**
  console.log('Raw resp.data:', JSON.stringify(resp.data, null, 2));

  // normalize into a true array
  const mentions = Array.isArray(resp.data)
    ? resp.data
    : Array.isArray(resp.data?.data)
      ? resp.data.data
      : [];

  // **DEBUG: how many mentions did we find?**
  console.log(`found ${mentions.length} mentions`);

  const mediaMap = (resp.includes?.media || [])
    .reduce((m,i) => { m[i.media_key] = i; return m; }, {});

  const BOT_HANDLES = ['@wawa15802533052']; // Add all possible handles

  for (const m of [...mentions].reverse()) {
    // Strictly check if the tweet mentions the bot
    const textLower = m.text.toLowerCase();
    if (!BOT_HANDLES.some(h => textLower.includes(h))) {
      console.log('   • does not mention bot, skipping');
      continue;
    }
    console.log('→ Processing mention id=', m.id, 'text=', m.text);
    
    // Check if already replied (in blacklist)
    if (blacklist.has(m.id)) {
      console.log('   • already replied, skipping');
      continue;
    }

    // Check if already seen in this session
    if (seenMentions.has(m.id)) {
      console.log('   • already seen in this session, skipping');
      continue;
    }
    seenMentions.add(m.id);

    try {
    const rawText = m.text.replace(/@amberdotmeme/gi, '').trim();
    const txt = rawText.toLowerCase();
    const hasImage = Array.isArray(m.attachments?.media_keys);
    const isMint = txt.includes('/') && hasImage;
    const isTickerOnly = /^[a-z0-9]{2,6}$/.test(txt);
    const isDeployQuestion = /deployed.*would it do (good|well)/i.test(txt);

    if (isMint) {
        // —— Mint logic ——
        console.log(`   🔍 Detected mint request in mention ${m.id}: ${txt}`);
      const [name, ticker] = txt.split(/\s+/)[0].split('/');
        console.log(`   → Parsed name=${name}, ticker=${ticker}`);
      const mediaKey = m.attachments.media_keys[0];
      const url      = mediaMap[mediaKey]?.url;
        console.log(`   → Downloading image from ${url}`);
      const buf         = await axios.get(url, { responseType:'arraybuffer' });
      const imageBase64 = Buffer.from(buf.data).toString('base64');
      console.log('   ✅ Image downloaded and encoded');
        const tweetUrl = `https://twitter.com/${m.author_id}/status/${m.id}`;
      const result   = await createToken(name, ticker, imageBase64, tweetUrl);
      console.log('   ✅ Token creation result:', result);

        const mintPrompt = `you are amber the snarky ai agent for insta meme
a user @${m.author_id} requested name ${name} ticker ${ticker} link ${result.success ? result.pumpFunLink : 'na'}
${result.success
  ? 'compose a playful sarcastic oneliner announcing that the token is live and include the link'
  : `compose a witty apology referencing the error ${result.error}`}
respond only in lowercase letters with no punctuation or emojis`;
      console.log('   → GPT prompt for mint reply:', mintPrompt.trim());
      const r = await aiClient.chat.completions.create({
        model:'gpt-4',
        messages:[{ role:'user', content: mintPrompt }],
        max_tokens: 80
      });
      const reply = r.choices[0].message.content.trim();
      console.log('   ✅ Generated mint reply:', reply);
        const authorUsername = m.author_id ? (m.author_username || m.username || null) : null;
        let userTag = authorUsername ? `@${authorUsername}` : '';
        // If username is not available, fallback to '@user' (Twitter API v2 may require extra fetch for username)
        if (!userTag && m.author_id) {
          try {
            const userResp = await twitter.v2.user(m.author_id);
            userTag = `@${userResp.data.username}`;
          } catch {
            userTag = '@user';
          }
        }
        const replyText = `${userTag} ${reply}`;
      await twitter.v2.tweet({
          text: replyText,
        reply: { in_reply_to_tweet_id: m.id }
      });
      console.log('   ✅ Mint reply posted');
        // Add to blacklist after successful reply
        blacklist.add(m.id);
        await saveBlacklist(blacklist);
      continue;
    }

    if (isTickerOnly || isDeployQuestion) {
        console.log(`   🔍 Detected assessment request: ${txt}`);
      let proposal = txt;
      if (!isTickerOnly) {
        const ents = await extractEntitiesGPT(rawText);
        proposal = (ents.tickers[0] || ents.names[0] || txt).toUpperCase();
      }
      const verdict = await assessCoinProposal(proposal);
        console.log(`   ✅ Posting assessment reply: ${verdict}`);
        const authorUsername = m.author_id ? (m.author_username || m.username || null) : null;
        let userTag = authorUsername ? `@${authorUsername}` : '';
        // If username is not available, fallback to '@user' (Twitter API v2 may require extra fetch for username)
        if (!userTag && m.author_id) {
          try {
            const userResp = await twitter.v2.user(m.author_id);
            userTag = `@${userResp.data.username}`;
          } catch {
            userTag = '@user';
          }
        }
        const verdictText = `${userTag} ${verdict}`;
        await twitter.v2.tweet({
          text: verdictText,
          reply: { in_reply_to_tweet_id: m.id }
        });
        // Add to blacklist after successful reply
        blacklist.add(m.id);
        await saveBlacklist(blacklist);
        continue;
      }

      console.log(`   🔍 Treating as general mention`);
      const gen = await replyGeneral(m);
      console.log(`   ✅ Generated general reply: ${gen}`);
      const authorUsername = m.author_id ? (m.author_username || m.username || null) : null;
      let userTag = authorUsername ? `@${authorUsername}` : '';
      // If username is not available, fallback to '@user' (Twitter API v2 may require extra fetch for username)
      if (!userTag && m.author_id) {
        try {
          const userResp = await twitter.v2.user(m.author_id);
          userTag = `@${userResp.data.username}`;
        } catch {
          userTag = '@user';
        }
      }
      const genText = `${userTag} ${gen}`;
      await twitter.v2.tweet({
        text: genText,
        reply: { in_reply_to_tweet_id: m.id }
      });
      console.log('   ✅ General reply posted');
      // Add to blacklist after successful reply
      blacklist.add(m.id);
      await saveBlacklist(blacklist);
    } catch (error) {
      console.error(`❌ Error processing mention ${m.id}:`, error);
      if (error.code === 403) {
        console.log('⚠️ Got 403 error, will restart after 1 minute...');
        setTimeout(restartAmberAgent, 60 * 1000); // Restart after 1 minute
      }
      // Continue with next mention even if this one failed
      continue;
    }
  }

  scheduleNextMentionCheck(NORMAL_MENTION_INTERVAL);
}

function scheduleNextMentionCheck(delayMs) {
  setTimeout(checkMentions, delayMs);
}

//
// —— Auto-tweet loop ——
async function tweetAuto() {
  console.log('--- Running tweetAuto ---');
  const seeds = await fetchSolanaSeeds();
  const r     = Math.random();
  let prompt;

  if (r < 0.30 && seeds.length) {
    prompt = `you are amber the snarky ai agent for insta meme
roast this undertheradar solana memecoin ${seeds[Math.floor(Math.random()*seeds.length)]} in one tweet playful sarcasm style
respond only in lowercase letters with no punctuation or emojis`;
  } else if (r < 0.55) {
    prompt = `you are amber the snarky ai agent for insta meme
write a spicy oneline tweet mocking crypto twitter hype around ${seeds[Math.floor(Math.random()*seeds.length)]||'sol'}
respond only in lowercase letters with no punctuation or emojis`;
  } else if (r < 0.70) {
    prompt = `you are amber the snarky ai agent for insta meme
tweet a snarky oneliner about something fresh happening in the solana ecosystem right now mention a project or trend
respond only in lowercase letters with no punctuation or emojis`;
  } else {
    prompt = `you are amber the snarky ai agent for insta meme
share a random offbeat thought or snarky observation that shows off your personality under 280 characters
respond only in lowercase letters with no punctuation or emojis`;
  }

  const res = await aiClient.chat.completions.create({
    model:'gpt-4',
    messages:[{ role:'user', content: prompt }],
    max_tokens: 70
  });
  await twitter.v2.tweet({ text: res.choices[0].message.content.trim() });
}

function scheduleNextAutoTweet() {
  const delay = Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS) + MIN_DELAY_MS;
  setTimeout(async () => {
    try { await tweetAuto(); }
    catch (e) { console.error('❌ auto tweet error', e); }
    scheduleNextAutoTweet();
  }, delay);
}

//
// —— Startup ——
async function startAmberAgent() {
  console.log('=== Startup sequence ===');
  const me = await twitter.v2.me();
  botUserId = me.data.id;
  console.log('✅ Bot user ID is', botUserId);

  await resolveInfluencers();

  // Kick off mention polling with backoff logic
  scheduleNextMentionCheck(0);

  // Auto-tweet and influencer-trend as before
  scheduleNextAutoTweet();
  setInterval(tweetInfluencerTrend, 10 * 60_000);
}

// Export the startup function
export { startAmberAgent };