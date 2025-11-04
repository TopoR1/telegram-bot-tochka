import { fetch } from '../utils/http-client.js';

export async function downloadFileBuffer(url) {
    const response = await fetch(url);
    if (!response.ok) {
        const error = new Error('Не удалось загрузить файл из Telegram.');
        error.status = response.status;
        error.statusText = response.statusText;
        throw error;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}
