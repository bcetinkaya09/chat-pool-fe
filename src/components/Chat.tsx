import { useEffect, useState, useRef } from "react";
import socket from "../socket";

interface ChatProps {
  username: string;
  room: string;
  theme: string;
  onLeaveRoom: () => void; // yeni prop
}

export default function Chat({ username, room, theme, onLeaveRoom }: ChatProps) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<
    { user: { username: string; id: string }; text: string; type?: string; time?: string; id?: string; readBy?: string[] }[]
  >([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [onlineUsersWithIds, setOnlineUsersWithIds] = useState<{ id: string; username: string }[]>([]);
  const [userId, setUserId] = useState<string>("");
  // Seçili mesajı tutmak için state
  const [selectedMessageIndex, setSelectedMessageIndex] = useState<number | null>(null);
  const [pinnedMessage, setPinnedMessage] = useState<{ user: { username: string; id: string }; text: string; type?: string; time?: string; id?: string } | null>(null);
  const [showReadDetail, setShowReadDetail] = useState<{ open: boolean; messageIndex: number | null }>({ open: false, messageIndex: null });
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<string[]>([]);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionNotify, setMentionNotify] = useState<string | null>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  let typingTimeout: NodeJS.Timeout | null = null;
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState<{top: number, left: number} | null>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  
  // Okundu bilgisi için yeni state'ler
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [visibleMessages, setVisibleMessages] = useState<Set<string>>(new Set());
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [unreadCount, setUnreadCount] = useState(0);
  const [isTabBlinking, setIsTabBlinking] = useState(false);
  const blinkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const originalTitleRef = useRef<string>("");

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

    socket.on("messageReadUpdate", ({ messageId, userId }) => {
      setMessages((prevMsgs) =>
        prevMsgs.map((msg) =>
          msg.id === messageId
            ? { ...msg, readBy: msg.readBy ? [...msg.readBy, userId] : [userId] }
            : msg
        )
      );
    });

    socket.on("onlineUsersWithIds", (users) => {
      setOnlineUsersWithIds(users);
    });

    socket.on("mentionNotify", (data) => {
      setMentionNotify(data.text);
      setTimeout(() => setMentionNotify(null), 4000);
    });

    socket.on("typing", ({ username }) => {
      setTypingUser(username);
      if (typingTimeout) clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => setTypingUser(null), 3000);
    });
    socket.on("stopTyping", ({ username }) => {
      setTypingUser(null);
    });

    return () => {
      socket.off("message", messageHandler);
      socket.off("allMessages", allMessagesHandler);
      socket.off("onlineUsers", usersHandler);
      socket.off("pinnedMessage");
      socket.off("messageReadUpdate");
      socket.off("onlineUsersWithIds");
      socket.off("mentionNotify");
      socket.off("typing");
      socket.off("stopTyping");
      
      // Interval'i temizle
      if (blinkIntervalRef.current) {
        clearInterval(blinkIntervalRef.current);
        blinkIntervalRef.current = null;
      }
    }
  }, [username, room]);

  // Pencere odak kontrolü
  useEffect(() => {
    const handleFocus = () => {
      setIsWindowFocused(true);
      
      // Pencere odaklandığında tüm okunmamış mesajları okundu olarak işaretle
      if (userId && room) {
        messages.forEach((msg) => {
          if (msg.id && msg.user?.id !== userId && !msg.readBy?.includes(userId)) {
            socket.emit("messageRead", { room, messageId: msg.id, userId });
          }
        });
      }
    };
    const handleBlur = () => {
      setIsWindowFocused(false);
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [userId, room, messages]);

  // Tab başlığı yanıp sönme efekti
  useEffect(() => {
    // Mevcut interval'i temizle
    if (blinkIntervalRef.current) {
      clearInterval(blinkIntervalRef.current);
      blinkIntervalRef.current = null;
    }

    // Orijinal başlığı kaydet
    if (!originalTitleRef.current) {
      originalTitleRef.current = `${room.toUpperCase()} - ChatPool`;
    }

    // Okunmamış mesaj varsa ve pencere odakta değilse yanıp sön
    if (unreadCount > 0 && !isWindowFocused) {
      setIsTabBlinking(true);
      let isVisible = true;
      
      // Mesaj sayısına göre farklı hızlar
      const blinkSpeed = unreadCount <= 3 ? 1000 : unreadCount <= 10 ? 600 : 400;
      
      blinkIntervalRef.current = setInterval(() => {
        if (isVisible) {
          document.title = `(${unreadCount}) ${room.toUpperCase()} - ChatPool`;
        } else {
          // Mesaj sayısına göre farklı efektler
          if (unreadCount === 1) {
            document.title = `💬 Yeni mesaj! - ChatPool`;
          } else if (unreadCount <= 5) {
            document.title = `📱 ${unreadCount} yeni mesaj! - ChatPool`;
          } else if (unreadCount <= 15) {
            document.title = `🚨 ${unreadCount} yeni mesaj! - ChatPool`;
          } else {
            document.title = `🔥 ${unreadCount} yeni mesaj! - ChatPool`;
          }
        }
        isVisible = !isVisible;
      }, blinkSpeed);
    } else {
      setIsTabBlinking(false);
      // Normal başlığı geri yükle
      if (unreadCount > 0 && !isWindowFocused) {
        document.title = `(${unreadCount}) ${room.toUpperCase()} - ChatPool`;
      } else {
        document.title = originalTitleRef.current;
      }
    }

    // Cleanup
    return () => {
      if (blinkIntervalRef.current) {
        clearInterval(blinkIntervalRef.current);
        blinkIntervalRef.current = null;
      }
    };
  }, [unreadCount, isWindowFocused, room]);

  // Okunmamış mesaj sayısını hesapla ve tab başlığını güncelle
  useEffect(() => {
    if (!userId) return;
    
    // Okunmamış mesajları say (kendi mesajları hariç)
    const unreadMessages = messages.filter(msg => 
      msg.id && 
      msg.user?.id !== userId && // Kendi mesajlarını sayma
      !msg.readBy?.includes(userId) // Henüz okunmamış
    );
    
    setUnreadCount(unreadMessages.length);
    
    // Tab başlığını güncelle (yanıp sönme efekti ayrı useEffect'te yönetiliyor)
    if (unreadMessages.length > 0 && !isWindowFocused && !isTabBlinking) {
      document.title = `(${unreadMessages.length}) ${room.toUpperCase()} - ChatPool`;
    } else if (!isTabBlinking) {
      document.title = `${room.toUpperCase()} - ChatPool`;
    }
  }, [messages, userId, isWindowFocused, room, isTabBlinking]);

  // Intersection Observer ile mesaj görünürlük kontrolü
  useEffect(() => {
    if (!userId || !room || !isWindowFocused) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const messageId = entry.target.getAttribute('data-message-id');
          if (!messageId) return;

          if (entry.isIntersecting) {
            setVisibleMessages(prev => new Set([...prev, messageId]));
          } else {
            setVisibleMessages(prev => {
              const newSet = new Set(prev);
              newSet.delete(messageId);
              return newSet;
            });
          }
        });
      },
      {
        root: chatContainerRef.current,
        rootMargin: '0px',
        threshold: 0.5 // Mesajın %50'si görünür olmalı
      }
    );

    // Tüm mesaj elementlerini gözlemle
    messageRefs.current.forEach((element) => {
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, [messages, userId, room, isWindowFocused]);

  // Görünür mesajları okundu olarak işaretle
  useEffect(() => {
    if (!userId || !room || !isWindowFocused) return;

    visibleMessages.forEach((messageId) => {
      const message = messages.find(msg => msg.id === messageId);
      if (message && !message.readBy?.includes(userId)) {
        socket.emit("messageRead", { room, messageId, userId });
      }
    });
  }, [visibleMessages, userId, room, isWindowFocused, messages]);

  // Mesaj referanslarını güncelle
  const setMessageRef = (element: HTMLDivElement | null, messageId: string) => {
    if (element) {
      messageRefs.current.set(messageId, element);
    } else {
      messageRefs.current.delete(messageId);
    }
  };

  // Mention autocomplete logic
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMessage(val);
    setSelectedMessageIndex(null);
    // Typing event
    if (val.length > 0) {
      socket.emit("typing", { room, username });
    } else {
      socket.emit("stopTyping", { room, username });
    }
    // Mention suggestion
    const match = val.match(/@([\wçğıöşüÇĞİÖŞÜ]*)$/i);
    if (match) {
      setMentionQuery(match[1]);
      setShowMentionList(true);
      setMentionSuggestions(onlineUsers.filter(u => u.toLowerCase().includes(match[1].toLowerCase())));
    } else {
      setShowMentionList(false);
      setMentionQuery("");
    }
  };
  const handleMentionClick = (username: string) => {
    // @ ile başlayan kısmı tamamla
    setMessage((prev) => prev.replace(/@([\wçğıöşüÇĞİÖŞÜ]*)$/i, `@${username} `));
    setShowMentionList(false);
    setMentionQuery("");
  };

  // Mesaj gönderildiğinde typing durdurulsun
  const sendMessage = () => {
    if (message.trim()) {
      socket.emit("chatMessage", message);
      socket.emit("stopTyping", { room, username });
      setMessage("");
      setSelectedMessageIndex(null);
      setShowMentionList(false);
      setMentionQuery("");
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    }
    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  if (!username) {
    return null;
  }

  return (
    <div className="w-full flex flex-col items-center">
      {/* Odadan Çık Butonu */}
      <button
        onClick={() => {
          onLeaveRoom();
        }}
        className={`absolute top-4 left-4 px-4 py-2 rounded shadow transition-colors duration-200 ${theme === "dark" ? "bg-red-700 text-white hover:bg-red-600" : "bg-red-200 text-red-900 hover:bg-red-300"}`}
      >
        Odadan Çık
      </button>
      <h1 className={`text-2xl font-bold mb-2 text-center ${theme === "dark" ? "text-blue-400" : "text-blue-700"}`}>
        {room.toUpperCase()} ODASI
        {unreadCount > 0 && !isWindowFocused && (
          <span className={`ml-2 px-2 py-1 text-xs rounded-full font-bold animate-pulse ${theme === "dark" ? "bg-red-600 text-white" : "bg-red-500 text-white"}`}>
            {unreadCount} {unreadCount === 1 ? 'yeni mesaj' : 'yeni mesaj'}
            {isTabBlinking && (
              <span className="ml-1 animate-bounce">🔔</span>
            )}
          </span>
        )}
      </h1>
      {/* Sabitli mesaj kutusu */}
      {pinnedMessage && (
        <div className={`w-full max-w-4xl mb-2 p-3 rounded-lg shadow-lg border-2 flex items-center justify-between ${theme === "dark" ? "border-yellow-400 bg-yellow-900" : "border-yellow-400 bg-yellow-100"}`}>
          <div className="flex items-center">
            <svg 
              className="mr-3 w-6 h-6 text-red-500" 
              fill="currentColor" 
              viewBox="0 0 24 24"
              style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
            >
              <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.9 1 3 1.9 3 3V21C3 22.1 3.9 23 5 23H19C20.1 23 21 22.1 21 21V9ZM19 21H5V3H13V9H19V21Z"/>
              <circle cx="12" cy="4" r="1.5" fill="#FFD700"/>
              <path d="M8 12H16V14H8V12ZM8 16H14V18H8V16Z" fill="#FFD700"/>
            </svg>
            <div>
              <strong>{pinnedMessage.user?.username}:</strong> {pinnedMessage.text}
              {pinnedMessage.time && (
                <span className="ml-2 text-xs align-middle">[{pinnedMessage.time}]</span>
              )}
            </div>
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
            ref={chatContainerRef}
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
                    ref={el => setMessageRef(el, msg.id || index.toString())}
                    data-message-id={msg.id || index.toString()}
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
                    ref={el => setMessageRef(el, msg.id || index.toString())}
                    data-message-id={msg.id || index.toString()}
                  >
                    {isOwn ? null : <strong>{msg.user?.username}</strong>}
                    <span className={`rounded-lg p-2 ${isOwn ? "ml-auto" : "mt-1 block"} ${theme === "dark" ? (isOwn ? "bg-blue-500" : "bg-gray-600") : (isOwn ? "bg-blue-400" : "bg-gray-300")} ${selectedMessageIndex === index ? 'border-4 border-pink-500' : ''}`}>
                      {msg.text.split(/(@[\wçğıöşüÇĞİÖŞÜ]+)/gi).map((part, i) =>
                        /^@[\wçğıöşüÇĞİÖŞÜ]+$/i.test(part) ? (
                          <span key={i} className="text-blue-500 font-bold">{part}</span>
                        ) : (
                          <span key={i}>{part}</span>
                        )
                      )}
                      {msg.time && (
                        <span className="ml-2 text-xs align-middle">[{msg.time}]</span>
                      )}
                      {/* Okundu tikleri */}
                      {isOwn && (
                        <span className="ml-2 align-middle">
                          {msg.readBy && msg.readBy.length > 1 ? (
                            // Çift tik (en az 1 kişi daha okuduysa)
                            <svg xmlns="http://www.w3.org/2000/svg" className="inline h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17l4 4L23 11" />
                            </svg>
                          ) : (
                            // Tek tik (sadece kendisi okuduysa)
                            <svg xmlns="http://www.w3.org/2000/svg" className="inline h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                      )}
                      {/* Okundu detayı info butonu */}
                      <button
                        className="ml-2 align-middle text-xs text-gray-500 hover:text-blue-500"
                        title="Kimler okudu?"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowReadDetail({ open: true, messageIndex: index });
                        }}
                      >
                        <span className="text-lg">👁️</span>
                      </button>
                    </span>
                    {/* Pin/unpin butonu */}
                    <button
                      onClick={() => pinnedMessage && pinnedMessage.id === msg.id
                        ? socket.emit("unpinMessage", { room })
                        : socket.emit("pinMessage", { room, messageId: msg.id })}
                      className={`ml-2 px-2 py-1 rounded ${pinnedMessage && pinnedMessage.id === msg.id ? "bg-yellow-400 text-white" : "bg-gray-300 text-gray-700"} hover:bg-yellow-500`}
                      title={pinnedMessage && pinnedMessage.id === msg.id ? "Sabitlemeyi Kaldır" : "Mesajı Sabitle"}
                    >
                      {pinnedMessage && pinnedMessage.id === msg.id ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.9 1 3 1.9 3 3V21C3 22.1 3.9 23 5 23H19C20.1 23 21 22.1 21 21V9ZM19 21H5V3H13V9H19V21Z"/>
                          <circle cx="12" cy="4" r="1.5" fill="#FFD700"/>
                          <path d="M8 12H16V14H8V12ZM8 16H14V18H8V16Z" fill="#FFD700"/>
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.9 1 3 1.9 3 3V21C3 22.1 3.9 23 5 23H19C20.1 23 21 22.1 21 21V9ZM19 21H5V3H13V9H19V21Z"/>
                          <circle cx="12" cy="4" r="1.5" fill="#FFD700"/>
                          <path d="M8 12H16V14H8V12ZM8 16H14V18H8V16Z" fill="#FFD700"/>
                        </svg>
                      )}
                    </button>
                  </div>
                );
              }
            })}
          </div>
          <div className="mt-3 flex flex-col w-full">
            <div className="relative w-full flex gap-2">
              {typingUser && typingUser !== username && (
                <div className="absolute left-3 -top-5 text-xs text-gray-600 bg-white px-1 rounded shadow-sm z-10" style={{ pointerEvents: 'none' }}>{typingUser} yazıyor...</div>
              )}
              <input
                type="text"
                placeholder="Mesajınızı yazın..."
                value={message}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                className={`flex-grow p-2 rounded outline-none transition-all duration-150 ${theme === "dark" ? "bg-gray-800 text-white" : "bg-white text-gray-900 border border-gray-300"}`}
                style={{ minWidth: 0 }}
              />
              {/* Mention suggestion list */}
              {showMentionList && mentionSuggestions.length > 0 && (
                <div className="absolute bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-lg mt-12 z-50 max-h-40 overflow-y-auto w-60">
                  {mentionSuggestions.map((u) => (
                    <div
                      key={u}
                      className="px-3 py-2 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900"
                      onClick={() => handleMentionClick(u)}
                    >
                      @{u}
                    </div>
                  ))}
                </div>
              )}
              {/* Mention notification */}
              {mentionNotify && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-6 py-2 rounded shadow-lg z-50">
                  {mentionNotify}
                </div>
              )}
              <button
                ref={emojiButtonRef}
                type="button"
                className="ml-2 px-2 py-2 rounded hover:bg-gray-700 transition-all duration-150 text-2xl"
                style={{ background: "none", border: "none" }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (emojiButtonRef.current) {
                    const rect = emojiButtonRef.current.getBoundingClientRect();
                    setEmojiPickerPosition({
                      top: rect.bottom + window.scrollY + 5,
                      left: rect.left + window.scrollX,
                    });
                  }
                  setShowEmojiPicker((prev) => !prev);
                }}
              >
                😂
              </button>
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  style={{
                    position: "absolute",
                    top: "-60px",
                    left: "0",
                    zIndex: 1000,
                    background: theme === "dark" ? "#2d3748" : "#fff",
                    border: "1px solid #ccc",
                    borderRadius: 8,
                    padding: 8,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    display: "flex",
                    gap: 8,
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  {["😂", "😍", "😎", "🥳", "😢", "👍", "🔥", "🎉", "🤔", "😅"].map((emj) => (
                    <span
                      key={emj}
                      style={{ fontSize: 24, cursor: "pointer" }}
                      onClick={() => {
                        setMessage((prev) => prev + emj);
                        setShowEmojiPicker(false);
                      }}
                    >
                      {emj}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={sendMessage}
                className={`ml-2 px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 transition-all duration-150`}
              >
                Gönder
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Okundu detayı modalı */}
      {showReadDetail.open && showReadDetail.messageIndex !== null && (
        (() => {
          const msg = messages[showReadDetail.messageIndex!];
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
              <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-4 shadow-lg min-w-[250px] max-w-[90vw]">
                <div className="font-bold mb-2">Okundu Bilgisi</div>
                <div>
                  <span className="font-semibold">Okuyanlar:</span>
                  <ul className="list-disc ml-5">
                    {onlineUsersWithIds.filter(u => msg.readBy?.includes(u.id)).map(u => (
                      <li key={u.id}>{u.username}</li>
                    ))}
                  </ul>
                </div>
                <div className="mt-2">
                  <span className="font-semibold">Okumayanlar:</span>
                  <ul className="list-disc ml-5">
                    {onlineUsersWithIds.filter(u => !(msg.readBy || []).includes(u.id)).map(u => (
                      <li key={u.id}>{u.username}</li>
                    ))}
                  </ul>
                </div>
                <button
                  className="mt-3 px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600"
                  onClick={() => setShowReadDetail({ open: false, messageIndex: null })}
                >
                  Kapat
                </button>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
}
