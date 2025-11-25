export const UNKNOWN_INPUT_MESSAGE = 'Я не знаю, что на это ответить.';

export class UnknownInputError extends Error {
    /**
     * @param {string} message
     * @param {object | undefined} replyOptions
     */
    constructor(message, replyOptions) {
        super(message);
        this.name = 'UnknownInputError';
        this.replyOptions = replyOptions;
    }
}

