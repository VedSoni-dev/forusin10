// Pull readable text out of binary documents (.pdf, .docx) entirely in the
// renderer - no network, nothing leaves the device. The extracted text is
// inlined into the prompt exactly like a plain-text attachment.
import { unzipSync, strFromU8 } from "fflate";
import * as pdfjsLib from "pdfjs-dist";
// Vite resolves this to a hashed asset URL that also works under file:// in the
// packaged app (vite base is "./").
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/** Extract text from a .docx (Office Open XML - a zip of XML parts). */
export async function extractDocx(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const zip = unzipSync(buf);
  const part = zip["word/document.xml"];
  if (!part) throw new Error("Not a readable .docx (no word/document.xml)");
  return xmlToText(strFromU8(part));
}

/** Turn WordprocessingML into plain text: paragraphs/breaks -> newlines, tags -> gone. */
function xmlToText(xml) {
  return xml
    .replace(/<\/w:p>/g, "\n") // end of paragraph
    .replace(/<w:br\s*\/?>/g, "\n") // line break
    .replace(/<w:tab\s*\/?>/g, "\t") // tab
    .replace(/<[^>]+>/g, "") // strip every remaining tag
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Extract text from a PDF, page by page. */
export async function extractPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((it) => it.str).join(" "));
  }
  return pages.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Dispatch by extension. Returns extracted text or throws. */
export async function extractDocText(file) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return extractPdf(file);
  if (ext === "docx") return extractDocx(file);
  throw new Error(`Unsupported document type: .${ext}`);
}
