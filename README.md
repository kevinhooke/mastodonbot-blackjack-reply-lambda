# Mastodon reply bot - Blackjack card game

Variation of my previous Twitterbot that plays Blackjack - uses Mastodon instead
of Twitter.

Uses a modified copy of https://github.com/kevinhooke/mastodonbot-reply to check
replies to the Mastodon bot and replies gameplay moves when it's the bot's turn. This
provides integration between Mastondon and the gamelogic.

The actual gameplay logic is implemented in a Lambda in BlackjackCardGame.

Re-uses other existing related projects:

- Common card game support: https://github.com/kevinhooke/CardGameCommon
- Blackjack game logic: https://github.com/kevinhooke/BlackjackCardGame


## Deploy

Deploys to AWS.

The lambda, its role, DynamoDB table and 5 minute schedule are managed by Terraform in
`../blackjackbot-infrastructure` (`mastodonreply.tf`). To deploy:

```bash
cd ../blackjackbot-infrastructure
./build-mastodonreply.sh
terraform plan -out=tfplan
terraform apply tfplan
```

## Tests

- `npm test`: unit tests, with the Mastodon API, DynamoDB and the game lambda mocked
- `npm run test:integration`: queries the real Mastodon server in `config/config-mastodon.json`
