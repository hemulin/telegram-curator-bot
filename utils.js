const getUrl = sharedText => sharedText.replace('/share ', '').trim();

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

const getSummary = posts =>
  posts.length ?
    'Link: Like count\n' + posts
      .sort((a, b) => a.likes - b.likes)
      .map(x => ({ url: x.url, likes: x.likes }))
      .reduce((prevVal, currVal, idx) => {
        return idx == 0 ? `${currVal.url}: ${currVal.likes}` : prevVal + `\n${currVal.url}: ${currVal.likes}`;
      }, '') :
    'No posts were shared since lsat periodic summary';

const getSummaryWithUser = posts =>
  posts.length ?
    'Link: Like count (posted by)\n' + posts
      .sort((a, b) => a.likes - b.likes)
      .map(x => ({ url: x.url, likes: x.likes, username: x.username }))
      .reduce((prevVal, currVal, idx) => {
        return idx == 0 ? `${currVal.url}: ${currVal.likes} (${currVal.username})` : prevVal + `\n${currVal.url}: ${currVal.likes} (${currVal.username})`;
      }, '') :
    'No posts were shared since lsat periodic summary';


const extractCommonData = ctx => {
  return {
    isGroup: ctx.message.chat.type === 'group',
    groupId: ctx.message.chat.id,
    username: ctx.from.username || ctx.from.first_name
  };
};

module.exports = {
  getUrl,
  getSummary,
  getSummaryWithUser,
  findOne,
  extractCommonData
};