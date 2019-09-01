# Telegram Curator bot

#### Bot to track content sharing in telegram group and publish daily rank summary of most liked shares
##### _Idea credit to [Matan Field](https://www.linkedin.com/in/matan-field-92a2b396/)_

## Usage
1. Create a new bot using botFather
2. Execute the /setprivacy (to `Disable`) on the chat with botFather
3. Change `.env.example` to `.env` and update the bot token and the bot name
4. `npm install`
5. `npm run start`
6. Add your new bot to any group you want to enable this bot functionality of content reactions ranking
7. send `/help` to see what other interactions supported by the bot

### Bot `/help` message:
    Hi there, I'm a curator bot and keep track of shared content and reactions to it.
    Here's how it works:
    1. /share <url> (will let me know you've shared content)
    2. Every time someone 👍 your message (the '/share <url>' one) I update the likes count
    3. Once in 24h (default) I'll send summary message with all the shared content and its likes count
    4, Once in 7d (default) I'll send summary message with report of <user>: <likes count> ranking
    5. /help (will show this message)
    6. /set_summary_period <number of hours> (will update the summary period of shared content. i.e /set_summary_period 36)
    7. /set_posters_summary_period <number of hours> (will update the summary period of users likes. i.e /set_posters_summary_period 168)
    8. /summary will send interim status summary