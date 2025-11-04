const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;
const SAFE_MESSAGE_LENGTH = TELEGRAM_MAX_MESSAGE_LENGTH - 256;

function splitMessage(text, limit = SAFE_MESSAGE_LENGTH) {
    const chunks = [];
    let remaining = text;
    while (remaining.length > limit) {
        let splitIndex = remaining.lastIndexOf('\n', limit);
        if (splitIndex <= Math.floor(limit * 0.5)) {
            splitIndex = limit;
        }
        const chunk = remaining.slice(0, splitIndex).trimEnd();
        if (chunk) {
            chunks.push(chunk);
        }
        remaining = remaining.slice(splitIndex);
        if (remaining.startsWith('\n')) {
            remaining = remaining.slice(1);
        }
    }
    if (remaining.trim().length || !chunks.length) {
        chunks.push(remaining.trimEnd());
    }
    return chunks;
}

export async function replyWithLimitedText(ctx, text, options) {
    const payload = typeof text === 'string' ? text : String(text ?? '');
    const chunks = splitMessage(payload);
    for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        const replyOptions = index === 0 ? options : undefined;
        await ctx.reply(chunk, replyOptions);
    }
}

export { splitMessage, SAFE_MESSAGE_LENGTH, TELEGRAM_MAX_MESSAGE_LENGTH };
