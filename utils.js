const moment = require('moment');

const getUrl = sharedText => sharedText.replace('/share ', '').trim();
const getSummaryPeriod = hourCount => hourCount.replace('/set_summary_period ', '').trim();
const getPostersSummaryPeriod = hourCount => hourCount.replace('/set_posters_summary_period ', '').trim();

const findOne = async (db, opt) => {
  return new Promise(function (resolve, reject) {
    db.findOne(opt, function (err, doc) {
      if (err) {
        reject(err);
      } else {
        resolve(doc);
      }
    });
  });
};

const getSummaryText = posts =>
  posts.length ?
    'Link: Like count\n' + posts
      .sort((a, b) => b.likes - a.likes)
      .map(x => ({ url: x.url, likes: x.likes }))
      .reduce((prevVal, currVal, idx) => {
        return idx == 0 ? `${currVal.url}: ${currVal.likes}` : prevVal + `\n${currVal.url}: ${currVal.likes}`;
      }, '') :
    'No posts were shared since last periodic summary';

const getSummaryWithUser = posts =>
  posts.length ?
    'Link: Like count (posted by)\n' + posts
      .sort((a, b) => b.likes - a.likes)
      .map(x => ({ url: x.url, likes: x.likes, username: x.username }))
      .reduce((prevVal, currVal, idx) => {
        return idx == 0 ? `${currVal.url}: ${currVal.likes} (${currVal.username})` : prevVal + `\n${currVal.url}: ${currVal.likes} (${currVal.username})`;
      }, '') :
    'No posts were shared since last periodic summary';

const getPostersSummaryText = posts => {
  if (!posts.length) return 'No posts were found to publish summary of users';
  let usersToLikesMap = {};
  for (let post of posts) {
    if (post.username in usersToLikesMap) usersToLikesMap[post.username] = usersToLikesMap[post.username] + post.likes;
    else usersToLikesMap[post.username] = post.likes;
  }
  const sortedUsersMap = Object
    .keys(usersToLikesMap)
    .sort(function (a, b) { return usersToLikesMap[b] - usersToLikesMap[a]; });

  const toJoin = sortedUsersMap.map(x => `${x}: ${usersToLikesMap[x]}\n`);

  return 'Username: Like count\n' + toJoin.join();
};

const extractCommonData = ctx => {
  return {
    isGroup: ctx.message.chat.type === 'group',
    groupId: ctx.message.chat.id,
    username: ctx.from.username || ctx.from.first_name
  };
};

const updatePeriod = async (db, ctx, attr, hours) => {
  const groupId = ctx.message.chat.id;
  try {
    const toUpdate = await findOne(db, {
      type: 'BotInGroupConfig',
      groupId
    });
    if (toUpdate) {
      db.update({
        type: 'BotInGroupConfig',
        groupId
      }, {
        $set: { attr: hours }
      }, {},
      function (err, updated) {
        console.log(`updated ${attr} period`);
      });
    } else {
      console.log('Error in updating period. toUpdate: ', toUpdate);
    }
  } catch (err) {
    console.log('update period error: ', err);
  }
};

const publishPostsSummary = async (bot, db, groupId) => {
  const groupConfig = await findOne(db, { type: 'BotInGroupConfig', groupId });
  const { lastPublishedSummary } = groupConfig;
  db.find({
    type: 'Post',
    groupId,
    createdAt: { $gte: lastPublishedSummary }
  }, function (err, posts) {
    bot.telegram.sendMessage(groupId, getSummaryText(posts));
  });
};

const publishPostersSummary = async (bot, db, groupId) => {
  const groupConfig = await findOne(db, { type: 'BotInGroupConfig', groupId });
  const { lastPublishedPosters } = groupConfig;
  db.find({
    type: 'Post',
    groupId,
    createdAt: { $gte: lastPublishedPosters }
  }, function (err, posts) {
    bot.telegram.sendMessage(groupId, getPostersSummaryText(posts));
  });
};

const publishPeriodicSummary = async (bot, db) => {
  db.find({ type: 'BotInGroupConfig' }, async function (err, configs) {
    for (let config of configs) {
      // Posts summary
      if (moment.utc() >= moment(config.lastPublishedSummary).add(config.summaryPeriodH, 'hours')) {
        const groupId = config.groupId;
        await publishPostsSummary(bot, db, groupId);
        db.update({
          type: 'BotInGroupConfig',
          groupId
        }, {
          $set: { lastPublishedSummary: moment.utc().toISOString() }
        }, {},
        function (err, updated) {
          console.log('updated the lastPublishedSummary of group ', groupId);
        });
      }
      // Posters summary
      if (moment.utc() >= moment(config.lastPublishedPosters).add(config.postersSummaryPeriodH, 'hours')) {
        const groupId = config.groupId;
        await publishPostersSummary(bot, db, groupId);
        db.update({
          type: 'BotInGroupConfig',
          groupId
        }, {
          $set: { lastPublishedPosters: moment.utc().toISOString() }
        }, {},
        function (err, updated) {
          console.log('updated the lastPublishedPosters of group ', groupId);
        });
      }
    }
  });
};

module.exports = {
  getUrl,
  getSummaryPeriod,
  getPostersSummaryPeriod,
  getSummaryText,
  getPostersSummaryText,
  getSummaryWithUser,
  findOne,
  extractCommonData,
  updatePeriod,
  publishPostsSummary,
  publishPostersSummary,
  publishPeriodicSummary
};
