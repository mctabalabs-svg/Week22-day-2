function extractBroadcastText(text) {
  if (!text) return null;

  const match = text.match(/^\/broadcast\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function isBlockedSubscriberError(error) {
  return (
    error?.response?.data?.error_code === 403 ||
    error?.message?.includes("blocked") === true
  );
}

function delayForRateLimit(ms = 35) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  extractBroadcastText,
  isBlockedSubscriberError,
  delayForRateLimit,
};