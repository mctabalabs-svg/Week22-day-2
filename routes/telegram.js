const express = require("express");
const axios = require("axios");
const Redis = require("ioredis");
const { Pool } = require("pg");
const {
  extractBroadcastText,
  isBlockedSubscriberError,
  delayForRateLimit,
} = require("../lib/telegramHelpers");
const router = express.Router();

// Telegram Bot API base URL
// Note: Make sure to set your TELEGRAM_BOT_TOKEN in the .env file
const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const redis = new Redis(process.env.REDIS_URL || { host: "127.0.0.1", port: 6379 });
redis.on("error", () => {});
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS telegram_subscribers (
        chat_id BIGINT PRIMARY KEY,
        blocked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (error) {
    console.error("Unable to initialize subscribers table:", error.message);
  }
})();

const setState = async (chatId, state) => {
  await redis.set(`tg:state:${chatId}`, state, "EX", 300);
};

const clearState = async (chatId) => {
  await redis.del(`tg:state:${chatId}`);
};

const isGroupChat = (chat) => chat?.type === "group" || chat?.type === "supergroup";

async function isAdmin(chatId, userId) {
  try {
    const res = await axios.get(`${TELEGRAM_API}/getChatMember`, {
      params: { chat_id: chatId, user_id: userId },
    });
    const status = res.data?.result?.status;
    return status === "creator" || status === "administrator";
  } catch (error) {
    console.error("Unable to verify admin status:", error?.response?.data || error.message || error);
    return false;
  }
}

async function upsertSubscriber(chatId) {
  if (!chatId) return;

  try {
    await pool.query(
      `INSERT INTO telegram_subscribers (chat_id, blocked)
       VALUES ($1, false)
       ON CONFLICT (chat_id) DO UPDATE SET blocked = false`,
      [chatId]
    );
  } catch (error) {
    console.error("Unable to upsert subscriber:", error.message);
  }
}

async function broadcast(text) {
  if (!text) return;

  const { rows } = await pool.query(
    "SELECT chat_id FROM telegram_subscribers WHERE blocked = false"
  );

  for (const row of rows) {
    try {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: row.chat_id,
        text,
      });
      await delayForRateLimit(35);
    } catch (err) {
      if (isBlockedSubscriberError(err)) {
        await pool.query(
          "UPDATE telegram_subscribers SET blocked = true WHERE chat_id = $1",
          [row.chat_id]
        );
      } else {
        console.error("Broadcast error:", err.message);
      }
    }
  }
}

function scheduleDailyBroadcast() {
  const cron = require("node-cron");
  const cronSchedule = process.env.CRON_SCHEDULE || "0 8 * * *";

  return cron.schedule(cronSchedule, async () => {
    await broadcast("Good morning! Today's special: fresh offers and support updates.");
  });
}

// Webhook endpoint to receive updates from Telegram
router.post("/webhook", async (req, res) => {
  console.log("Telegram update:", JSON.stringify(req.body, null, 2));

  try {
    const callbackQuery = req.body.callback_query;
    if (callbackQuery) {
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;

      await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
        callback_query_id: callbackQuery.id,
      });

      if (data === "action:products") {
        await axios.post(`${TELEGRAM_API}/editMessageText`, {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          text: "You picked Products. Loading...",
        });
        await setState(chatId, "products_list");
      } else if (data === "action:orders") {
        await axios.post(`${TELEGRAM_API}/editMessageText`, {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          text: "You picked My orders. Loading...",
        });
        await setState(chatId, "orders_list");
      } else if (data === "action:support") {
        await axios.post(`${TELEGRAM_API}/editMessageText`, {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          text: "You picked Support. Loading...",
        });
        await setState(chatId, "support");
      }

      return res.sendStatus(200);
    }

    const message = req.body.message;
    if (!message) return res.sendStatus(200);

    const chat = message.chat;
    const chatId = chat.id;
    const text = (message.text || "").trim();
    const state = await redis.get(`tg:state:${chatId}`);

    await upsertSubscriber(chatId);

    if (text === "/start") {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: "Karibu! I am your Mctaba bot. Send /help for commands.",
      });
      return res.sendStatus(200);
    } else if (text === "/help") {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: "Available commands:\n/start - welcome message\n/help - show this help\n/menu - open the inline menu\n/admin - group-only admin info\n/kick - kick a replied user (admins only)\n/mute <minutes> - mute a replied user (admins only)\n/broadcast <message> - admin-only broadcast",
      });
      return res.sendStatus(200);
    } else if (text === "/menu") {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: "Pick an option:",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Products", callback_data: "action:products" }],
            [{ text: "My orders", callback_data: "action:orders" }],
            [{ text: "Support", callback_data: "action:support" }],
          ],
        },
      });
      return res.sendStatus(200);
    } else if (text === "/admin") {
      if (!isGroupChat(chat)) {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "Admin commands are only available in groups.",
        });
      } else {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "Group admin commands are enabled.",
        });
      }
      return res.sendStatus(200);
    } else if (text.startsWith("/broadcast")) {
      if (!isGroupChat(chat)) {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "Broadcast is only available in groups.",
        });
        return res.sendStatus(200);
      }

      if (!(await isAdmin(chatId, message.from.id))) {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "Only admins can broadcast.",
        });
        return res.sendStatus(200);
      }

      const broadcastText = extractBroadcastText(text);
      if (!broadcastText) {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "Usage: /broadcast <message>",
        });
        return res.sendStatus(200);
      }

      await broadcast(broadcastText);
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: "Broadcast sent to subscribers.",
      });
      return res.sendStatus(200);
    } else if (text === "/kick") {
      if (!isGroupChat(chat)) {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "This command is only available in groups.",
        });
        return res.sendStatus(200);
      }

      if (!message.reply_to_message) {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "Reply to a message to kick that user.",
        });
        return res.sendStatus(200);
      }

      if (!(await isAdmin(chatId, message.from.id))) {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "Only admins can kick.",
        });
        return res.sendStatus(200);
      }

      const target = message.reply_to_message.from.id;
      await axios.post(`${TELEGRAM_API}/banChatMember`, {
        chat_id: chatId,
        user_id: target,
      });
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: "User kicked.",
      });
      return res.sendStatus(200);
    } else if (text.startsWith("/mute")) {
      if (!isGroupChat(chat)) {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "This command is only available in groups.",
        });
        return res.sendStatus(200);
      }

      if (!message.reply_to_message) {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "Reply to a message to mute that user.",
        });
        return res.sendStatus(200);
      }

      if (!(await isAdmin(chatId, message.from.id))) {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "Only admins can mute.",
        });
        return res.sendStatus(200);
      }

      const muteMatch = text.match(/^\/mute\s+(\d+)$/i);
      if (!muteMatch) {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "Usage: /mute 10",
        });
        return res.sendStatus(200);
      }

      const durationMinutes = parseInt(muteMatch[1], 10);
      const untilDate = Math.floor(Date.now() / 1000) + durationMinutes * 60;
      await axios.post(`${TELEGRAM_API}/restrictChatMember`, {
        chat_id: chatId,
        user_id: message.reply_to_message.from.id,
        until_date: untilDate,
        permissions: { can_send_messages: false },
      });
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `User muted for ${durationMinutes} minute(s).`,
      });
      return res.sendStatus(200);
    } else if (state === "products_list") {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: "You are in the products flow. Here are our product categories...",
      });
      await clearState(chatId);
    } else if (state === "orders_list") {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: "You are in the orders flow. I can show your order history next.",
      });
      await clearState(chatId);
    } else if (state === "support") {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: "You are in the support flow. Please send your question.",
      });
      await clearState(chatId);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Telegram webhook error:", error?.response?.data || error.message || error);
    res.sendStatus(500);
  }
});

module.exports = router;
module.exports.broadcast = broadcast;
module.exports.scheduleDailyBroadcast = scheduleDailyBroadcast;
