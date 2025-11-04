import fetch, { Headers, Request, Response } from 'node-fetch';
import {
    ReadableStream,
    WritableStream,
    TransformStream
} from 'web-streams-polyfill/dist/ponyfill.es2018.js';

const ponyfills = {
    fetch,
    Headers,
    Request,
    Response,
    ReadableStream,
    WritableStream,
    TransformStream
};

for (const [name, value] of Object.entries(ponyfills)) {
    if (value && !globalThis[name]) {
        globalThis[name] = value;
    }
}

export { fetch, ReadableStream };
