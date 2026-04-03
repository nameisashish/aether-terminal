// ==========================================
// cn() utility — combines clsx + twMerge
// for conditional Tailwind class merging
// ==========================================

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
