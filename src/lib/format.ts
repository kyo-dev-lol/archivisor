// Shared formatting + file-type helpers used across the UI.

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  const decimals = exponent === 0 ? 0 : value < 10 ? 2 : value < 100 ? 1 : 0;
  return `${value.toFixed(decimals)} ${units[exponent]}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export type FileCategory =
  | 'folder'
  | 'image'
  | 'text'
  | 'pdf'
  | 'code'
  | 'archive'
  | 'audio'
  | 'video'
  | 'dangerous'
  | 'generic';

const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'scr', 'msi', 'dll', 'sh', 'ps1', 'vbs', 'jar',
  'com', 'gadget', 'msc', 'jse', 'ws', 'wsf', 'wsc', 'wsh', 'app', 'bin',
]);

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif']);
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'log', 'csv', 'tsv', 'json', 'yml', 'yaml', 'ini', 'cfg', 'conf', 'xml', 'toml']);
const CODE_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'c', 'h', 'cpp', 'hpp', 'cc',
  'java', 'kt', 'swift', 'php', 'css', 'scss', 'less', 'html', 'htm', 'sql', 'sh',
  'vue', 'svelte', 'lua', 'r', 'pl', 'graphql',
]);
const ARCHIVE_EXTENSIONS = new Set(['zip', '7z', 'tar', 'gz', 'tgz', 'bz2', 'tbz2', 'xz', 'txz', 'rar', 'zst']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'mkv', 'avi']);

export function getExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx === -1 || idx === name.length - 1) return '';
  return name.slice(idx + 1).toLowerCase();
}

export function isDangerousExtension(name: string): boolean {
  return DANGEROUS_EXTENSIONS.has(getExtension(name));
}

export function categorize(name: string, isDirectory: boolean): FileCategory {
  if (isDirectory) return 'folder';
  const ext = getExtension(name);
  if (DANGEROUS_EXTENSIONS.has(ext)) return 'dangerous';
  if (ARCHIVE_EXTENSIONS.has(ext)) return 'archive';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (CODE_EXTENSIONS.has(ext)) return 'code';
  if (TEXT_EXTENSIONS.has(ext)) return 'text';
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  return 'generic';
}

export function isPreviewableImage(name: string): boolean {
  return IMAGE_EXTENSIONS.has(getExtension(name));
}

export function isPreviewableText(name: string): boolean {
  const ext = getExtension(name);
  return TEXT_EXTENSIONS.has(ext) || CODE_EXTENSIONS.has(ext);
}

export function isJson(name: string): boolean {
  return getExtension(name) === 'json';
}

export function isCsv(name: string): boolean {
  return getExtension(name) === 'csv' || getExtension(name) === 'tsv';
}

export function isPdf(name: string): boolean {
  return getExtension(name) === 'pdf';
}

/** Join archive-relative path segments with forward slashes, no leading slash. */
export function joinPath(...segments: string[]): string {
  return segments
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/^\//, '');
}
