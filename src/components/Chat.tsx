import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_SOCKET_URL);

interface ChatProps {
  username: string;
  room: string;
  theme: string;
}

export default function Chat({ username, room, theme }: ChatProps) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<
    { user: { username: string; id: string }; text: string; type?: string; time?: string }[]
  >([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    if (!username || !room) return;
    socket.emit("joinRoom", { username, room });

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
  }, [username, room]);

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
    <div className="w-full flex flex-col items-center">
      <h1 className={`text-2xl font-bold mb-2 text-center ${theme === "dark" ? "text-blue-400" : "text-blue-700"}`}>{room.toUpperCase()} ODASI</h1>
      <div className="flex flex-col md:flex-row w-full max-w-4xl p-2 rounded-lg shadow-lg md:space-x-4 md:space-y-0">
        {/* Online Users List */}
        <div
          className={`md:w-1/4 p-4 rounded-lg mb-4 md:mb-0 max-h-48 md:max-h-95 overflow-y-auto ${theme === "dark" ? "bg-gray-700" : "bg-gray-200"}`}
          style={{
            scrollbarWidth: "thin",
            scrollbarColor:
              theme === "dark"
                ? "oklch(0.279 0.041 260.031) oklch(0.373 0.034 259.733)"
                : "#e5e7eb #d1d5db",
          }}
        >
          <h3 className={`text-xl mb-3 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
            Aktif kişiler ({onlineUsers.length})
          </h3>
          <ul className={`space-y-1 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
            {onlineUsers.map((user, index) => (
              <li
                key={index}
                className={`flex items-center space-x-2 p-2 rounded cursor-pointer ${theme === "dark" ? "hover:bg-gray-700" : "hover:bg-gray-300"}`}
              >
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>{user}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Chat Container */}
        <div className={`md:w-3/4 flex flex-col p-4 rounded-lg ${theme === "dark" ? "bg-gray-700" : "bg-gray-200"}`}>
          <h2 className={`text-xl mb-3 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Sohbet</h2>
          <div
            id="chat-container"
            className={`flex-grow h-64 overflow-y-auto p-3 rounded ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}
            style={{
              scrollbarWidth: "thin",
              scrollbarColor:
                theme === "dark"
                  ? "oklch(0.373 0.034 259.733) oklch(0.279 0.041 260.031)"
                  : "#e5e7eb #d1d5db",
            }}
          >
            {messages.map((msg, index) => (
              <p
                key={index}
                className={`mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"} ${
                  msg.type === "system"
                    ? "text-center"
                    : msg.user.id === userId
                    ? "text-right"
                    : "text-left"
                }`}
              >
                {msg.type === "system" ? (
                  <span className={`italic ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                    {msg.text}
                    {msg.time && (
                      <span className="ml-2 text-xs align-middle">[{msg.time}]</span>
                    )}
                  </span>
                ) : (
                  <>
                    {msg.user.id === userId ? (
                      <span className={`rounded-lg p-2 ml-auto ${theme === "dark" ? "bg-blue-500" : "bg-blue-400"}`}>
                        {msg.text}
                        {msg.time && (
                          <span className="ml-2 text-xs align-middle">[{msg.time}]</span>
                        )}
                      </span>
                    ) : (
                      <div className="flex flex-col items-start">
                        <strong>{msg.user.username}</strong>
                        <span className={`rounded-lg p-2 mt-1 ${theme === "dark" ? "bg-gray-600" : "bg-gray-300"}`}>
                          {msg.text}
                          {msg.time && (
                            <span className="ml-2 text-xs align-middle">[{msg.time}]</span>
                          )}
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
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              className={`flex-grow p-2 rounded outline-none ${theme === "dark" ? "bg-gray-800 text-white" : "bg-white text-gray-900 border border-gray-300"}`}
            />
            <button
              onClick={sendMessage}
              className={`ml-2 px-4 py-2 rounded hover:bg-blue-600 ${theme === "dark" ? "bg-blue-500 text-white" : "bg-blue-400 text-white hover:bg-blue-500"}`}
            >
              Gönder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
