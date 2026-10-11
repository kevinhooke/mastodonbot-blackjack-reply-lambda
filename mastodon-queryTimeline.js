let config = require('./config/config-mastodon.json');
let axios = require('axios');
const { ungzip } = require('node-gzip');
let Mastodon = require('mastodon-api');

exports.queryTimeline = async () => {

    const M = new Mastodon({
      access_token: config['access-token'],
      api_url: config['mastodon-server'] + '/api/v1/',
    });

    let promise = new Promise( (resolve, reject) => M.get('timelines/home?limit=10')
      .then((resp) => {
          resolve(resp.data);
      })
  );
  return promise;
}