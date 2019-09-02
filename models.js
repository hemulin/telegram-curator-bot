const moment = require('moment');

const EPOCH = '1970-01-01T00:00:00Z';

const ConfigJson = (groupId, groupName) => {
  return {
    type: 'BotInGroupConfig',
    groupId,
    groupName,
    selfReactions: true,
    summaryPeriodH: 24,
    postersSummaryPeriodH: 24 * 7,
    createdAt: moment.utc().toISOString(),
    lastPublishedSummary: EPOCH,
    lastPublishedPosters: EPOCH
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
    createdAt: moment.utc().toISOString()
  };
};

module.exports = {
  EPOCH,
  ConfigJson,
  Post
};
