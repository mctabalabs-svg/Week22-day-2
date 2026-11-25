const {
  extractBroadcastText,
  isBlockedSubscriberError,
} = require("../lib/telegramHelpers");

describe("telegramHelpers", () => {
  test("extractBroadcastText returns the broadcast message", () => {
    expect(extractBroadcastText("/broadcast Hello world")).toBe("Hello world");
  });

  test("isBlockedSubscriberError returns true for a 403 error", () => {
    const blockedError = {
      response: {
        data: {
          error_code: 403,
        },
      },
    };

    expect(isBlockedSubscriberError(blockedError)).toBe(true);
  });

  test("isBlockedSubscriberError returns false for other errors", () => {
    const error = {
      response: {
        data: {
          error_code: 500,
        },
      },
    };

    expect(isBlockedSubscriberError(error)).toBe(false);
  });
});