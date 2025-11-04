import fetch, { Headers, Request, Response } from 'node-fetch';
import { ReadableStream, WritableStream, TransformStream } from 'node:stream/web';

if (!globalThis.fetch) {
    globalThis.fetch = fetch;
}

if (!globalThis.Headers) {
    globalThis.Headers = Headers;
}

if (!globalThis.Request) {
    globalThis.Request = Request;
}

if (!globalThis.Response) {
    globalThis.Response = Response;
}

if (!globalThis.ReadableStream) {
    globalThis.ReadableStream = ReadableStream;
}

if (!globalThis.WritableStream) {
    globalThis.WritableStream = WritableStream;
}

if (!globalThis.TransformStream) {
    globalThis.TransformStream = TransformStream;
}

export { fetch };
