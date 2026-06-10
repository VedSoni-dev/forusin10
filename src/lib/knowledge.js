// Local "knowledge" retrieval for project-linked files.
// No embeddings, no servers — just keyword relevance, so it stays fast & private.

const STOP = new Set(
  ("the a an and or but is are was were be been being to of in on for with at by from as it " +
   "its this that these those i you he she they we me my your their our have has had do does did " +
   "will would can could should about into out up down what which who when where why how").split(" ")
);

function words(s = "") {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

function score(text, qWords) {
  if (!qWords.size) return 0;
  let s = 0;
  for (const w of words(text)) if (!STOP.has(w) && qWords.has(w)) s++;
  return s;
}

// Returns a "reference material" string to inject, or "" if nothing useful.
export function selectKnowledge(files, query, budget = 3800) {
  if (!files || files.length === 0) return "";
  const withText = files.filter((f) => (f.content || "").trim().length > 0);
  if (withText.length === 0) return "";

  const total = withText.reduce((n, f) => n + f.content.length, 0);

  // Small enough to just include everything verbatim.
  if (total <= budget) {
    return withText
      .map((f) => `From "${f.name}":\n${f.content.trim()}`)
      .join("\n\n");
  }

  // Otherwise chunk and rank by relevance to the question.
  const qWords = new Set(words(query).filter((w) => !STOP.has(w)));
  const chunks = [];
  for (const f of withText) {
    const t = f.content;
    for (let i = 0; i < t.length; i += 850) {
      const piece = t.slice(i, i + 1100);
      chunks.push({ file: f.name, text: piece, s: score(piece, qWords) });
    }
  }
  chunks.sort((a, b) => b.s - a.s);

  const picked = [];
  let used = 0;
  for (const c of chunks) {
    if (c.s <= 0) break;
    if (used + c.text.length > budget) continue;
    picked.push(`From "${c.file}":\n${c.text.trim()}`);
    used += c.text.length;
    if (used >= budget) break;
  }

  // Nothing matched the question — fall back to the start of each file.
  if (picked.length === 0) {
    let u = 0;
    for (const f of withText) {
      const head = f.content.slice(0, 900);
      if (u + head.length > budget) break;
      picked.push(`From "${f.name}":\n${head.trim()}`);
      u += head.length;
    }
  }
  return picked.join("\n\n");
}
