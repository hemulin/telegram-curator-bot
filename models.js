const moment = require('moment');

const ConfigJson = groupId => {
  return {
    type: 'BotInGroupConfig',
    groupId,
    summaryPeriodH: 24,
    postersSummaryPeriodH: 24 * 7,
    createdAt: moment.utc().toISOString(),
    lastPublishedSummary: null,
    lastPublishedPosters: null
  };
};

const Post = (url, username, groupId, userId) => {
  return {
    type: 'Post',
    url,
    userId,
    username,
    groupId,
    likes: 0,
    createdAt: moment().toISOString()
  };
};

// const BotInGroupConfig = class {
//   constructor(groupId) {
//     this.type = 'BotInGroupConfig';
//     this.groupId = groupId;
//     this.summaryPeriodH = 24;
//     this.postersSummaryPeriodH = 24 * 7;
//     this.postSummaryTime = moment.utc();
//     this.createdAt = moment();
//   }
// };

// const Post = class {
//   constructor(url, username, groupId) { // groupId = chatId
//     this.type = 'Post';
//     this.url = url;
//     this.username = username;
//     this.groupId = groupId;
//     this.likes = 0;
//     this.createdAt = moment();
//   }
// };

module.exports = {
  ConfigJson,
  Post
};
