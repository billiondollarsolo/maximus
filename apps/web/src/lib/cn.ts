import { clsx, type ClassValue } from "clsx";

/** Merge class names for Tailwind utility composition. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
