export type SearchableItem = {
  name: string;
  code: string;
  category: string;
  location: string;
  repairLocation: string;
  condition: string;
  damageDescription: string;
  notes: string;
  dateAdded: string;
  brand: string;
  material: string;
  year: number;
  price: number;
  width: number;
  height: number;
  depth: number;
};

export type SuggestionLine = {
  label: string;
  value: string;
};

export function getSearchTerms(query: string): string[] {
  return query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function getItemSearchFields(item: SearchableItem): string[] {
  return [
    item.name,
    item.code,
    item.category,
    item.location,
    item.repairLocation,
    item.condition,
    item.damageDescription,
    item.notes,
    item.dateAdded,
    item.brand,
    item.material,
    String(item.year),
    String(item.price),
    `${item.width} ${item.height} ${item.depth}`,
    `${item.width}x${item.height}x${item.depth}`,
  ];
}

export function itemMatchesSearch(item: SearchableItem, query: string): boolean {
  const terms = getSearchTerms(query);
  if (terms.length === 0) return true;

  const searchableFields = getItemSearchFields(item).map((field) => field.toLowerCase());
  return terms.some((term) => searchableFields.some((field) => field.includes(term)));
}

export function getItemSuggestionLines(
  item: SearchableItem,
  query: string,
  formatPrice: (value: number) => string = (value) => String(value)
): SuggestionLine[] {
  const terms = getSearchTerms(query);
  if (terms.length === 0) return [];

  const fields: SuggestionLine[] = [
    { label: "Code", value: item.code },
    { label: "Category", value: item.category },
    { label: "Location", value: item.location },
    { label: "Date", value: item.dateAdded },
    { label: "Price", value: formatPrice(item.price) },
    { label: "Condition", value: item.condition },
    { label: "Brand", value: item.brand },
    { label: "Material", value: item.material },
    { label: "Dimensions", value: `${item.width}×${item.height}×${item.depth} cm` },
  ];

  return fields.filter((field) =>
    terms.some((term) => field.value.toLowerCase().includes(term))
  );
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getHighlightedParts(text: string, query: string) {
  const terms = Array.from(new Set(getSearchTerms(query))).filter((term) => term.length > 0);
  if (terms.length === 0) {
    return [{ text, isMatch: false }];
  }

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "ig");
  const parts = text.split(pattern).filter((part) => part.length > 0);

  return parts.map((part) => ({
    text: part,
    isMatch: terms.some((term) => term.toLowerCase() === part.toLowerCase()),
  }));
}
