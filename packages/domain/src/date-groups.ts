export type DateGroupLabel =
  | "Today"
  | "Yesterday"
  | "Previous 7 days"
  | "Older";

export type DatedItem = {
  id: string;
  updatedAt: Date | string;
};

export type DateGroup<T extends DatedItem> = {
  label: DateGroupLabel;
  items: T[];
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Group items into ChatGPT-style date buckets using a fixed `now` for tests.
 */
export function groupByDateGroups<T extends DatedItem>(
  items: T[],
  now: Date = new Date(),
): DateGroup<T>[] {
  const today = startOfDay(now).getTime();
  const dayMs = 86_400_000;
  const buckets: Record<DateGroupLabel, T[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 days": [],
    Older: [],
  };

  const sorted = [...items].sort(
    (a, b) => toDate(b.updatedAt).getTime() - toDate(a.updatedAt).getTime(),
  );

  for (const item of sorted) {
    const t = startOfDay(toDate(item.updatedAt)).getTime();
    const diffDays = Math.round((today - t) / dayMs);
    if (diffDays <= 0) buckets.Today.push(item);
    else if (diffDays === 1) buckets.Yesterday.push(item);
    else if (diffDays < 7) buckets["Previous 7 days"].push(item);
    else buckets.Older.push(item);
  }

  const order: DateGroupLabel[] = [
    "Today",
    "Yesterday",
    "Previous 7 days",
    "Older",
  ];

  return order
    .filter((label) => buckets[label].length > 0)
    .map((label) => ({ label, items: buckets[label] }));
}
