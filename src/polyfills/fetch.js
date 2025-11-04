import fetch, { Headers, Request, Response } from 'node-fetch';
import {
    ReadableStream,
    WritableStream,
    TransformStream
} from 'web-streams-polyfill/ponyfill/es2018';

const bindings = {
    fetch,
    Headers,
    Request,
    Response,
    ReadableStream,
    WritableStream,
    TransformStream
};

for (const [name, value] of Object.entries(bindings)) {
    if (value && !globalThis[name]) {
        globalThis[name] = value;
    }
}

export { fetch };
