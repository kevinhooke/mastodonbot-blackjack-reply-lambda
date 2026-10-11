const { checkResponse } = require('../mastodon-response.js');

test('returns data for a successful response', () => {
    let data = [{ id: '1' }];
    expect(checkResponse({ data: data, resp: { statusCode: 200 } }, 'test')).toBe(data);
});

test('throws for a Mastodon API error', () => {
    expect(() => checkResponse({ data: { error: 'The access token is invalid' }, resp: { statusCode: 401 } }, 'Query mentions'))
        .toThrow('Query mentions failed, status [401]');
});

test('throws for an error body with a 200 status', () => {
    expect(() => checkResponse({ data: { error: 'Record not found' }, resp: { statusCode: 200 } }, 'test')).toThrow();
});

test('throws when there is no response, e.g. a connection error', () => {
    expect(() => checkResponse({ data: '', resp: undefined }, 'test')).toThrow('status [undefined]');
});
