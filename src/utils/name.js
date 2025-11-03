const CONNECTORS = [' ', '-', '\t'];
const CONNECTOR_PATTERN = new RegExp(`[${CONNECTORS.map((connector) => connector.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&')).join('')}]`, 'g');
export function normalizeFullName(raw) {
    const trimmed = raw.trim().replace(/\s+/g, ' ');
    const parts = trimmed
        .split(CONNECTOR_PATTERN)
        .filter(Boolean)
        .map((part) => part.toLowerCase())
        .map((part) => part.replace(/^\p{L}/u, (letter) => letter.toUpperCase()))
        .map((part) => part.replace(/-(\p{L})/gu, (_, letter) => `-${letter.toUpperCase()}`));
    return parts.join(' ');
}
