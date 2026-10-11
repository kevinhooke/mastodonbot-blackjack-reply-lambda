//mock the aws-sdk Lambda client used to call the game lambda
const mockInvoke = jest.fn();
jest.mock('aws-sdk', () => ({
    Lambda: jest.fn(() => ({ invoke: mockInvoke }))
}));

const blackjackGameplay = require('../blackjack-gameplay.js');

//returns a mock lambda.invoke() result for a Java String response
const gameResponse = (message) => ({
    promise: () => Promise.resolve({ StatusCode: 200, Payload: JSON.stringify(message) })
});

test('parses command from mastodon reply html', () => {
    let content = '<p><span class="h-card"><a href="https://botsin.space/@blackjackcardgamebot" class="u-url mention">@<span>blackjackcardgamebot</span></a></span> Hit</p>';
    expect(blackjackGameplay.parseCommand(content)).toBe('hit');
});

test('parses empty command when only a mention', () => {
    expect(blackjackGameplay.parseCommand('<p>@blackjackcardgamebot</p>')).toBe('');
});

test('invokes game lambda with player and command, and parses string result', async () => {
    mockInvoke.mockReturnValue(gameResponse('Your hand: 10H 5C - Reply hit or stick'));

    let result = await blackjackGameplay.invokeGame('mockuser', 'deal');
    expect(result).toBe('Your hand: 10H 5C - Reply hit or stick');
    expect(mockInvoke).toHaveBeenCalledWith(expect.objectContaining({
        FunctionName: 'twitterbot-blackjack',
        Payload: JSON.stringify({ twitterHandler: 'mockuser', playCommand: 'deal' })
    }));
});

test('invokeGame throws when game lambda fails', async () => {
    mockInvoke.mockReturnValue({
        promise: () => Promise.resolve({ StatusCode: 200, FunctionError: 'Unhandled', Payload: '{"errorMessage":"NPE"}' })
    });

    await expect(blackjackGameplay.invokeGame('mockuser', 'hit')).rejects.toThrow('Unhandled');
});

test('player turn continuing does not play bot turn', async () => {
    mockInvoke.mockReturnValueOnce(gameResponse('Your hand: 10H 5C - Reply hit or stick'));

    let result = await blackjackGameplay.playTurn('mockuser', 'deal');
    expect(result).toBe('Your hand: 10H 5C - Reply hit or stick');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
});

test('player stick plays bot turn until the game ends', async () => {
    mockInvoke
        .mockReturnValueOnce(gameResponse('Your hand: 10H 8C - You stick. @blackjackcardgamebot to play next.'))
        .mockReturnValueOnce(gameResponse("Bot's hand: 5D 9S - @blackjackcardgamebot to play next."))
        .mockReturnValueOnce(gameResponse("Bot's hand: 5D 9S 3H - Bot sticks. You win! Reply deal to play again!"));

    let result = await blackjackGameplay.playTurn('mockuser', 'stick');
    expect(result).toBe("Your hand: 10H 8C - You stick.\n"
        + "Bot's hand: 5D 9S\n"
        + "Bot's hand: 5D 9S 3H - Bot sticks. You win! Reply deal to play again!");
    expect(mockInvoke).toHaveBeenCalledTimes(3);
    expect(JSON.parse(mockInvoke.mock.calls[1][0].Payload).playCommand).toBe('bot-next');
});
