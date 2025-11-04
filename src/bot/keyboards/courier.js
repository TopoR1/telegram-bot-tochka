import { Markup } from 'telegraf';
import { PHONE_BUTTON_LABEL } from '../../utils/phone.js';
export const LAST_TASK_BUTTON_LABEL = 'Получить последнее задание';
export const REGISTRATION_HINT_LABEL = 'ℹ️ Чтобы получить задания, отправьте номер телефона';
export const FULL_NAME_HINT_LABEL = '✍️ Напишите ФИО, чтобы завершить регистрацию';
export const ADMIN_MODE_HINT_LABEL = 'ℹ️ Курьерский режим недоступен администраторам';
/**
 * @param {Object} [options]
 * @param {boolean} [options.isRegistered]
 * @param {boolean} [options.isAdmin]
 * @param {boolean} [options.awaitingFullName]
 */
export function createCourierStartKeyboard(options = {}) {
    const { isRegistered = false, isAdmin = false, awaitingFullName = false } = options;
    if (isAdmin) {
        return Markup.keyboard([[ADMIN_MODE_HINT_LABEL]])
            .oneTime()
            .resize();
    }
    if (isRegistered) {
        return Markup.keyboard([[LAST_TASK_BUTTON_LABEL]])
            .persistent()
            .resize();
    }
    const rows = [
        [Markup.button.contactRequest(PHONE_BUTTON_LABEL)],
        [REGISTRATION_HINT_LABEL]
    ];
    if (awaitingFullName) {
        rows.push([FULL_NAME_HINT_LABEL]);
    }
    return Markup.keyboard(rows)
        .oneTime()
        .resize();
}
