import { Markup } from 'telegraf';
import { PHONE_BUTTON_LABEL } from '../../utils/phone.js';

export const LAST_TASK_BUTTON_LABEL = 'Получить последнее задание';

export function createCourierStartKeyboard(): ReturnType<typeof Markup.keyboard> {
  return Markup.keyboard([
    [Markup.button.contactRequest(PHONE_BUTTON_LABEL)],
    [LAST_TASK_BUTTON_LABEL]
  ])
    .oneTime()
    .resize();
}
