/* ─────────────────────────────────────────────
   The "brain": local, private long-term memory.
   - Learns durable facts about the user after each exchange
   - Injects what it knows into future chats
   - "Dreams": consolidates & prunes memories when idle
   All of it runs through the same local model. Nothing leaves the device.
───────────────────────────────────────────── */
const fs = require("fs");
const path = require("path");

const OLLAMA = "http://127.0.0.1:11434";
const MAX_FACTS = 80; // hard cap so the prompt never bloats

/* ── Forgetting curve (à la Supermemory) ──
   Memories decay over time, strengthen when used, and are forgotten when faded. */
const DAY = 24 * 60 * 60 * 1000;
const HALF_LIFE = 30 * DAY;   // unused memory loses half its strength in ~30 days
const FORGET_BELOW = 0.3;     // effective strength under this → forgotten
const GRACE = 5 * DAY;        // brand-new memories can't be forgotten for 5 days
const INJECT_TOP = 14;        // how many memories we surface into a chat
const REINFORCE = 0.5;        // strength gained each time a memory is actually used
const STOPWORDS = new Set(
  ("the a an and or but is are was were be been being to of in on for with at by " +
   "from as it its this that these those i you he she they we me my your their our " +
   "have has had do does did will would can could should about into out up down").split(" ")
);

// Effective strength right now, after time-decay since it was last used.
function effective(f, now = Date.now()) {
  const age = now - (f.lastSeen || f.createdAt || now);
  return (f.strength || 1) * Math.pow(0.5, age / HALF_LIFE);
}

// How relevant a memory is to the current conversation (shared meaningful words).
function relevance(f, ctxWords) {
  if (!ctxWords || ctxWords.size === 0) return 0;
  let shared = 0;
  for (const w of words(f.text)) if (!STOPWORDS.has(w) && ctxWords.has(w)) shared++;
  return shared;
}

let FILE = null;
let store = { facts: [], lastDreamAt: 0, extractsSinceDream: 0 };

function init(userDataDir) {
  FILE = path.join(userDataDir, "memory.json");
  try {
    if (fs.existsSync(FILE)) store = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    /* start fresh on corruption */
  }
  if (!Array.isArray(store.facts)) store.facts = [];
  // Migrate older entries to the strength/decay model.
  const now = Date.now();
  for (const f of store.facts) {
    if (f.strength == null) f.strength = f.weight || 1;
    if (!f.createdAt) f.createdAt = now;
    if (!f.lastSeen) f.lastSeen = f.createdAt;
  }
  forgetWeak(); // prune anything that faded while the app was closed
}

function persist() {
  try {
    fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
  } catch {}
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/* ── A small non-streaming call to the local model ── */
async function ask(model, system, user, { temperature = 0.1 } = {}) {
  try {
    const res = await fetch(`${OLLAMA}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        stream: false,
        think: false,
        options: { temperature, num_ctx: 8192 },
      }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return (data.message?.content || "").trim();
  } catch {
    return "";
  }
}

/* ── Parsing helpers ── */
function parseBullets(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[-*•]/.test(l))
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter((l) => l && l.toUpperCase() !== "NONE" && l.length < 240);
}

function words(s) {
  return new Set(
    s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean)
  );
}

// Rough similarity so we don't store the same fact twice.
function similar(a, b) {
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return false;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  const jacc = inter / (wa.size + wb.size - inter);
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  return jacc > 0.55 || al.includes(bl) || bl.includes(al);
}

/* ── Public reads ── */
// Sorted strongest-first, annotated with how "alive" each memory is.
function getFacts() {
  const now = Date.now();
  return store.facts
    .map((f) => {
      const eff = effective(f, now);
      return { ...f, effective: eff, fading: eff < 0.55 };
    })
    .sort((x, y) => y.effective - x.effective);
}

function count() {
  return store.facts.length;
}

// The block we silently prepend to the system prompt of a chat.
// Picks the memories most relevant to what's being discussed, and REINFORCES
// them (using a memory keeps it alive — the heart of the forgetting curve).
function buildMemoryBlock(contextText = "") {
  if (store.facts.length === 0) return "";
  const now = Date.now();
  const ctxWords = words(contextText || "");

  const scored = store.facts.map((f) => ({
    f,
    score: effective(f, now) + relevance(f, ctxWords) * 1.5,
  }));
  scored.sort((a, b) => b.score - a.score);
  const chosen = scored.slice(0, INJECT_TOP).map((s) => s.f);

  // Reinforce what we actually surfaced: refresh recency + nudge strength.
  for (const f of chosen) {
    f.lastSeen = now;
    f.strength = Math.min((f.strength || 1) + REINFORCE, 25);
  }
  if (chosen.length) persist();

  const lines = chosen.map((f) => `- ${f.text}`).join("\n");
  return (
    `\n\nWhat you remember about this user (from past conversations — ` +
    `use it naturally, don't recite it back unless asked):\n${lines}`
  );
}

/* ── Forgetting: drop memories that have faded and weren't reinforced ── */
function forgetWeak() {
  const now = Date.now();
  const before = store.facts.length;
  const forgotten = [];
  store.facts = store.facts.filter((f) => {
    const young = now - (f.createdAt || now) < GRACE;
    if (young) return true;
    if (effective(f, now) >= FORGET_BELOW) return true;
    forgotten.push(f.text);
    return false;
  });
  if (store.facts.length !== before) persist();
  return forgotten;
}

/* ── Writes ── */
function addFacts(texts) {
  const added = [];
  for (const text of texts) {
    const hit = store.facts.find((f) => similar(f.text, text));
    if (hit) {
      hit.strength = (hit.strength || 1) + 1; // saying it again strengthens it
      hit.lastSeen = Date.now();
      // Prefer the longer, more detailed phrasing.
      if (text.length > hit.text.length + 8) hit.text = text;
    } else {
      const fact = { id: genId(), text, strength: 1, createdAt: Date.now(), lastSeen: Date.now() };
      store.facts.push(fact);
      added.push(fact);
    }
  }
  // Trim if over cap (drop the weakest by effective strength).
  if (store.facts.length > MAX_FACTS) {
    const now = Date.now();
    store.facts.sort((x, y) => effective(y, now) - effective(x, now));
    store.facts = store.facts.slice(0, MAX_FACTS);
  }
  if (added.length || texts.length) persist();
  return added;
}

function deleteFact(id) {
  store.facts = store.facts.filter((f) => f.id !== id);
  persist();
}

function clearAll() {
  store.facts = [];
  persist();
}

/* ── Learning: pull durable facts out of one exchange ── */
const EXTRACT_SYSTEM =
  "You are the memory of a personal AI assistant. Read one exchange between a USER and the assistant. " +
  "Extract only NEW, durable facts worth remembering about the USER long-term: their name, where they live, " +
  "their job/projects, preferences, goals, relationships, pets, important dates, or how they like to be helped. " +
  "Write each as a short third-person statement (e.g. 'Is a solo founder building an app called Fern'). " +
  "Ignore small talk, one-off questions, and anything trivial. " +
  "Output each fact on its own line starting with '- '. If there is nothing worth saving, output exactly: NONE";

async function learnFromExchange(model, userText, assistantText) {
  if (!userText || userText.length < 4) return [];
  const convo = `USER: ${userText}\n\nASSISTANT: ${assistantText}`.slice(0, 6000);
  const out = await ask(model, EXTRACT_SYSTEM, convo, { temperature: 0 });
  if (!out || /^none$/i.test(out.trim())) {
    store.extractsSinceDream++;
    return [];
  }
  const facts = parseBullets(out);
  const added = addFacts(facts);
  store.extractsSinceDream++;
  persist();
  return added;
}

/* ── Dreaming: consolidate & prune the whole memory ── */
const DREAM_SYSTEM =
  "You are the memory consolidation system of a personal AI ('dreaming'). " +
  "You are given a list of remembered facts about a user. Some may be duplicates, outdated, contradictory, or trivial. " +
  "Rewrite the list into a clean, deduplicated set of the most important, current facts. " +
  "Merge related facts. Drop redundancy and trivia. Keep the user's voice and specifics. " +
  "Output one fact per line starting with '- ', at most 40 lines. If a later fact contradicts an earlier one, keep the later.";

async function dream(model) {
  if (store.facts.length < 6) return { changed: false, before: store.facts.length, after: store.facts.length };
  const before = store.facts.length;
  const list = getFacts().map((f) => `- ${f.text}`).join("\n");
  const out = await ask(model, DREAM_SYSTEM, list, { temperature: 0.2 });
  const cleaned = parseBullets(out);
  if (cleaned.length === 0) return { changed: false, before, after: before };
  // Rebuild, preserving weight when a cleaned fact matches an old one.
  const old = store.facts;
  const now = Date.now();
  store.facts = cleaned.slice(0, 40).map((text) => {
    const match = old.find((f) => similar(f.text, text));
    return {
      id: match?.id || genId(),
      text,
      strength: (match?.strength || 1) + 1,
      createdAt: match?.createdAt || now,
      lastSeen: match?.lastSeen || now,
    };
  });
  const forgotten = forgetWeak(); // let faded memories go during the dream
  store.lastDreamAt = now;
  store.extractsSinceDream = 0;
  persist();
  return {
    changed: before !== store.facts.length,
    before,
    after: store.facts.length,
    forgotten,
  };
}

// Should we dream now? After enough new learning, and not too often.
function shouldDream() {
  return store.extractsSinceDream >= 8 && store.facts.length >= 8;
}

/* ── Auto-compaction: keep long chats from forgetting or hitting the wall ──
   Summarizes the older middle of a conversation, keeps recent turns verbatim. */
const COMPACT_CHAR_LIMIT = 14000; // ~3.5k tokens before we compact
const KEEP_RECENT = 6;
const COMPACT_SYSTEM =
  "Summarize the earlier part of this conversation into a tight recap that preserves " +
  "names, decisions, facts, numbers and anything the assistant must remember to stay consistent. " +
  "Write 4-8 short bullet points. No preamble.";

async function compact(model, messages) {
  const total = messages.reduce((n, m) => n + (m.content?.length || 0), 0);
  if (total < COMPACT_CHAR_LIMIT || messages.length <= KEEP_RECENT + 3) {
    return { messages, compacted: false };
  }
  const sys = messages[0]?.role === "system" ? messages[0] : null;
  const body = sys ? messages.slice(1) : messages;
  const middle = body.slice(0, body.length - KEEP_RECENT);
  const recent = body.slice(body.length - KEEP_RECENT);
  if (middle.length === 0) return { messages, compacted: false };

  const transcript = middle
    .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content || ""}`)
    .join("\n")
    .slice(0, 12000);
  const summary = await ask(model, COMPACT_SYSTEM, transcript, { temperature: 0.2 });
  if (!summary) return { messages, compacted: false };

  const recap = { role: "system", content: `Recap of earlier conversation:\n${summary}` };
  const out = sys ? [sys, recap, ...recent] : [recap, ...recent];
  return { messages: out, compacted: true };
}

module.exports = {
  init,
  getFacts,
  count,
  buildMemoryBlock,
  learnFromExchange,
  deleteFact,
  clearAll,
  dream,
  shouldDream,
  compact,
};
