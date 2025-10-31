import { CourierCard } from '../../services/types.js';
import { formatCard } from '../../utils/format.js';

export interface TaskCardMessage {
  text: string;
  options: {
    parse_mode: 'HTML';
    disable_web_page_preview: boolean;
  };
}

export function buildTaskCard(card: CourierCard): TaskCardMessage {
  const text = formatCard(card);
  return {
    text,
    options: {
      parse_mode: 'HTML',
      disable_web_page_preview: !card.profileLink
    }
  };
}
