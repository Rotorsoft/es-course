export function PriceDisplay({ price }: { price: string }) {
  const num = parseFloat(price);
  const dollars = Math.floor(num);
  const cents = Math.round((num - dollars) * 100).toString().padStart(2, "0");
  return (
    <span className="product-price">
      <sup>$</sup>{dollars}<span className="cents">{cents}</span>
    </span>
  );
}
