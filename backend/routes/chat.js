const express = require("express");
const router = express.Router();
const db = require("../db");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const docs = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../docs.json"))
);

const getRecentMessages = (sessionId) => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT role, content FROM messages 
       WHERE session_id = ? 
       ORDER BY created_at DESC LIMIT 10`,
      [sessionId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows.reverse());
      }
    );
  });
};

router.post("/chat", async (req, res) => {
  const { sessionId, message } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({ error: "Missing sessionId or message" });
  }

  try {
    db.run(
      `INSERT OR IGNORE INTO sessions (id) VALUES (?)`,
      [sessionId]
    );

    db.run(
      `INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)`,
      [sessionId, "user", message]
    );

    const history = await getRecentMessages(sessionId);

    const prompt = `
You are a support assistant.

STRICT RULES:
- You must ONLY answer using the provided documents.
- If the answer is NOT clearly present in the documents,
  respond EXACTLY with:
  "Sorry, I don’t have information about that."
- Do NOT use outside knowledge.
- Do NOT guess.
- Keep answers concise.

DOCUMENTS:
${JSON.stringify(docs)}

CONVERSATION HISTORY:
${JSON.stringify(history)}

USER QUESTION:
${message}
`;

    const geminiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      }
    );

    const reply =
      geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "Sorry, I don’t have information about that.";

    db.run(
      `INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)`,
      [sessionId, "assistant", reply]
    );

    db.run(
      `UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [sessionId]
    );

    res.json({
      reply,
      tokensUsed: 0
    });

  } catch (error) {
    console.error("Gemini Error:", error.response?.data || error.message);
    res.status(500).json({ error: "LLM or DB error" });
  }
});

router.get("/conversations/:sessionId", (req, res) => {
  const { sessionId } = req.params;

  db.all(
    `SELECT role, content, created_at FROM messages 
     WHERE session_id = ? 
     ORDER BY created_at ASC`,
    [sessionId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    }
  );
});

router.get("/sessions", (req, res) => {
  db.all(
    `SELECT id, updated_at FROM sessions ORDER BY updated_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    }
  );
});

module.exports = router;