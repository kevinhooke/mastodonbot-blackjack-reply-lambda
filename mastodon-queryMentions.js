let config = require('./config/config-mastodon.json');
let Mastodon = require('mastodon-api');
let mastodonResponse = require('./mastodon-response.js');


exports.queryMentions = async (lastStatusId) => {

    const M = new Mastodon({
        access_token: config['access-token'],
        api_url: config['mastodon-server'] + '/api/v1/',
      });
      let queryString = 'notifications?limit=10&types[]=mention';
      //min_id returns the oldest notifications after lastStatusId, so if there are more
      //than the limit, the rest are picked up next run. since_id would return the newest,
      //and any older ones beyond the limit would never be seen.
      queryString = queryString + ( lastStatusId && lastStatusId !== '0' ? `&min_id=${lastStatusId}` : '');

      let resp = await M.get(queryString);
      return mastodonResponse.checkResponse(resp, 'Query mentions');
}
