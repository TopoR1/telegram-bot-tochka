const CONNECTORS = [' ', '-', '\t'];
export function normalizeFullName(raw) {
    const trimmed = raw.trim().replace(/\s+/g, ' ');
    const parts = trimmed
        .split(new RegExp(`[${CONNECTORS.join('')}]`, 'g'))
        .filter(Boolean)
        .map((part) => part.toLowerCase())
        .map((part) => part.replace(/^\p{L}/u, (letter) => letter.toUpperCase()))
        .map((part) => part.replace(/-(\p{L})/gu, (_, letter) => `-${letter.toUpperCase()}`));
    return parts.join(' ');
}
