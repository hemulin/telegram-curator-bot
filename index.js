require('dotenv').config();
const Telegraf = require('telegraf');
const moment = require('moment');
const Datastore = require('nedb');
const { ConfigJson, Post } = require('./models');
const { getUrl, getSummary, getSummaryWithUser, findOne, extractCommonData } = require('./utils');

// https://github.com/telegraf/telegraf/issues/101
// https://github.com/telegraf/telegraf/issues/624

const helpMessage = `
Here is what I do...
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
  db.insert(post, (err, newDoc) => {   // Callback is optional
    if (err) {
      ctx.telegram.sendMessage(groupId, `Error: ${err}`);
    } else {
      ctx.telegram.sendMessage(groupId, `new post ${url} by ${username}`);
      console.log(`New insered post: ${JSON.stringify(newDoc)}`);
    }
  });
});
bot.command('set_summary_period', ({ message }) => {
  // create new Post model
});
bot.command('set_posters_summary_period', ({ message }) => {
  // create new Post model
});
bot.command('set_summary_time', ({ message }) => {
  // create new Post model
});
bot.command('summary', async ctx => {
  const groupId = ctx.message.chat.id;
  const groupConfig = await findOne(db, { type: 'BotInGroupConfig', groupId });
  const { lastPublishedSummary } = groupConfig;


  // db.find({
  //   type: 'Post',
  //   groupId
  // }, function (err, posts) {
  //   console.log(JSON.stringify(posts));
  // });

  db.find({
    type: 'Post',
    groupId,
    createdAt: { $gte: lastPublishedSummary }
  }, function (err, posts) {
    ctx.telegram.sendMessage(ctx.message.chat.id, getSummary(posts));
  });
});

// Regular flow of messages in the group
bot.on('message', async ctx => {
  console.log(JSON.stringify(ctx.message));
  const { isGroup, groupId, username } = extractCommonData(ctx);

  if (!isGroup) {
    ctx.telegram.sendMessage(groupId, 'This is not a group... I\'m a social guy, show me some company');
    return;
  }

  // db.update({
  //   type: 'BotInGroupConfig',
  //   groupId
  // }, {
  //   $set: { lastPublishedSummary: moment.utc().toISOString() }
  //   // $set: { lastPublishedSummary: moment.utc().add(-2, 'days').toISOString() }
  // }, {},
  // function (err, updated) {
  //   console.log('updated the BotInGroupConfig lastPublishedSummary');
  // });

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
        const botInGroupConfig = ConfigJson(groupId);
        await db.insert(botInGroupConfig, (err, newDoc) => {   // Callback is optional
          if (err) {
            ctx.telegram.sendMessage(groupId, `Error: ${err}`);
          } else {
            ctx.telegram.sendMessage(groupId, `Hi ${groupName}, it is a pleasure to be here!`);
            ctx.telegram.sendMessage(groupId, helpMessage);
          }
        });
      }
    } catch (err) {
      console.log(`groupInDb find error: ${JSON.stringify(err)}`);
    }
  }

  // db.find({ type: 'Post', groupId: -386542506 }, function (err, docs) {
  //   console.log('test docs', docs.map(x => ({ url: x.url, likes: x.likes })));
  // });

  // Main operation, catching reactions to posts and updating reaction count
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
            console.log('updated the post likes');
          });
        } else {
          console.log('Error in update. toUpdate: ', toUpdate);
        }
      } catch (err) {
        console.log('update likes error: ', err);
      }
      ctx.telegram.sendMessage(groupId, `${username} liked ${getUrl(ctx.message.reply_to_message.text)}`);
    }
  }
});
bot.launch();