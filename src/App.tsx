import { useState } from "react";
import Chat from "./components/Chat";

export default function App() {
  const [username, setUsername] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState("");

  const joinChat = () => {
    if (username.trim()) {
      setIsLoggedIn(true);
      setError("");
    } else {
      setError("Lütfen geçerli bir isim girin!");
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
      <img
        src="/logo.png"
        alt="Logo"
        width={400}
        height={400}
        className="absolute top-[-50px]"
      />
      {!isLoggedIn ? (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-sm">
          <h2 className="text-xl mb-3 text-center">İsminizi Girin</h2>

          <input
            type="text"
            placeholder="İsminiz"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-2 mb-3 rounded bg-gray-700 text-white outline-none"
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
        <Chat username={username} />
      )}
    </div>
  );
}
