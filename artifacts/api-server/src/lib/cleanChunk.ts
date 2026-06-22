export function cleanChunk(text: string): string {
  return text
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*{2,3}([^*]*)\*{2,3}/g, "$1")
    .replace(/\*(?=[^\s*])([^*]*)\*/g, "$1")
    .replace(/_{2}([^_]*)_{2}/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/^(\s*)--+\s*/gm, "$1")
    .replace(/^(\s*)-\s+/gm, "$1")
    .replace(/^(\s*)\*\s+/gm, "$1")
    .replace(/(^|[ \t])\d+\.\s+/gm, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/~~([^~]*)~~/g, "$1")
    .replace(/[–—]/g, " ")
    .replace(/\*/g, "");
}
