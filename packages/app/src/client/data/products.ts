export const PRODUCTS = [
  {
    productId: "prod-espresso",
    name: "Espresso Machine",
    price: "299.99",
    description: "Professional 15-bar pressure",
    gradient: "linear-gradient(135deg, #2c1810 0%, #5c3a28 50%, #8b6914 100%)",
    icon: "\u2615",
    image: "https://images.unsplash.com/photo-1548270311-3a9e56a480ff?w=400&h=400&fit=crop&q=80",
  },
  {
    productId: "prod-grinder",
    name: "Burr Grinder",
    price: "89.50",
    description: "40mm conical burrs, 18 settings",
    gradient: "linear-gradient(135deg, #1a1a2e 0%, #3d3d5c 50%, #6b5b95 100%)",
    icon: "\u2699\uFE0F",
    image: "https://images.unsplash.com/photo-1573066380308-24ff4c273dbc?w=400&h=400&fit=crop&q=80",
  },
  {
    productId: "prod-kettle",
    name: "Gooseneck Kettle",
    price: "54.00",
    description: "Temperature control, 1.2L capacity",
    gradient: "linear-gradient(135deg, #0c2340 0%, #1b4d6e 50%, #48a9a6 100%)",
    icon: "\uD83E\uDED6",
    image: "https://images.unsplash.com/photo-1621814688815-bae1c0dbc3d2?w=400&h=400&fit=crop&q=80",
  },
  {
    productId: "prod-scale",
    name: "Precision Scale",
    price: "34.95",
    description: "0.1g accuracy, built-in timer",
    gradient: "linear-gradient(135deg, #2d2d2d 0%, #4a4a4a 50%, #7c7c7c 100%)",
    icon: "\u2696\uFE0F",
    image: "https://images.unsplash.com/photo-1559761340-04607d9f5bff?w=400&h=400&fit=crop&q=80",
  },
  {
    productId: "prod-filters",
    name: "Paper Filters",
    price: "12.00",
    description: "100 pack \u2014 unbleached, V60 & Chemex",
    gradient: "linear-gradient(135deg, #8b7355 0%, #c4a77d 50%, #e8d5b7 100%)",
    icon: "\uD83E\uDEE7",
    image: "https://images.unsplash.com/photo-1498603536246-15572faa67a6?w=400&h=400&fit=crop&q=80",
  },
];

export const EVENT_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  CartSubmitted: { bg: "#e8f5e9", fg: "#2e7d32", label: "CartSubmitted" },
  CartPublished: { bg: "#f3e5f5", fg: "#6a1b9a", label: "CartPublished" },
  InventoryImported: { bg: "#f1f8e9", fg: "#558b2f", label: "InventoryImported" },
  InventoryAdjusted: { bg: "#dcedc8", fg: "#33691e", label: "InventoryAdjusted" },
  InventoryDecommissioned: { bg: "#ffcdd2", fg: "#b71c1c", label: "InventoryDecommissioned" },
  CartActivityTracked: { bg: "#e3f2fd", fg: "#1565c0", label: "CartActivityTracked" },
};

export const DEFAULT_EVENT_COLOR = { bg: "#f5f5f5", fg: "#616161", label: "EVENT" };
