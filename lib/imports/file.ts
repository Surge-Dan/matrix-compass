import { inflateRawSync } from "node:zlib";
import { parseCsvRows } from "./parser";

function u16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes: Uint8Array, offset: number) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function text(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes);
}

function zipEntries(bytes: Uint8Array) {
  let eocd = -1;
  for (let index = bytes.length - 22; index >= 0; index -= 1) {
    if (u32(bytes, index) === 0x06054b50) { eocd = index; break; }
  }
  if (eocd < 0) throw new Error("Invalid XLSX archive");
  const count = u16(bytes, eocd + 10);
  const directoryOffset = u32(bytes, eocd + 16);
  const entries = new Map<string, Uint8Array>();
  let cursor = directoryOffset;
  for (let index = 0; index < count; index += 1) {
    if (u32(bytes, cursor) !== 0x02014b50) throw new Error("Invalid XLSX directory");
    const method = u16(bytes, cursor + 10);
    const compressedSize = u32(bytes, cursor + 20);
    const nameLength = u16(bytes, cursor + 28);
    const extraLength = u16(bytes, cursor + 30);
    const commentLength = u16(bytes, cursor + 32);
    const localOffset = u32(bytes, cursor + 42);
    const name = text(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    const localNameLength = u16(bytes, localOffset + 26);
    const localExtraLength = u16(bytes, localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(start, start + compressedSize);
    const value = method === 0 ? compressed : method === 8 ? new Uint8Array(inflateRawSync(compressed)) : (() => { throw new Error(`Unsupported XLSX compression: ${method}`); })();
    entries.set(name, value);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function xmlValue(fragment: string, tag: string) {
  const match = fragment.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? match[1].replaceAll(/<[^>]+>/g, "").replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#39;", "'") : "";
}

function columnIndex(reference: string) {
  const letters = reference.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? "A";
  return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function parseXlsx(bytes: Uint8Array) {
  const entries = zipEntries(bytes);
  const shared = [...(entries.get("xl/sharedStrings.xml") ? text(entries.get("xl/sharedStrings.xml")!) : "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => xmlValue(match[1], "t"));
  const sheetName = [...entries.keys()].find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  if (!sheetName) throw new Error("XLSX file has no worksheet");
  const rows: Record<string, string>[] = [];
  for (const rowMatch of text(entries.get(sheetName)!).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attributes = cellMatch[1];
      const reference = attributes.match(/\br="([A-Z]+\d+)"/i)?.[1] ?? `A${cells.length + 1}`;
      const type = attributes.match(/\bt="([^"]+)"/)?.[1];
      const fragment = cellMatch[2];
      const raw = type === "inlineStr" ? xmlValue(fragment, "t") : xmlValue(fragment, "v");
      cells[columnIndex(reference)] = type === "s" ? shared[Number(raw)] ?? "" : raw;
    }
    rows.push(Object.fromEntries(cells.map((value, index) => [String(index), value ?? ""])));
  }
  const headers = rows.shift() ?? {};
  return rows.map((row) => Object.fromEntries(Object.keys(headers).map((index) => [headers[index], row[index] ?? ""])));
}

export async function readImportFile(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type.includes("csv")) return parseCsvRows(await file.text());
  if (name.endsWith(".xlsx") || file.type.includes("spreadsheet")) return parseXlsx(new Uint8Array(await file.arrayBuffer()));
  if (name.endsWith(".xls")) throw new Error("Legacy XLS is not supported directly; export it as XLSX or CSV first.");
  throw new Error("Only UTF-8 CSV or XLSX files are supported.");
}
