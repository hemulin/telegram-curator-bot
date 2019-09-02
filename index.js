require('dotenv').config();
const Telegraf = require('telegraf');
const moment = require('moment');
const schedule = require('node-schedule');
const Datastore = require('nedb');
const { ConfigJson, Post } = require('./models');
const {
  getUrl,
  getSummaryPeriod,
  getPostersSummaryPeriod,
  getSummaryText,
  getPostersSummaryText,
  findOne,
  extractCommonData,
  updatePeriod,
  toggleConfigAttribute,
  publishPostsSummary,
  publishPostersSummary,
  publishPeriodicSummary } = require('./utils');

const botReactions = ['👍', '👌', '👆💪', '👏', '👀', '🤦‍♀️🤣', '😎'];

const helpMessage = `
Hi there, I'm a curator bot and keep track of shared content and reactions to it.
Here's how it works:
1. /share <url> (will let me know you've shared content)
2. Every time someone 👍 your message (the '/share <url>' one) I update the likes count
3. Once in 24h (default) I'll send summary message with all the shared content and its likes count
4, Once in 7d (default) I'll send summary message with report of <user>: <likes count> ranking
5. /help (will show this message)
6. /set_summary_period <number of hours> will update the summary period of shared content. i.e /set_summary_period 36
7. /set_posters_summary_period <number of hours> will update the summary period of users likes. i.e /set_posters_summary_period 168
8. /summary will send interim status summary
9. /toggle_self_reactions will turn the bot reactions to share on/off
`;

const db = new Datastore({ filename: './currator.db', autoload: true });
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.help(ctx => ctx.reply(helpMessage));

// Note, order of events is important

bot.command('share', ctx => {
  const { isGroup, groupId, username } = extractCommonData(ctx);
  const url = getUrl(ctx.message.text);
  // TODO: sanitize input? regex to catch url?
  // if (!url.startsWith('http') && !url.startsWith('www')) {
  //   ctx.telegram.sendMessage(groupId, 'Are you certain that is a valid url?');
  //   return;
  // }
  if (!isGroup) {
    ctx.telegram.sendMessage(groupId, 'Not much sense in sharing post with yourself... You\'ve got "Saved messages" chat for that');
    return;
  }
  const post = Post(url, username, groupId);
  db.insert(post, async (err, newDoc) => {   // Callback is optional
    if (err) {
      ctx.telegram.sendMessage(groupId, `Error: ${err}`);
    } else {
      console.log(`New insered post: ${JSON.stringify(newDoc)}`);
      const groupConfig = await findOne(db, { type: 'BotInGroupConfig', groupId });
      if (groupConfig.selfReactions) {
        const randomReaction = botReactions[Math.floor(Math.random() * botReactions.length)];
        ctx.reply(randomReaction, Telegraf.Extra.inReplyTo(ctx.message.message_id));
      }
    }
  });
});
bot.command('set_summary_period', async ctx => {
  const hours = getSummaryPeriod(ctx.message.text);
  await updatePeriod(db, ctx, 'summaryPeriodH', hours);
  ctx.telegram.sendMessage(ctx.message.chat.id, `Changed summary frequency to ${hours} hours`);
});
bot.command('set_posters_summary_period', async ctx => {
  const hours = getPostersSummaryPeriod(ctx.message.text);
  await updatePeriod(db, ctx, 'postersSummaryPeriodH', hours);
  ctx.telegram.sendMessage(ctx.message.chat.id, `Changed posters summary frequency to ${hours} hours`);
});
bot.command('toggle_self_reactions', async ctx => {
  const updatedGroupConfig = await toggleConfigAttribute(db, ctx, 'selfReactions');
  ctx.telegram.sendMessage(ctx.message.chat.id, `Changed self reactions to ${updatedGroupConfig.selfReactions ? 'OFF' : 'ON'}`);
});
bot.command('set_summary_time', async ctx => {
  // TODO: set the summary time for group at specific UTC time of the day
});
bot.command('summary', async ctx => {
  const groupId = ctx.message.chat.id;
  await publishPostsSummary(bot, db, groupId);
});

// Regular flow of messages in the group
bot.on('message', async ctx => {
  const { isGroup, groupId, username } = extractCommonData(ctx);

  if (!isGroup) {
    ctx.telegram.sendMessage(groupId, 'This is not a group... I\'m a social guy, show me some company');
    return;
  }

  const groupName = ctx.message.chat.title;

  if (ctx.message.left_chat_participant && ctx.message.left_chat_participant.username === process.env.BOT_NAME) {
    // Bot was removed from group
    // TODO: delete config and posts from DB?
  }

  // Adding the bot to a new group event
  if (ctx.message.new_chat_participant && ctx.message.new_chat_participant.username === process.env.BOT_NAME) {
    console.log('Bot joined group: ', groupName);
    try {
      const groupInDb = await findOne(db, { type: 'BotInGroupConfig', groupId });
      if (groupInDb) { // found record for this group
        ctx.telegram.sendMessage(groupId, 'This looks familiar... I\'ve been here before. Loading previous settings for this group').then(() => {
          ctx.telegram.sendMessage(groupId, 'Reminder: ' + helpMessage);
        });
      } else { // new group
        const botInGroupConfig = ConfigJson(groupId, groupName);
        await db.insert(botInGroupConfig, (err, newDoc) => {   // Callback is optional
          if (err) {
            ctx.telegram.sendMessage(groupId, `Error: ${err}`);
          } else {
            ctx.telegram.sendMessage(groupId, `${groupName}, it is a pleasure to be here!`).then(() =>
              ctx.telegram.sendMessage(groupId, helpMessage));
          }
        });
      }
    } catch (err) {
      console.log(`groupInDb find error: ${JSON.stringify(err)}`);
    }
  }

  // Main operation, catching likes to posts and updating reaction count
  if (ctx.message.text === '👍') {
    // Only capture reactions as reply
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.text.startsWith('/share')) {
      // update the post likes
      try {
        const toUpdate = await findOne(db, {
          type: 'Post',
          url: getUrl(ctx.message.reply_to_message.text),
          groupId
        });
        if (toUpdate) {
          db.update({
            url: getUrl(ctx.message.reply_to_message.text),
            groupId
          }, {
            $set: { likes: ++toUpdate.likes }
          }, {},
          function (err, updated) {
            // console.log('updated the post likes');
          });
        } else {
          console.log('Error in update likes. toUpdate: ', toUpdate);
        }
      } catch (err) {
        console.log('update likes error: ', err);
      }
      // ctx.telegram.sendMessage(groupId, `${username} liked ${getUrl(ctx.message.reply_to_message.text)}`);
    }
  }
});

// cron job once every minute
schedule.scheduleJob('*/1 * * * *', async () => publishPeriodicSummary(bot, db));

// main polling of bot
bot.launch();
