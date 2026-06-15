import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Friendly, human-sized file labels.
export function prettyBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const TEXT_EXT = [
  "txt", "md", "markdown", "csv", "json", "js", "jsx", "ts", "tsx",
  "py", "java", "c", "cpp", "cs", "go", "rs", "rb", "php", "swift",
  "html", "css", "scss", "xml", "yaml", "yml", "sql", "sh", "log",
];

export function fileKind(name = "") {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext)) return "image";
  if (["pdf", "docx"].includes(ext)) return "doc"; // binary docs we extract text from
  if (TEXT_EXT.includes(ext)) return "text";
  return "other";
}
