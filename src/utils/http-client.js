import { fetch as polyfilledFetch } from '../polyfills/fetch.js';

export const fetch = (...args) => polyfilledFetch(...args);
