import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_SOCKET_URL);

interface ChatProps {
  username: string;
}

export default function Chat({ username }: ChatProps) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<
    { user: { username: string; id: string }; text: string; type?: string }[]
  >([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    socket.emit("join", username);

    const messageHandler = (data: {
      user: { username: string; id: string };
      text: string;
      type?: string;
    }) => {
      setMessages((prev) => [...prev, data]);
    };

    const usersHandler = (users: string[]) => {
      setOnlineUsers(users);
    };

    socket.on("userId", (id: string) => {
      setUserId(id);
    });

    socket.on("message", messageHandler);
    socket.on("onlineUsers", usersHandler);

    return () => {
      socket.off("message", messageHandler);
      socket.off("onlineUsers", usersHandler);
    };
  }, [username]);

  const sendMessage = () => {
    if (message.trim()) {
      socket.emit("chatMessage", message);
      setMessage("");
    }
  };

  useEffect(() => {
    const chatContainer = document.getElementById("chat-container");
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, [messages]);

  if (!username) {
    return null;
  }

  return (
    <div className="flex flex-col md:flex-row w-full max-w-4xl p-2 rounded-lg shadow-lg md:space-x-4 md:space-y-0">
      {/* Online Users List */}
      <div
        className="md:w-1/4 bg-gray-700 p-4 rounded-lg mb-4 md:mb-0 max-h-48 md:max-h-95 overflow-y-auto"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor:
            " oklch(0.279 0.041 260.031) oklch(0.373 0.034 259.733)",
        }}
      >
        <h3 className="text-xl text-white mb-3">
          Aktif kişiler ({onlineUsers.length})
        </h3>
        <ul className="space-y-1 text-white">
          {onlineUsers.map((user, index) => (
            <li
              key={index}
              className="flex items-center space-x-2 hover:bg-gray-700 p-2 rounded cursor-pointer"
            >
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>{user}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Chat Container */}
      <div className="md:w-3/4 flex flex-col bg-gray-700 p-4 rounded-lg">
        <h2 className="text-xl text-white mb-3">Sohbet</h2>
        <div
          id="chat-container"
          className="flex-grow h-64 overflow-y-auto bg-gray-800 p-3 rounded"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor:
              "oklch(0.373 0.034 259.733) oklch(0.279 0.041 260.031)",
          }}
        >
          {messages.map((msg, index) => (
            <p
              key={index}
              className={`mb-2 text-white ${
                msg.type === "system"
                  ? "text-center"
                  : msg.user.id === userId
                  ? "text-right"
                  : "text-left"
              }`}
            >
              {msg.type === "system" ? (
                <span className="italic text-gray-400">{msg.text}</span>
              ) : (
                <>
                  {msg.user.id === userId ? (
                    <span className="bg-blue-500 rounded-lg p-2 ml-auto">
                      {msg.text}
                    </span>
                  ) : (
                    <div className="flex flex-col items-start">
                      <strong>{msg.user.username}</strong>
                      <span className="bg-gray-600 rounded-lg p-2 mt-1">
                        {msg.text}
                      </span>
                    </div>
                  )}
                </>
              )}
            </p>
          ))}
        </div>
        <div className="mt-3 flex">
          <input
            type="text"
            placeholder="Mesajınızı yazın..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-grow p-2 rounded bg-gray-800 text-white outline-none"
          />
          <button
            onClick={sendMessage}
            className="ml-2 bg-blue-500 px-4 py-2 rounded hover:bg-blue-600"
          >
            Gönder
          </button>
        </div>
      </div>
    </div>
  );
}
