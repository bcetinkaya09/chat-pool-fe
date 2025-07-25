import { useState, useEffect } from "react";
import Chat from "./components/Chat";
import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_SOCKET_URL);

export default function App() {
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "dark";
  });
  const [step, setStep] = useState<"username" | "room" | "chat">("username");
  const [rooms, setRooms] = useState<string[]>([]);
  const [newRoom, setNewRoom] = useState("");

  useEffect(() => {
    if (step === "room") {
      socket.emit("getRooms");
      socket.on("roomsList", (roomList: string[]) => {
        setRooms(roomList);
      });
      return () => {
        socket.off("roomsList");
      };
    }
  }, [step]);

  const handleUsername = () => {
    if (!username.trim()) {
      setError("Lütfen geçerli bir isim girin!");
      return;
    }
    setStep("room");
    setError("");
  };

  const handleRoomSelect = (selectedRoom: string) => {
    setRoom(selectedRoom);
    setIsLoggedIn(true);
    setStep("chat");
  };

  const handleNewRoom = () => {
    if (!newRoom.trim()) {
      setError("Lütfen bir oda adı girin!");
      return;
    }
    setRoom(newRoom);
    setIsLoggedIn(true);
    setStep("chat");
    setError("");
  };

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("theme", next);
      return next;
    });
  };

  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div
      className={`flex items-center justify-center h-screen ${theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"}`}
    >
      <button
        onClick={toggleTheme}
        className={`absolute top-4 right-4 px-4 py-2 rounded shadow transition-colors duration-200 ${theme === "dark" ? "bg-gray-800 text-white hover:bg-gray-700" : "bg-gray-200 text-gray-900 hover:bg-gray-300"}`}
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>
      <img
        src="/logo.png"
        alt="Logo"
        className="absolute left-1/2 -translate-x-1/2 top-4 w-32 h-32 sm:w-48 sm:h-48 md:w-72 md:h-72 object-contain"
      />
      {step === "username" && (
        <div className={`${theme === "dark" ? "bg-gray-800 text-white" : "bg-white text-gray-900"} p-6 rounded-lg shadow-lg w-full max-w-sm`}>
          <h2 className="text-xl mb-3 text-center">İsminizi Girin</h2>
          <input
            type="text"
            placeholder="İsminiz"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={`w-full p-2 mb-3 rounded outline-none ${theme === "dark" ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-900"}`}
          />
          {error && <p className="text-red-500 text-center mb-3">{error}</p>}
          <button
            onClick={handleUsername}
            className="w-full bg-blue-500 px-4 py-2 rounded hover:bg-blue-600"
          >
            Devam Et
          </button>
        </div>
      )}
      {step === "room" && (
        <div className={`${theme === "dark" ? "bg-gray-800 text-white" : "bg-white text-gray-900"} p-6 rounded-lg shadow-lg w-full max-w-sm`}>
          <h2 className="text-xl mb-3 text-center">Oda Seçin veya Yeni Oda Oluşturun</h2>
          <div className="mb-4">
            <h3 className="mb-2">Mevcut Odalar:</h3>
            {rooms.length === 0 ? (
              <p>Hiç oda yok. Yeni bir oda oluşturabilirsiniz.</p>
            ) : (
              <ul className="mb-2">
                {rooms.map((r) => (
                  <li key={r}>
                    <button
                      className="w-full text-left p-2 rounded hover:bg-blue-500 hover:text-white mb-1 bg-gray-200 text-gray-900"
                      onClick={() => handleRoomSelect(r)}
                    >
                      {r}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <input
            type="text"
            placeholder="Yeni oda adı"
            value={newRoom}
            onChange={(e) => setNewRoom(e.target.value)}
            className={`w-full p-2 mb-3 rounded outline-none ${theme === "dark" ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-900"}`}
          />
          {error && <p className="text-red-500 text-center mb-3">{error}</p>}
          <button
            onClick={handleNewRoom}
            className="w-full bg-blue-500 px-4 py-2 rounded hover:bg-blue-600"
          >
            Yeni Oda Oluştur & Katıl
          </button>
        </div>
      )}
      {step === "chat" && (
        <Chat username={username} room={room} theme={theme} />
      )}
    </div>
  );
}
