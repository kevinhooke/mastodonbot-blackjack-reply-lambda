let Mastodon = require('mastodon-api');
let config = require('./config/config-mastodon.json');
let mastodonResponse = require('./mastodon-response.js');

exports.postMastodon = async (replyToStatusId, status) => {

    const M = new Mastodon({
        access_token: config['access-token'],
        api_url: config['mastodon-server'] + '/api/v1/',
    });

    let resp = await M.post('statuses', {
        "status" : status.text,
        "in_reply_to_id" : replyToStatusId
        });
    return mastodonResponse.checkResponse(resp, 'Post reply');
}
