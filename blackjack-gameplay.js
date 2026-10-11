let AWS = require("aws-sdk");
let contentParser = require('./mastodon-contentparser.js');

// Java game logic lambda, deployed by blackjackbot-infrastructure
const GAME_LAMBDA_NAME = 'twitterbot-blackjack';

// The game lambda was written for Twitter: it ends a message with this when it's the
// bot's turn next, expecting the bot to mention itself to trigger the next move.
// Mastodon doesn't notify on self mentions, so the bot's turn is played here instead.
const BOT_TURN_NEXT = /(\s+-)?\s*@blackjackcardgamebot to play next\.?/i;

// safety limit on bot-next calls; the bot sticks on 17+ so should never get close
const MAX_BOT_MOVES = 10;

// region is set explicitly as AWS.config is shared with db_status.js
let lambda = new AWS.Lambda({ region: 'us-west-1' });

// Extracts the gameplay command from a Mastodon status, e.g.
// '<p><span class="h-card">...@<span>blackjackcardgamebot</span>...</span> Deal</p>' => 'deal'
exports.parseCommand = (content) => {
    //stripping the mention html leaves a space after the @, e.g. '@ blackjackcardgamebot Deal'
    let text = contentParser.extractTextFromContent(content).replace(/@\s*\S+/g, '');
    let command = text.split(/\s+/).find(word => word !== '');
    return command ? command.toLowerCase() : '';
}

// Calls the game lambda and returns its reply message
exports.invokeGame = async (player, command) => {
    let payload = {
        twitterHandler : player,
        playCommand : command
    }
    let params = {
        FunctionName: GAME_LAMBDA_NAME,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(payload)
    };

    let data = await lambda.invoke(params).promise();
    if (data.FunctionError) {
        throw new Error(`${GAME_LAMBDA_NAME} returned ${data.FunctionError}: ${data.Payload}`);
    }
    // the Java handler returns a String, which is serialized as a JSON string
    return JSON.parse(data.Payload);
}

// Plays the player's command, then if the player's turn is over, plays the bot's
// turn until it finishes. Returns the reply text for the player (without their mention).
exports.playTurn = async (player, command) => {
    console.log(`playTurn: player [${player}] command [${command}]`);

    let messages = [];
    let message = await exports.invokeGame(player, command);
    console.log(`${GAME_LAMBDA_NAME} reply: ${message}`);

    let botMoves = 0;
    while (BOT_TURN_NEXT.test(message) && botMoves < MAX_BOT_MOVES) {
        messages.push(message.replace(BOT_TURN_NEXT, ''));
        message = await exports.invokeGame(player, 'bot-next');
        console.log(`${GAME_LAMBDA_NAME} bot-next reply: ${message}`);
        botMoves++;
    }
    messages.push(message.replace(BOT_TURN_NEXT, ''));

    return messages.join('\n');
}
