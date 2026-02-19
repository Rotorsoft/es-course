export function Header({
  itemCount,
  onCartOpen,
}: {
  itemCount: number;
  onCartOpen: () => void;
}) {
  return (
    <header className="header">
      <a className="header-logo" href="#">
        <span>{"\u2615"}</span> brew<span>cart</span>
      </a>
      <div className="header-search">
        <select><option>All</option></select>
        <input type="text" placeholder="Search coffee equipment..." />
        <button>{"\uD83D\uDD0D"}</button>
      </div>
      <button className="cart-btn" onClick={onCartOpen}>
        <span className="cart-icon">{"\uD83D\uDED2"}</span>
        Cart
        {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
      </button>
    </header>
  );
}
