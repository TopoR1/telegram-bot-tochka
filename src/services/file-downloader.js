import { fetch } from '../utils/http-client.js';

export async function downloadFileBuffer(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const error = new Error('Не удалось загрузить файл из Telegram.');
            error.status = response.status;
            error.statusText = response.statusText;
            error.url = url;
            throw error;
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }
    catch (error) {
        if (error && typeof error === 'object' && 'status' in error) {
            throw error;
        }
        const networkError = new Error('Ошибка сети при загрузке файла из Telegram.');
        networkError.cause = error;
        networkError.url = url;
        throw networkError;
    }
}
