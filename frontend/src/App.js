import React, { useEffect, useState } from "react";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import "./App.css";

function App() {
  const [sessionId, setSessionId] = useState("");
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let id = localStorage.getItem("sessionId");
    if (!id) {
      id = uuidv4();
      localStorage.setItem("sessionId", id);
    }
    setSessionId(id);
    fetchConversation(id);
  }, []);

  const fetchConversation = async (id) => {
    const res = await axios.get(
      `http://localhost:5000/api/conversations/${id}`
    );
    setChat(res.data);
  };

  const sendMessage = async () => {
    if (!message.trim()) return;

    setLoading(true);

    const userMessage = { role: "user", content: message };
    setChat((prev) => [...prev, userMessage]);

    try {
      const res = await axios.post("http://localhost:5000/api/chat", {
        sessionId,
        message,
      });

      const botMessage = {
        role: "assistant",
        content: res.data.reply,
      };

      setChat((prev) => [...prev, botMessage]);
      setMessage("");
    } catch (error) {
      alert("Error sending message");
    }

    setLoading(false);
  };

  const newChat = () => {
    const newId = uuidv4();
    localStorage.setItem("sessionId", newId);
    setSessionId(newId);
    setChat([]);
  };

  return (
    <div className="app-container">
      <div className="header">
        AI Support Assistant
        <button className="new-chat-btn" onClick={newChat}>
          New Chat
        </button>
      </div>

      <div className="chat-box">
        {chat.map((msg, index) => (
          <div
            key={index}
            className={`message ${msg.role === "user" ? "user" : "assistant"}`}
          >
            {msg.content}
          </div>
        ))}
        {loading && <div className="loading">Thinking...</div>}
      </div>

      <div className="input-area">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

export default App;