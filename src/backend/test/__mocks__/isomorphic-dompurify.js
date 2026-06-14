module.exports = {
  sanitize: function (text) {
    if (!text) return '';
    return text
      .replace(/<\/?[^>]+(>|$)/g, '')
      .replace(/javascript:/gi, '')
      .trim();
  },
};
