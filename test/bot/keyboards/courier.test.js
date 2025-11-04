import { describe, it, expect } from 'vitest';
import {
  createCourierStartKeyboard,
  LAST_TASK_BUTTON_LABEL,
  REGISTRATION_HINT_LABEL,
  FULL_NAME_HINT_LABEL,
  ADMIN_MODE_HINT_LABEL
} from '../../../src/bot/keyboards/courier.js';
import { PHONE_BUTTON_LABEL } from '../../../src/utils/phone.js';

describe('createCourierStartKeyboard', () => {
  it('shows contact request and hint for unregistered courier', () => {
    const keyboard = createCourierStartKeyboard();
    expect(keyboard.reply_markup?.one_time_keyboard).toBe(true);
    expect(keyboard.reply_markup?.keyboard?.[0]?.[0]).toMatchObject({
      text: PHONE_BUTTON_LABEL,
      request_contact: true
    });
    expect(keyboard.reply_markup?.keyboard?.[1]?.[0]).toBe(REGISTRATION_HINT_LABEL);
  });

  it('includes full name hint when awaiting completion', () => {
    const keyboard = createCourierStartKeyboard({ awaitingFullName: true });
    expect(keyboard.reply_markup?.keyboard?.map((row) => row[0])).toEqual([
      expect.objectContaining({ text: PHONE_BUTTON_LABEL }),
      REGISTRATION_HINT_LABEL,
      FULL_NAME_HINT_LABEL
    ]);
  });

  it('shows persistent last-task button for registered couriers', () => {
    const keyboard = createCourierStartKeyboard({ isRegistered: true });
    expect(keyboard.reply_markup?.is_persistent).toBe(true);
    expect(keyboard.reply_markup?.keyboard).toEqual([[LAST_TASK_BUTTON_LABEL]]);
  });

  it('hides last-task button for admins even if registered', () => {
    const keyboard = createCourierStartKeyboard({ isRegistered: true, isAdmin: true });
    expect(keyboard.reply_markup?.keyboard?.[0]?.[0]).toBe(ADMIN_MODE_HINT_LABEL);
    expect(keyboard.reply_markup?.keyboard?.flat()).not.toContain(LAST_TASK_BUTTON_LABEL);
  });

  it('adds admin hint to contact keyboard for admin without registration', () => {
    const keyboard = createCourierStartKeyboard({ isAdmin: true });
    expect(keyboard.reply_markup?.keyboard?.map((row) => row[0])).toEqual([
      expect.objectContaining({ text: PHONE_BUTTON_LABEL }),
      REGISTRATION_HINT_LABEL,
      ADMIN_MODE_HINT_LABEL
    ]);
  });
});
