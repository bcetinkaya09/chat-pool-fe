import { useState, useEffect } from "react";
import Chat from "./components/Chat";

export default function App() {
  const [username, setUsername] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "dark";
  });

  const joinChat = () => {
    if (username.trim()) {
      setIsLoggedIn(true);
      setError("");
    } else {
      setError("Lütfen geçerli bir isim girin!");
    }
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
        width={400}
        height={400}
        className="absolute top-[-50px]"
      />
      {!isLoggedIn ? (
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
            onClick={joinChat}
            className="w-full bg-blue-500 px-4 py-2 rounded hover:bg-blue-600"
          >
            Giriş Yap
          </button>
        </div>
      ) : (
        <Chat username={username} theme={theme} />
      )}
    </div>
  );
}
