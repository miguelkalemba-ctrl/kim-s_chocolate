export type PriceSuggestionItem = {
  category: string;
  condition: "Excellent" | "Good" | "Fair" | "Poor";
  brand: string;
  material: string;
  dateAdded: string;
  price: number;
};

type PriceSuggestionParams = {
  items: PriceSuggestionItem[];
  category: string;
  condition: PriceSuggestionItem["condition"];
  brand: string;
  material: string;
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export function getCameraPriceSuggestion(params: PriceSuggestionParams) {
  const now = Date.now();
  const categoryNorm = normalizeText(params.category);
  const brandNorm = normalizeText(params.brand);
  const materialNorm = normalizeText(params.material);

  const scored = params.items
    .filter((item) => normalizeText(item.category) === categoryNorm)
    .map((item) => {
      let score = 1;

      if (item.condition === params.condition) score += 3;
      if (brandNorm && normalizeText(item.brand) === brandNorm) score += 2;
      if (materialNorm && normalizeText(item.material) === materialNorm) score += 2;

      const addedMs = new Date(item.dateAdded).getTime();
      if (Number.isFinite(addedMs)) {
        const ageDays = Math.max(0, Math.floor((now - addedMs) / (1000 * 60 * 60 * 24)));
        if (ageDays <= 90) score += 2;
        else if (ageDays <= 180) score += 1;
      }

      return { item, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.item.dateAdded.localeCompare(a.item.dateAdded);
    });

  const candidates = scored.slice(0, 8);
  const prices = candidates
    .map((entry) => entry.item.price)
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);

  if (prices.length === 0) {
    return null;
  }

  const middle = Math.floor(prices.length / 2);
  const recommended =
    prices.length % 2 === 0
      ? Math.round((prices[middle - 1] + prices[middle]) / 2)
      : Math.round(prices[middle]);

  const rangeMin = Math.round(prices[0]);
  const rangeMax = Math.round(prices[prices.length - 1]);
  const matchedConditionCount = candidates.filter((entry) => entry.item.condition === params.condition).length;
  const matchedBrandCount = brandNorm
    ? candidates.filter((entry) => normalizeText(entry.item.brand) === brandNorm).length
    : 0;
  const matchedMaterialCount = materialNorm
    ? candidates.filter((entry) => normalizeText(entry.item.material) === materialNorm).length
    : 0;

  return {
    recommended,
    rangeMin,
    rangeMax,
    sampleCount: prices.length,
    reason: `Based on ${prices.length} similar item(s): ${matchedConditionCount} with same condition${brandNorm ? `, ${matchedBrandCount} with same brand` : ""}${materialNorm ? `, ${matchedMaterialCount} with same material` : ""}. Recent items are weighted higher.`,
  };
}
