require('dotenv').config();
const Telegraf = require('telegraf');
const Datastore = require('nedb');
const { ConfigJson, Post } = require('./models');
const db = new Datastore({ filename: './currator.db', autoload: true });

const helpMessage = `
Here is what I do...
`;

const getUrl = sharedText => sharedText.replace('/share ', '').trim();

function findOne(db, opt) {
  return new Promise(function (resolve, reject) {
    db.findOne(opt, function (err, doc) {
      if (err) {
        reject(err);
      } else {
        resolve(doc);
      }
    });
  });
}

const extractCommonData = ctx => {
  return {
    isGroup: ctx.message.chat.type === 'group',
    groupId: ctx.message.chat.id,
    username: ctx.from.username || ctx.from.first_name
  };
};

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
bot.action('set_summary_period', ({ message }) => {
  // create new Post model
});
bot.action('set_posters_summary_period', ({ message }) => {
  // create new Post model
});
bot.action('set_summary_time', ({ message }) => {
  // create new Post model
});
bot.action('showSummary', ({ message }) => {
  // create new Post model
});
bot.on('message', ctx => {
  console.log(JSON.stringify(ctx.message));
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
    console.log('in new group');
    console.log('Bot joined group: ', groupName);
    const groupInDb = db.find({ type: 'BotInGroupConfig', groupId }, (err, result) => {
      console.log('result: ', result);
      if (err) {
        console.log(`groupInDb find error: ${JSON.stringify(err)}`);
      } else if (result.length) { // found record for this group
        console.log(`In groupInDb ${groupInDb}`);
        ctx.telegram.sendMessage(groupId, 'This looks familiar... I\'ve been here before. Loading previous settings for this group').then(() => {
          ctx.telegram.sendMessage(groupId, 'Reminder: ' + helpMessage);
        });
      } else { // new group
        const botInGroupConfig = ConfigJson(groupId);
        db.insert(botInGroupConfig, (err, newDoc) => {   // Callback is optional
          if (err) {
            ctx.telegram.sendMessage(groupId, `Error: ${err}`);
          } else {
            ctx.telegram.sendMessage(groupId, 'New default configuration created');
            console.log(newDoc);
            console.log(JSON.stringify(newDoc));
            ctx.telegram.sendMessage(groupId, `Hi ${groupName}, it is a pleasure to be here!`);
            ctx.telegram.sendMessage(groupId, helpMessage);
          }
        });
      }
    });
  }
  console.log('after new group check');

  // Main operation, catching reactions to posts and updating reaction count
  if (ctx.message.text === '👍') {
    // Only capture reactions as reply
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.text.startsWith('/share')) {
      // update the post likes
      db.findOne({ url: getUrl(ctx.message.text), groupId }, function (err, toUpdate) {
        if (err) {
          console.log('update likes error: ', err);
        } else if (toUpdate) {
          console.log('found to update: ', JSON.stringify(toUpdate));
          // Update and returns the index value
          db.update({ url: getUrl(ctx.message.text), groupId }, { $set: { likes: ++toUpdate.likes } }, {},
            function (err, updated) {
              console.log('updated', JSON.stringify(updated));
            });
        } else {
          console.log('Error in update. toUpdate: ', toUpdate);
        }
      });
      ctx.telegram.sendMessage(groupId, `${username} liked ${getUrl(ctx.message.reply_to_message.text)}`);
    }
  }
});
bot.launch();