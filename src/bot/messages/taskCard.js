import { formatCard } from '../../utils/format.js';
export function buildTaskCard(card) {
    const text = formatCard(card);
    return {
        text,
        options: {
            parse_mode: 'HTML',
            disable_web_page_preview: !card.profileLink
        }
    };
}
