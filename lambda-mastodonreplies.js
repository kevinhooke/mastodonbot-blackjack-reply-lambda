let lastStatusQuery = require('./db_status.js');
let mastodonReplies = require('./mastodon-queryMentions.js');
let mastodonSend = require('./mastodon-send.js');
let blackjackGameplay = require('./blackjack-gameplay.js');
let config = require('./config/config-mastodon.json');

// Mastodon ids are numeric strings that can exceed Number precision, and comparing
// them as strings is wrong when lengths differ ('9' > '10'), so compare as BigInt
const compareIds = (a, b) => {
    let diff = BigInt(a) - BigInt(b);
    return diff > 0n ? 1 : (diff < 0n ? -1 : 0);
}

exports.handler = async () => {

    console.log('mastodonbot-blackjack-reply.lambda-mastodonreplies called');

    let data = await lastStatusQuery.getLastDbStatus('lastStatusId');

        console.log("Retrieved from table, data: " + JSON.stringify(data));
        let lastRepliedToStatusId = '0';
        if(data != undefined && data.Count > 0){
            lastRepliedToStatusId = String(data.Items[0].lastReplyId);
        }

        console.log("lastRepliedToStatusId: " + lastRepliedToStatusId);

        //get last status id that was replied to then pass to Mastodon /notifications query
        let lastReplies = await mastodonReplies.queryMentions(lastRepliedToStatusId);
        console.log(`Last replies since id [${lastRepliedToStatusId}] : ${lastReplies.length}`);

        let repliesProcessed = 0;
        if(lastReplies.length > 0){
            //Mastodon returns newest first; play moves in the order players sent them
            let repliesOldestFirst = [...lastReplies].sort((a, b) => compareIds(a.id, b.id));

            for(let reply of repliesOldestFirst){
                if(compareIds(reply.id, lastRepliedToStatusId) > 0){
                    let replyToAccount = reply.account.acct;
                    console.log(`Reply id [${reply.id}] is after last acknowledged id: ${lastRepliedToStatusId} from: ${replyToAccount}`);

                    let replyToBotText = reply.status.content;
                    console.log(`reply text: ${replyToBotText}`);

                    let textReply = `@${replyToAccount} `;
                    try {
                        let gameplayCommand = blackjackGameplay.parseCommand(replyToBotText);
                        //account is the key for the player's game state
                        textReply = textReply + await blackjackGameplay.playTurn(replyToAccount, gameplayCommand);
                    }
                    catch(err) {
                        console.log(`Call to game lambda failed: ${err}`);
                        textReply = textReply + 'Oops, something went wrong, ' + new Date().toDateString();
                    }

                    let status = ({
                        'text': textReply
                    });

                    if (config['send-enabled'] === "true") {
                        console.log("config.send-enabled: true: sending reply ...");

                        //send reply with Mastodon api. If this fails, the error ends this run
                        //and the reply is retried next run, as its id has not been saved yet
                        let result = await mastodonSend.postMastodon(reply.status.id, status);
                        console.log(`postMastodon result: ${JSON.stringify(result)}`);

                        //save progress after each reply, so a failure later in this run
                        //doesn't replay moves that were already played and replied to
                        let updateResult = await lastStatusQuery.updateDbStatus('lastStatusId', reply.id);
                        console.log(`updateDbStatus result: ${JSON.stringify(updateResult)}`);
                    }
                    else {
                        console.log("config.send-enabled: false, not sending reply or updating last replied to id");
                    }
                    console.log("reply: " + JSON.stringify(status));
                    lastRepliedToStatusId = reply.id;
                    repliesProcessed = repliesProcessed + 1;
                }
                else{
                    console.log(`Reply id [${reply.id}] is before last acknowledged id: ${lastRepliedToStatusId}, ignoring`);
                }
            }
        }
        else{
            console.log("... no more recent statuses yet, skipping");
        }

        let result = {
            status: '',
            repliesProcessed: repliesProcessed
        }
        if(lastReplies.length === 0){
            result.status = 'No replies since last check';
        }
        else if(repliesProcessed > 0){
            result.status = 'Replies processed';
        }
        else{
            result.status = 'No replies processed';
        }
        return result;
}
