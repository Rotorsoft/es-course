import { useState } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { CATEGORIES } from "../data/products.js";

export function Header({
  itemCount,
  onCartOpen,
  searchQuery,
  onSearchChange,
  searchCategory,
  onCategoryChange,
}: {
  itemCount: number;
  onCartOpen: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchCategory: string;
  onCategoryChange: (c: string) => void;
}) {
  const { user, signIn, signUp, signInWithGoogle, signOut, providers, error } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const resetForm = () => {
    setUsername("");
    setDisplayName("");
    setPassword("");
    setMode("signin");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    if (mode === "signup") {
      await signUp(username, displayName, password);
    } else {
      await signIn(username, password);
    }
    setSubmitting(false);
  };

  // Close modal when user signs in successfully
  const prevUser = user;
  if (prevUser && modalOpen) {
    setModalOpen(false);
    resetForm();
  }

  return (
    <>
      <header className="header">
        <a className="header-logo" href="#">
          <span>{"\u2615"}</span> brew<span>cart</span>
        </a>
        <div className="header-search">
          <select value={searchCategory} onChange={(e) => onCategoryChange(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="text"
            placeholder="Search coffee equipment..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => onSearchChange("")}>{"\u2715"}</button>
          )}
          <button>{"\uD83D\uDD0D"}</button>
        </div>

        {user ? (
          <div className="user-info">
            {user.picture && <img className="user-avatar" src={user.picture} alt="" />}
            <span className="user-name">{user.name}</span>
            {user.role === "admin" && <span className="admin-badge">Admin</span>}
            <button className="sign-out-btn" onClick={signOut}>Sign out</button>
          </div>
        ) : (
          <button className="sign-in-btn" onClick={() => setModalOpen(true)}>
            Sign in
          </button>
        )}

        <button className="cart-btn" onClick={onCartOpen}>
          <span className="cart-icon">{"\uD83D\uDED2"}</span>
          Cart
          {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
        </button>
      </header>

      {modalOpen && !user && (
        <>
          <div className="auth-overlay" onClick={() => { setModalOpen(false); resetForm(); }} />
          <div className="auth-modal">
            <button className="auth-modal-close" onClick={() => { setModalOpen(false); resetForm(); }}>
              {"\u2715"}
            </button>
            <h2>{mode === "signup" ? "Create account" : "Sign in"}</h2>
            <form className="auth-modal-form" onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="auth-modal-input"
                autoFocus
              />
              {mode === "signup" && (
                <input
                  type="text"
                  placeholder="Display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="auth-modal-input"
                />
              )}
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-modal-input"
              />
              <button type="submit" className="auth-modal-submit" disabled={submitting}>
                {submitting ? "..." : mode === "signup" ? "Sign up" : "Sign in"}
              </button>
              {providers.includes("google") && mode === "signin" && (
                <button type="button" className="auth-modal-google" onClick={signInWithGoogle}>
                  Continue with Google
                </button>
              )}
              {error && <span className="auth-modal-error">{error}</span>}
            </form>
            <div className="auth-modal-toggle">
              <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
                {mode === "signin" ? "New user? Create an account" : "Already have an account? Sign in"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
