import { NavLink, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import GamePage from "./pages/GamePage";
import PrintPage from "./pages/PrintPage";

export default function App() {
  return (
    <div className="app-shell">
      <div className="bg" aria-hidden="true">
        <div className="bg-orb bg-orb-a" />
        <div className="bg-orb bg-orb-b" />
        <div className="bg-grid" />
      </div>

      <header className="topbar">
        <NavLink className="brand" to="/">
          Two Rooms <span className="brand-and">&amp; a Boom</span>
        </NavLink>
        <nav className="topnav">
          <NavLink to="/print" className="topnav-link">
            Print deck
          </NavLink>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/play/:code?" element={<GamePage />} />
          <Route path="/print" element={<PrintPage />} />
        </Routes>
      </main>

      <footer className="site-footer">
        <p>
          Fan-made · not affiliated with Tuesday Knight Games ·{" "}
          <NavLink to="/print">Print mode</NavLink>
        </p>
      </footer>
    </div>
  );
}
