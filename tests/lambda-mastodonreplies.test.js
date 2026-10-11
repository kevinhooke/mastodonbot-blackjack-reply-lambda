/**
 * Run with jest, not 'npm run test' which is configured
 * to test ES modules imported for contentparser.
 * 
 */
//mock dynamodb lookup for last processed reply id
const lastStatusQuery = require('../db_status.js');
lastStatusQuery.getLastDbStatus = jest.fn();

//mock mastodon api query for mentions
const mastodonReplies = require('../mastodon-queryMentions.js');
mastodonReplies.queryMentions = jest.fn();

//mock mastodon api send and dynamodb update, so no replies are sent
const mastodonSend = require('../mastodon-send.js');
mastodonSend.postMastodon = jest.fn();
lastStatusQuery.updateDbStatus = jest.fn();

//mock call to the game lambda
const blackjackGameplay = require('../blackjack-gameplay.js');
blackjackGameplay.playTurn = jest.fn();

test('tests processing 1 mention since last processed', async () => {
    lastStatusQuery.getLastDbStatus.mockResolvedValue(
        {"Items":[{"statusKey":"lastStatusId","lastReplyId":"1"}],"Count":1,"ScannedCount":1}
    );

    mastodonReplies.queryMentions.mockResolvedValue([
        {
            'id': '2',
            'type': 'mention',
            'created_at': '2022-11-27T03:24:08.275Z',
            'account': {
                id: 111111,
                'acct': 'mockuser'
            },
            'status': {
            'id': '112233',
            'content': 'test status1'
            }
        }
    ]);

    let lambda = require('../lambda-mastodonreplies.js');
    let results = await lambda.handler();
    expect(results.status).toBe('Replies processed');
});

test('tests 1 mention with same id as last processed, skips processing', async () => {

    lastStatusQuery.getLastDbStatus.mockResolvedValue(
        {"Items":[{"statusKey":"lastStatusId","lastReplyId":"1"}],"Count":1,"ScannedCount":1}
    );

    //mock mastodon api query for mentions
    mastodonReplies.queryMentions.mockResolvedValue([
        {
            'id': '1',
            'type': 'mention',
            'created_at': '2022-11-27T03:24:08.275Z',
            'account': {
                id: 111111,
                'acct': 'mockuser'
            },
            'status': {
            'id': '112233',
            'content': 'test status1'
            }
        }
    ]);

    let lambda = require('../lambda-mastodonreplies.js');
    let results = await lambda.handler();
    expect(results.status).toBe('No replies processed');
});

test('tests 0 mentions since last processed', async () => {
    //mock dynamodb lookup for last processed reply id;
    lastStatusQuery.getLastDbStatus.mockResolvedValue(
        {"Items":[{"statusKey":"lastStatusId","lastReplyId":"1"}],"Count":1,"ScannedCount":1}
    );

    //mock mastodon api query for mentions - return 0 results
    mastodonReplies.queryMentions.mockResolvedValue([]);

    let lambda = require('../lambda-mastodonreplies.js');
    let results = await lambda.handler();
    expect(results.status).toBe('No replies since last check');
});

test('game command is parsed from reply html and result is sent to player', async () => {

    lastStatusQuery.getLastDbStatus.mockResolvedValue(
        {"Items":[{"statusKey":"lastStatusId","lastReplyId":"1"}],"Count":1,"ScannedCount":1}
    );

    mastodonReplies.queryMentions.mockResolvedValue([
        {
            'id': '2',
            'type': 'mention',
            'created_at': '2022-11-27T03:24:08.275Z',
            'account': {
                id: 111111,
                'acct': 'mockuser'
            },
            'status': {
            'id': '112233',
            'content': '<p><span class="h-card"><a href="https://botsin.space/@blackjackcardgamebot" class="u-url mention" rel="nofollow noopener noreferrer" target="_blank">@<span>blackjackcardgamebot</span></a></span> Deal</p>'
            }
        }
    ]);
    blackjackGameplay.playTurn.mockResolvedValue('Your hand: 10H 5C - Reply hit or stick');

    let lambda = require('../lambda-mastodonreplies.js');
    let results = await lambda.handler();
    expect(results.status).toBe('Replies processed');
    expect(blackjackGameplay.playTurn).toHaveBeenCalledWith('mockuser', 'deal');
    expect(mastodonSend.postMastodon).toHaveBeenCalledWith('112233',
        { 'text': '@mockuser Your hand: 10H 5C - Reply hit or stick' });
});

test('game lambda failure replies with error message', async () => {

    lastStatusQuery.getLastDbStatus.mockResolvedValue(
        {"Items":[{"statusKey":"lastStatusId","lastReplyId":"1"}],"Count":1,"ScannedCount":1}
    );

    mastodonReplies.queryMentions.mockResolvedValue([
        {
            'id': '2',
            'type': 'mention',
            'created_at': '2022-11-27T03:24:08.275Z',
            'account': {
                id: 111111,
                'acct': 'mockuser'
            },
            'status': {
            'id': '112233',
            'content': '<p>@blackjackcardgamebot hit</p>'
            }
        }
    ]);
    blackjackGameplay.playTurn.mockRejectedValue(new Error('Unhandled'));

    let lambda = require('../lambda-mastodonreplies.js');
    let results = await lambda.handler();
    expect(results.status).toBe('Replies processed');
    expect(mastodonSend.postMastodon.mock.calls[0][1].text).toMatch(/^@mockuser Oops, something went wrong/);
});

//mock mention notification from mockuser with a game command
const mention = (id, command) => ({
    'id': id,
    'type': 'mention',
    'created_at': '2022-11-27T03:24:08.275Z',
    'account': {
        id: 111111,
        'acct': 'mockuser'
    },
    'status': {
        'id': `status${id}`,
        'content': `<p>@blackjackcardgamebot ${command}</p>`
    }
});

test('mentions are played oldest first, comparing ids as numbers', async () => {
    lastStatusQuery.getLastDbStatus.mockResolvedValue(
        {"Items":[{"statusKey":"lastStatusId","lastReplyId":"9"}],"Count":1,"ScannedCount":1}
    );
    //newest first, as returned by Mastodon. '10' < '9' as strings, but not as numbers
    mastodonReplies.queryMentions.mockResolvedValue([mention('11', 'stick'), mention('10', 'deal')]);
    blackjackGameplay.playTurn.mockResolvedValue('Your hand: 10H 5C - Reply hit or stick');

    let lambda = require('../lambda-mastodonreplies.js');
    let results = await lambda.handler();
    expect(results.repliesProcessed).toBe(2);
    expect(blackjackGameplay.playTurn.mock.calls.map(call => call[1])).toEqual(['deal', 'stick']);
    expect(mastodonSend.postMastodon.mock.calls.map(call => call[0])).toEqual(['status10', 'status11']);
});

test('last replied to id is saved after each reply', async () => {
    lastStatusQuery.getLastDbStatus.mockResolvedValue(
        {"Items":[{"statusKey":"lastStatusId","lastReplyId":"1"}],"Count":1,"ScannedCount":1}
    );
    mastodonReplies.queryMentions.mockResolvedValue([mention('3', 'hit'), mention('2', 'deal')]);
    blackjackGameplay.playTurn.mockResolvedValue('Your hand: 10H 5C - Reply hit or stick');

    let lambda = require('../lambda-mastodonreplies.js');
    await lambda.handler();
    expect(lastStatusQuery.updateDbStatus.mock.calls).toEqual([['lastStatusId', '2'], ['lastStatusId', '3']]);
});

test('failed reply ends the run without saving its id, so it is retried next run', async () => {
    lastStatusQuery.getLastDbStatus.mockResolvedValue(
        {"Items":[{"statusKey":"lastStatusId","lastReplyId":"1"}],"Count":1,"ScannedCount":1}
    );
    mastodonReplies.queryMentions.mockResolvedValue([mention('3', 'hit'), mention('2', 'deal')]);
    blackjackGameplay.playTurn.mockResolvedValue('Your hand: 10H 5C - Reply hit or stick');
    mastodonSend.postMastodon
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Post reply failed'));

    let lambda = require('../lambda-mastodonreplies.js');
    await expect(lambda.handler()).rejects.toThrow('Post reply failed');
    //only the first reply's id is saved; the hit is not played again next run
    expect(lastStatusQuery.updateDbStatus.mock.calls).toEqual([['lastStatusId', '2']]);
});
