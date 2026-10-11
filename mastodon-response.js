// mastodon-api resolves its promise even when the request fails, with the error
// only in the response body or status code, so callers must check for it
exports.checkResponse = (resp, description) => {
    let statusCode = resp.resp ? resp.resp.statusCode : undefined;
    let data = resp.data;
    if (statusCode === undefined || statusCode < 200 || statusCode >= 300
        || (data && typeof data === 'object' && (data.error || data.errors))) {
        throw new Error(`${description} failed, status [${statusCode}]: ${JSON.stringify(data)}`);
    }
    return data;
}
