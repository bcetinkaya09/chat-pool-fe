import { useEffect, useState } from "react";
import socket from "../socket";

interface ChatProps {
  username: string;
  room: string;
  theme: string;
}

export default function Chat({ username, room, theme }: ChatProps) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<
    { user: { username: string; id: string }; text: string; type?: string; time?: string; id?: string }[]
  >([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [userId, setUserId] = useState<string>("");
  // Seçili mesajı tutmak için state
  const [selectedMessageIndex, setSelectedMessageIndex] = useState<number | null>(null);
  const [pinnedMessage, setPinnedMessage] = useState<{ user: { username: string; id: string }; text: string; type?: string; time?: string; id?: string } | null>(null);

  useEffect(() => {
    if (!username || !room) return;
    socket.emit("joinRoom", { username, room });

    const messageHandler = (data: {
      user: { username: string; id: string };
      text: string;
      type?: string;
      time?: string;
      id?: string;
    }) => {
      setMessages((prev) => [...prev, data]);
    };

    const allMessagesHandler = (msgs: typeof messages) => {
      setMessages(msgs);
    };

    const usersHandler = (users: string[]) => {
      setOnlineUsers(users);
    };

    socket.on("userId", (id: string) => {
      setUserId(id);
    });

    socket.on("message", messageHandler);
    socket.on("allMessages", allMessagesHandler);
    socket.on("onlineUsers", usersHandler);
    socket.on("pinnedMessage", (msg) => {
      setPinnedMessage(msg);
    });

    return () => {
      socket.off("message", messageHandler);
      socket.off("allMessages", allMessagesHandler);
      socket.off("onlineUsers", usersHandler);
      socket.off("pinnedMessage");
    };
  }, [username, room]);

  const sendMessage = () => {
    if (message.trim()) {
      socket.emit("chatMessage", message);
      setMessage("");
      setSelectedMessageIndex(null); // Mesaj gönderilince seçimi kaldır
    }
  };

  // Mesajı silmek için fonksiyon
  const deleteMessage = () => {
    if (selectedMessageIndex !== null) {
      const msg = messages[selectedMessageIndex];
      if (msg && msg.id) {
        socket.emit("deleteMessage", { room, messageId: msg.id });
      }
      setMessage("");
      setSelectedMessageIndex(null);
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
      {/* Sabitli mesaj kutusu */}
      {pinnedMessage && (
        <div className={`w-full max-w-4xl mb-2 p-3 rounded-lg shadow-lg border-2 flex items-center justify-between ${theme === "dark" ? "border-yellow-400 bg-yellow-900" : "border-yellow-400 bg-yellow-100"}`}>
          <div>
            <strong>{pinnedMessage.user?.username}:</strong> {pinnedMessage.text}
            {pinnedMessage.time && (
              <span className="ml-2 text-xs align-middle">[{pinnedMessage.time}]</span>
            )}
          </div>
          <button
            onClick={() => socket.emit("unpinMessage", { room })}
            className={`ml-4 px-2 py-1 rounded ${theme === "dark" ? "bg-yellow-500 text-black hover:bg-yellow-400" : "bg-yellow-400 text-white hover:bg-yellow-500"}`}
          >
            Sabitlemeyi Kaldır
          </button>
        </div>
      )}
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
          <div className="flex items-center justify-between mb-3">
            <h2 className={`text-xl ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Sohbet</h2>
            {/* Sil butonu sağ üstte, sadece kendi mesajım seçiliyse */}
            {selectedMessageIndex !== null && messages[selectedMessageIndex]?.user.id === userId && (
              <button
                onClick={deleteMessage}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 text-white font-semibold shadow-md transition-transform duration-150 hover:scale-105 hover:from-red-600 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-red-400 ml-2`}
                title="Mesajı sil"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m5 0H6" />
                </svg>
                Sil
              </button>
            )}
          </div>
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
            {messages.map((msg, index) => {
              // msg.user veya msg.user.id undefined ise hata olmasın
              const isOwn = msg.user && msg.user.id === userId;
              const isSystem = msg.type === "system";
              // <p> içinde <div> kullanmak yerine, koşullu olarak farklı elementler döndür
              if (isSystem) {
                return (
                  <p
                    key={index}
                    className={`mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"} text-center`}
                  >
                    <span className={`italic ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                      {msg.text}
                      {msg.time && (
                        <span className="ml-2 text-xs align-middle">[{msg.time}]</span>
                      )}
                    </span>
                  </p>
                );
              } else {
                return (
                  <div
                    key={index}
                    className={`mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"} ${isOwn ? "text-right" : "text-left"}`}
                    onClick={isOwn ? () => setSelectedMessageIndex(index) : undefined}
                    style={{ cursor: isOwn ? "pointer" : "default" }}
                  >
                    {isOwn ? null : <strong>{msg.user?.username}</strong>}
                    <span className={`rounded-lg p-2 ${isOwn ? "ml-auto" : "mt-1 block"} ${theme === "dark" ? (isOwn ? "bg-blue-500" : "bg-gray-600") : (isOwn ? "bg-blue-400" : "bg-gray-300")} ${selectedMessageIndex === index ? 'border-4 border-pink-500' : ''}`}>
                      {msg.text}
                      {msg.time && (
                        <span className="ml-2 text-xs align-middle">[{msg.time}]</span>
                      )}
                    </span>
                    {/* Pin/unpin butonu */}
                    <button
                      onClick={() => pinnedMessage && pinnedMessage.id === msg.id
                        ? socket.emit("unpinMessage", { room })
                        : socket.emit("pinMessage", { room, messageId: msg.id })}
                      className={`ml-2 px-2 py-1 rounded ${pinnedMessage && pinnedMessage.id === msg.id ? "bg-yellow-400 text-white" : "bg-gray-300 text-gray-700"} hover:bg-yellow-500`}
                    >
                      {pinnedMessage && pinnedMessage.id === msg.id ? "Sabitlenen Mesaj" : "Sabitle"}
                    </button>
                  </div>
                );
              }
            })}
          </div>
          <div className="mt-3 flex">
            <input
              type="text"
              placeholder="Mesajınızı yazın..."
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setSelectedMessageIndex(null); // Manuel değişiklikte seçimi kaldır
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              className={`flex-grow p-2 rounded outline-none transition-all duration-150 ${theme === "dark" ? "bg-gray-800 text-white" : "bg-white text-gray-900 border border-gray-300"}`}
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
