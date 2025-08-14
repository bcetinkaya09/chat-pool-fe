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
    { user: { username: string; id: string }; text: string; type?: string; time?: string; id?: string; readBy?: string[]; edited?: boolean; editTime?: string; createdAt?: number }[]
  >([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [onlineUsersWithIds, setOnlineUsersWithIds] = useState<{ id: string; username: string; isAdmin?: boolean }[]>([]);
  const [amIAdmin, setAmIAdmin] = useState<boolean>(false);
  const [userId, setUserId] = useState<string>("");
  // Seçili mesajı tutmak için state
  const [selectedMessageIndex, setSelectedMessageIndex] = useState<number | null>(null);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [pinnedMessage, setPinnedMessage] = useState<{ user: { username: string; id: string }; text: string; type?: string; time?: string; id?: string; edited?: boolean; editTime?: string; createdAt?: number } | null>(null);
  const [showReadDetail, setShowReadDetail] = useState<{ open: boolean; messageIndex: number | null }>({ open: false, messageIndex: null });
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<string[]>([]);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionNotify, setMentionNotify] = useState<string | null>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  let typingTimeout: NodeJS.Timeout | null = null;
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
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

  // Oda görünüm ayarları
  const [roomTheme, setRoomTheme] = useState<"dark" | "light">("dark");
  const [roomBg, setRoomBg] = useState<string | null>(null);

  // 1. State'ler
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<typeof messages>([]);
  const [isSearching, setIsSearching] = useState(false);
  // Poll state
  const [activePoll, setActivePoll] = useState<
    | {
        id: string;
        question: string;
        options: { text: string; count: number }[];
        multiple: boolean;
        startedAt: number;
        endsAt: number | null;
        votedUserIds: string[];
      }
    | null
  >(null);
  const [newPollQuestion, setNewPollQuestion] = useState("");
  const [newPollOptions, setNewPollOptions] = useState<string[]>(["", ""]);
  const [newPollMultiple, setNewPollMultiple] = useState(false);
  const [newPollDuration, setNewPollDuration] = useState<number | "">("");
  const [myPollSelection, setMyPollSelection] = useState<number[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; messageId: string | null; username: string | null }>({ show: false, messageId: null, username: null });

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

    // Oda görünüm ayarlarını al
    socket.on("roomAppearance", (appearance: { theme: "dark" | "light"; backgroundColor: string | null }) => {
      if (appearance?.theme) setRoomTheme(appearance.theme);
      if (typeof appearance?.backgroundColor !== "undefined") setRoomBg(appearance.backgroundColor);
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
      // Ben admin miyim?
      const me = users.find((u: { id: string }) => u.id === userId);
      setAmIAdmin(!!me?.isAdmin);
    });
    socket.on("kicked", ({ room: kickedRoom, by }) => {
      if (kickedRoom && kickedRoom.toLowerCase() === room.toLowerCase()) {
        alert(`Bu odadan atıldınız. (Atan: ${by})`);
        onLeaveRoom();
      }
    });

    socket.on("actionError", ({ message }) => {
      if (message) alert(message);
    });

    // Poll events
    socket.on("activePoll", (poll) => setActivePoll(poll));
    socket.on("pollStarted", (poll) => setActivePoll(poll));
    socket.on("pollUpdated", (poll) => setActivePoll(poll));
    socket.on("pollEnded", (poll) => {
      setActivePoll(null);
      // Sonuç mesajı olarak göster
      if (poll) {
        const summary = `${poll.question} → ` + poll.options.map((o: any) => `${o.text}: ${o.count}`).join(", ");
        setMessages((prev) => [
          ...prev,
          { user: { username: "Sistem", id: "system" }, text: `Anket bitti. Sonuçlar: ${summary}`, type: "system", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) }
        ]);
      }
      setMyPollSelection([]);
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
    socket.on("stopTyping", () => {
      setTypingUser(null);
    });

    socket.on("editError", ({ message }) => {
      setEditError(message);
      setTimeout(() => setEditError(null), 4000);
    });

    return () => {
      socket.off("message", messageHandler);
      socket.off("allMessages", allMessagesHandler);
      socket.off("onlineUsers", usersHandler);
      socket.off("pinnedMessage");
      socket.off("messageReadUpdate");
      socket.off("onlineUsersWithIds");
      socket.off("kicked");
      socket.off("actionError");
      socket.off("mentionNotify");
      socket.off("typing");
      socket.off("stopTyping");
      socket.off("editError");
      socket.off("roomAppearance");
      socket.off("activePoll");
      socket.off("pollStarted");
      socket.off("pollUpdated");
      socket.off("pollEnded");
      
      // Interval'i temizle
      if (blinkIntervalRef.current) {
        clearInterval(blinkIntervalRef.current);
        blinkIntervalRef.current = null;
      }
    }
  }, [username, room]);

  // Mevcut listeden adminliğimi güncel hesapla
  useEffect(() => {
    if (!userId) {
      setAmIAdmin(false);
      return;
    }
    const me = onlineUsersWithIds.find(u => u.id === userId);
    setAmIAdmin(!!me?.isAdmin);
  }, [onlineUsersWithIds, userId]);

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
      setShowMentionList(true);
      setMentionSuggestions(onlineUsers.filter(u => u.toLowerCase().includes(match[1].toLowerCase())));
    } else {
      setShowMentionList(false);
    }
  };
  const handleMentionClick = (username: string) => {
    // @ ile başlayan kısmı tamamla
    setMessage((prev) => prev.replace(/@([\wçğıöşüÇĞİÖŞÜ]*)$/i, `@${username} `));
    setShowMentionList(false);
  };

  // Mesaj gönderildiğinde typing durdurulsun
  const sendMessage = () => {
    if (message.trim()) {
      socket.emit("chatMessage", message);
      socket.emit("stopTyping", { room, username });
      setMessage("");
      setSelectedMessageIndex(null);
      setShowMentionList(false);
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

  // Mesaj düzenleme modunu başlat
  const startEditing = (index: number) => {
    const msg = messages[index];
    if (msg && msg.id) {
      // Mesajın 1 dakika içinde gönderilip gönderilmediğini kontrol et
      const messageTime = msg.createdAt || parseInt(msg.id.split('-')[1]);
      const currentTime = Date.now();
      const timeDifference = currentTime - messageTime;
      
      console.log(`Frontend - Mesaj:`, msg);
      console.log(`Frontend - Mesaj zamanı: ${messageTime}, Şu anki zaman: ${currentTime}, Fark: ${timeDifference}ms`);
      
      if (timeDifference <= 300000) { // 5 dakika içinde (test için)
        setEditingMessageIndex(index);
        setEditText(msg.text);
        setSelectedMessageIndex(null);
      } else {
        setEditError(`Mesajı düzenlemek için çok geç! Sadece 1 dakika içinde düzenleyebilirsiniz. (Geçen süre: ${Math.floor(timeDifference/1000)} saniye)`);
        setTimeout(() => setEditError(null), 4000);
      }
    }
  };

  // Mesaj düzenlemeyi iptal et
  const cancelEditing = () => {
    setEditingMessageIndex(null);
    setEditText("");
  };

  // Mesaj düzenlemeyi kaydet
  const saveEdit = () => {
    if (editingMessageIndex !== null && editText.trim()) {
      const msg = messages[editingMessageIndex];
      if (msg && msg.id) {
        socket.emit("editMessage", { room, messageId: msg.id, newText: editText.trim() });
      }
      setEditingMessageIndex(null);
      setEditText("");
    }
  };

  // 2. Mesaj arama fonksiyonu
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    socket.emit("searchMessages", { room, query: searchQuery }, (results: typeof messages) => {
      setSearchResults(results);
    });
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

  // 3. Arama kutusu ve sonuçları UI
  return (
    <div className="w-full flex flex-col items-center" style={roomBg ? { background: roomBg } : undefined}>
      {/* Odadan Çık Butonu */}
      <button
        onClick={() => {
          onLeaveRoom();
        }}
        className={`absolute top-4 left-4 px-4 py-2 rounded shadow transition-colors duration-200 ${theme === "dark" ? "bg-red-700 text-white hover:bg-red-600" : "bg-red-200 text-red-900 hover:bg-red-300"}`}
      >
        Odadan Çık
      </button>
      <h1 className={`text-2xl font-bold mb-2 text-center ${(roomTheme || theme) === "dark" ? "text-blue-400" : "text-blue-700"}`}>
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
          className={`md:w-1/4 p-4 rounded-lg mb-4 md:mb-0 max-h-48 md:max-h-95 overflow-y-auto ${(roomTheme || theme) === "dark" ? "bg-gray-700" : "bg-gray-200"}`}
          style={{
            scrollbarWidth: "thin",
            scrollbarColor:
              (roomTheme || theme) === "dark"
                ? "oklch(0.279 0.041 260.031) oklch(0.373 0.034 259.733)"
                : "#e5e7eb #d1d5db",
          }}
        >
          <h3 className={`text-xl mb-3 ${(roomTheme || theme) === "dark" ? "text-white" : "text-gray-900"}`}>
            Aktif kişiler ({onlineUsers.length})
            {amIAdmin && (
              <span className="ml-2 text-xs px-2 py-1 rounded bg-green-600 text-white align-middle">Admin</span>
            )}
          </h3>
          <ul className={`space-y-1 ${(roomTheme || theme) === "dark" ? "text-white" : "text-gray-900"}`}>
            {onlineUsersWithIds.map((u) => (
              <li
                key={u.id}
                className={`flex items-center justify-between space-x-2 p-2 rounded ${(roomTheme || theme) === "dark" ? "hover:bg-gray-700" : "hover:bg-gray-300"}`}
              >
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>{u.username}</span>
                  {u.isAdmin && <span className="text-xs px-2 py-0.5 rounded bg-yellow-500 text-black">Admin</span>}
                </div>
                {/* Kick button yalnızca admin ve hedef ben değilsem */}
                {amIAdmin && u.id !== userId && (
                  <button
                    className={`px-2 py-1 rounded text-sm ${(roomTheme || theme) === "dark" ? "bg-red-700 text-white hover:bg-red-600" : "bg-red-200 text-red-900 hover:bg-red-300"}`}
                    onClick={() => socket.emit("kickUser", { room, targetUserId: u.id })}
                    title={`${u.username} kullanıcısını at`}
                  >
                    At
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Chat Container */}
        <div className={`md:w-3/4 flex flex-col p-4 rounded-lg ${(roomTheme || theme) === "dark" ? "bg-gray-700" : "bg-gray-200"}`}>
          {/* Poll UI */}
          <div className="mb-3">
            {amIAdmin && !activePoll && (
              <div className={`p-3 rounded border ${(roomTheme || theme) === "dark" ? "border-gray-600 bg-gray-800" : "border-gray-300 bg-white"}`}>
                <div className="font-semibold mb-2">Anket Başlat</div>
                <input
                  type="text"
                  placeholder="Soru"
                  value={newPollQuestion}
                  onChange={(e) => setNewPollQuestion(e.target.value)}
                  className={`w-full p-2 mb-2 rounded outline-none ${(roomTheme || theme) === "dark" ? "bg-gray-900 text-white border border-gray-700" : "bg-white text-gray-900 border border-gray-300"}`}
                />
                {newPollOptions.map((opt, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder={`Seçenek ${idx + 1}`}
                      value={opt}
                      onChange={(e) => setNewPollOptions((prev) => prev.map((p, i) => (i === idx ? e.target.value : p)))}
                      className={`flex-1 p-2 rounded outline-none ${(roomTheme || theme) === "dark" ? "bg-gray-900 text-white border border-gray-700" : "bg-white text-gray-900 border border-gray-300"}`}
                    />
                    {newPollOptions.length > 2 && (
                      <button
                        className="px-2 py-1 bg-red-500 text-white rounded"
                        onClick={() => setNewPollOptions((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Sil
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex gap-2 mb-2">
                  <button
                    className="px-2 py-1 bg-gray-400 text-white rounded"
                    onClick={() => setNewPollOptions((prev) => [...prev, ""]) }
                  >
                    Seçenek Ekle
                  </button>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={newPollMultiple} onChange={(e) => setNewPollMultiple(e.target.checked)} />
                    Çoklu seçim
                  </label>
                  <label className="flex items-center gap-2">
                    <span>Süre (sn, isteğe bağlı):</span>
                    <input
                      type="number"
                      min={5}
                      value={newPollDuration as any}
                      onChange={(e) => setNewPollDuration(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                      className={`w-28 p-1 rounded ${(roomTheme || theme) === "dark" ? "bg-gray-900 text-white border border-gray-700" : "bg-white text-gray-900 border border-gray-300"}`}
                    />
                  </label>
                  <button
                    className="px-3 py-1 bg-blue-600 text-white rounded"
                    onClick={() => {
                      const opts = newPollOptions.map((o) => o.trim()).filter((o) => o.length > 0);
                      if (!newPollQuestion.trim() || opts.length < 2) {
                        alert("Soru ve en az 2 seçenek gerekli.");
                        return;
                      }
                      socket.emit("startPoll", { room, question: newPollQuestion.trim(), options: opts, multiple: newPollMultiple, durationSec: newPollDuration === "" ? null : Number(newPollDuration) });
                      setNewPollQuestion("");
                      setNewPollOptions(["", ""]);
                      setNewPollMultiple(false);
                      setNewPollDuration("");
                    }}
                  >
                    Başlat
                  </button>
                </div>
              </div>
            )}
            {activePoll && (
              <div className={`p-3 rounded border ${(roomTheme || theme) === "dark" ? "border-blue-600 bg-gray-800" : "border-blue-300 bg-white"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">Anket: {activePoll.question}</div>
                  {amIAdmin && (
                    <button className="px-2 py-1 bg-red-500 text-white rounded" onClick={() => socket.emit("endPoll", { room })}>Bitir</button>
                  )}
                </div>
                <div className="space-y-2">
                  {activePoll.options.map((opt, idx) => {
                    const total = activePoll.options.reduce((a, b) => a + b.count, 0) || 0;
                    const pct = total > 0 ? Math.round((opt.count / total) * 100) : 0;
                    const checked = myPollSelection.includes(idx);
                    const disabled = activePoll.votedUserIds.includes(userId);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type={activePoll.multiple ? "checkbox" : "radio"}
                          name="poll"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => {
                            setMyPollSelection((prev) => {
                              if (activePoll.multiple) {
                                return checked ? prev.filter((i) => i !== idx) : [...prev, idx];
                              } else {
                                return [idx];
                              }
                            });
                          }}
                        />
                        <div className="flex-1">
                          <div className="flex justify-between text-sm">
                            <span>{opt.text}</span>
                            <span>{opt.count} {total > 0 ? `(${pct}%)` : ""}</span>
                          </div>
                          <div className="w-full h-2 bg-gray-300 rounded">
                            <div className="h-2 bg-blue-500 rounded" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {!activePoll.votedUserIds.includes(userId) ? (
                    <button
                      className="px-3 py-1 bg-green-600 text-white rounded"
                      onClick={() => {
                        if (myPollSelection.length === 0) {
                          alert("Seçim yapın.");
                          return;
                        }
                        socket.emit("votePoll", { room, optionIndexes: myPollSelection });
                      }}
                    >
                      Oy Ver
                    </button>
                  ) : (
                    <span className="text-sm text-gray-600">Oy verdiniz.</span>
                  )}
                  {activePoll.endsAt && (
                    <span className="text-xs text-gray-500">
                      Bitiş: {new Date(activePoll.endsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Arama kutusu */}
          <div className="mb-3 flex gap-2 items-center">
            <input
              type="text"
              placeholder="Mesajlarda ara..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
              className={`flex-grow p-2 rounded outline-none border ${(roomTheme || theme) === "dark" ? "bg-gray-800 text-white border-gray-600" : "bg-white text-gray-900 border-gray-300"}`}
            />
            <button
              onClick={handleSearch}
              className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Ara
            </button>
            {isSearching && (
              <button
                onClick={() => { setIsSearching(false); setSearchQuery(""); setSearchResults([]); }}
                className="ml-2 px-2 py-1 rounded bg-gray-400 text-white hover:bg-gray-500"
              >
                Temizle
              </button>
            )}
          </div>
          {/* Arama sonuçları */}
          {isSearching && (
            <div className="mb-3 p-2 rounded bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700">
              <div className="mb-2 font-semibold text-blue-600 dark:text-blue-300">Arama Sonuçları ({searchResults.length}):</div>
              {searchResults.length === 0 ? (
                <div className="text-gray-500">Sonuç bulunamadı.</div>
              ) : (
                <ul className="space-y-2 max-h-48 overflow-y-auto">
                  {searchResults.map((msg, idx) => (
                    <li key={msg.id || idx} className="p-2 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                      <div className="text-xs text-gray-500 mb-1">{msg.user?.username} {msg.time && `[${msg.time}]`}</div>
                      <div>{msg.text}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div
            id="chat-container"
            ref={chatContainerRef}
            className={`flex-grow h-64 overflow-y-auto p-3 rounded ${(roomTheme || theme) === "dark" ? "bg-gray-800" : "bg-white"}`}
            style={{
              scrollbarWidth: "thin",
              scrollbarColor:
                (roomTheme || theme) === "dark"
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
                    className={`mb-2 ${(roomTheme || theme) === "dark" ? "text-white" : "text-gray-900"} text-center`}
                    ref={el => setMessageRef(el, msg.id || index.toString())}
                    data-message-id={msg.id || index.toString()}
                  >
                    <span className={`italic ${(roomTheme || theme) === "dark" ? "text-gray-400" : "text-gray-500"}`}>
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
                    className={`mb-2 ${(roomTheme || theme) === "dark" ? "text-white" : "text-gray-900"} ${isOwn ? "text-right" : "text-left"}`}
                    onClick={isOwn ? () => setSelectedMessageIndex(index) : undefined}
                    style={{ cursor: isOwn ? "pointer" : "default" }}
                    ref={el => setMessageRef(el, msg.id || index.toString())}
                    data-message-id={msg.id || index.toString()}
                  >
                    {isOwn ? null : <strong>{msg.user?.username}</strong>}
                    <span className={`rounded-lg p-2 ${isOwn ? "ml-auto" : "mt-1 block"} ${(roomTheme || theme) === "dark" ? (isOwn ? "bg-blue-500" : "bg-gray-600") : (isOwn ? "bg-blue-400" : "bg-gray-300")} ${selectedMessageIndex === index ? 'border-4 border-pink-500' : ''}`}
                      style={{ wordBreak: 'break-all', overflowWrap: 'break-word', whiteSpace: 'normal' }}>
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
                      {msg.edited && (
                        <span className="ml-2 text-xs text-gray-500 italic">(düzenlendi {msg.editTime && `[${msg.editTime}]`})</span>
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
                    {/* Admin için silme butonu - tüm mesajlarda göster */}
                    {amIAdmin && (
                      <button
                        onClick={() => {
                          if (msg.id) {
                            // Admin başka birinin mesajını siliyorsa onay iste
                            if (msg.user?.id !== userId) {
                              setDeleteConfirm({ show: true, messageId: msg.id, username: msg.user?.username || null });
                            } else {
                              // Kendi mesajını siliyorsa direkt sil
                              socket.emit("deleteMessage", { room, messageId: msg.id });
                            }
                          }
                        }}
                        className="ml-2 px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600"
                        title={`${msg.user?.username} kullanıcısının mesajını sil`}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                      </button>
                    )}
                    {/* Kullanıcı kendi mesajını silebilir */}
                    {isOwn && !amIAdmin && (
                      <button
                        onClick={() => {
                          if (msg.id) {
                            socket.emit("deleteMessage", { room, messageId: msg.id });
                          }
                        }}
                        className="ml-2 px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600"
                        title="Mesajınızı silin"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                );
              }
            })}
          </div>
          {/* Admin görünüm ayarları */}
          {amIAdmin && (
            <div className="mt-3 p-3 rounded border border-gray-300 bg-white dark:bg-gray-800">
              <div className="font-semibold mb-2">Oda Görünümü</div>
              <div className="flex flex-wrap gap-2 items-center">
                <label className="flex items-center gap-2">
                  <span className="text-sm">Tema:</span>
                  <select
                    value={roomTheme}
                    onChange={(e) => {
                      const next = e.target.value === 'light' ? 'light' : 'dark';
                      setRoomTheme(next);
                      socket.emit('updateRoomAppearance', { room, theme: next, backgroundColor: roomBg });
                    }}
                    className={`p-1 rounded border ${(roomTheme || theme) === 'dark' ? 'bg-gray-800 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'}`}
                  >
                    <option value="dark">Koyu</option>
                    <option value="light">Açık</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-sm">Arka plan:</span>
                  <input
                    type="color"
                    value={roomBg || '#1f2937'}
                    onChange={(e) => {
                      const color = e.target.value;
                      setRoomBg(color);
                      socket.emit('updateRoomAppearance', { room, theme: roomTheme, backgroundColor: color });
                    }}
                  />
                  <button
                    className="ml-2 px-2 py-1 rounded bg-gray-300 hover:bg-gray-400"
                    onClick={() => {
                      setRoomBg(null);
                      socket.emit('updateRoomAppearance', { room, theme: roomTheme, backgroundColor: null });
                    }}
                  >
                    Sıfırla
                  </button>
                </label>
              </div>
            </div>
          )}
          <div className="mt-3 flex flex-col w-full">
            {/* Düzenleme hata mesajı */}
            {editError && (
              <div className="mb-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
                {editError}
              </div>
            )}
            {/* Mesaj düzenleme alanı */}
            {editingMessageIndex !== null && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-blue-600 mb-2">Mesajı düzenliyorsunuz:</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveEdit();
                      } else if (e.key === "Escape") {
                        cancelEditing();
                      }
                    }}
                    className={`flex-grow p-2 rounded outline-none transition-all duration-150 ${theme === "dark" ? "bg-gray-800 text-white" : "bg-white text-gray-900 border border-gray-300"}`}
                    autoFocus
                  />
                  <button
                    onClick={saveEdit}
                    className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                  >
                    Kaydet
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                  >
                    İptal
                  </button>
                </div>
              </div>
            )}
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
      
      {/* Mesaj silme onay modalı */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-4 shadow-lg min-w-[300px] max-w-[90vw]">
            <div className="font-bold mb-2 text-red-600">Mesaj Silme Onayı</div>
            <div className="mb-4">
              <p>
                <strong>{deleteConfirm.username}</strong> kullanıcısının mesajını silmek istediğinizden emin misiniz?
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Bu işlem geri alınamaz ve tüm kullanıcılara bildirim gönderilecektir.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                className="px-3 py-1 rounded bg-gray-500 text-white hover:bg-gray-600"
                onClick={() => setDeleteConfirm({ show: false, messageId: null, username: null })}
              >
                İptal
              </button>
              <button
                className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600"
                onClick={() => {
                  if (deleteConfirm.messageId) {
                    socket.emit("deleteMessage", { room, messageId: deleteConfirm.messageId });
                  }
                  setDeleteConfirm({ show: false, messageId: null, username: null });
                }}
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
