import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely formats a date value to ISO string format (yyyy-MM-dd) for API submission.
 * Handles Date objects, date strings, null, undefined, and invalid dates.
 * 
 * @param date - The date value to format (Date, string, null, or undefined)
 * @param onError - Optional callback to handle formatting errors (e.g., show toast)
 * @returns Formatted date string or null if date is invalid/empty
 */
export function safeFormatDateForAPI(
  date: Date | string | null | undefined,
  onError?: (error: string) => void
): string | null {
  if (!date) return null;

  try {
    let dateObj: Date;
    
    // Handle string dates by converting to Date object
    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      throw new Error("Invalid date type");
    }

    // Check if the Date object is valid
    if (isNaN(dateObj.getTime())) {
      throw new Error("Invalid date value");
    }

    return format(dateObj, "yyyy-MM-dd");
  } catch (error) {
    const errorMessage = `Invalid date provided: ${date}`;
    onError?.(errorMessage);
    return null;
  }
}

/**
 * Safely converts a date value to a Date object for form fields.
 * Handles string dates and validates the result.
 * 
 * @param date - The date value to convert (Date, string, null, or undefined)
 * @returns Valid Date object or undefined if conversion fails
 */
export function safeConvertToDate(date: Date | string | null | undefined): Date | undefined {
  if (!date) return undefined;

  try {
    let dateObj: Date;
    
    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return undefined;
    }

    // Check if the Date object is valid
    if (isNaN(dateObj.getTime())) {
      return undefined;
    }

    return dateObj;
  } catch {
    return undefined;
  }
}

/**
 * Safely formats a date value for display using toLocaleDateString.
 * Handles Date objects, date strings, null, undefined, and invalid dates.
 * 
 * @param date - The date value to format (Date, string, null, or undefined)
 * @param fallback - Optional fallback text when date is invalid (defaults to "Invalid Date")
 * @returns Formatted date string or fallback text
 */
export function safeFormatDateForDisplay(
  date: Date | string | null | undefined,
  fallback: string = "Invalid Date"
): string {
  if (!date) return fallback;

  try {
    let dateObj: Date;
    
    // Handle string dates by converting to Date object
    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return fallback;
    }

    // Check if the Date object is valid
    if (isNaN(dateObj.getTime())) {
      return fallback;
    }

    return dateObj.toLocaleDateString();
  } catch {
    return fallback;
  }
}

/**
 * Safely formats a date value for display using toLocaleTimeString.
 * Handles Date objects, date strings, null, undefined, and invalid dates.
 * 
 * @param date - The date value to format (Date, string, null, or undefined)
 * @param fallback - Optional fallback text when date is invalid (defaults to "Invalid Time")
 * @returns Formatted time string or fallback text
 */
export function safeFormatTimeForDisplay(
  date: Date | string | null | undefined,
  fallback: string = "Invalid Time"
): string {
  if (!date) return fallback;

  try {
    let dateObj: Date;
    
    // Handle string dates by converting to Date object
    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return fallback;
    }

    // Check if the Date object is valid
    if (isNaN(dateObj.getTime())) {
      return fallback;
    }

    return dateObj.toLocaleTimeString();
  } catch {
    return fallback;
  }
}

/**
 * Safely checks if a date is before another date.
 * Handles Date objects, date strings, null, undefined, and invalid dates.
 * 
 * @param date - The date to check (Date, string, null, or undefined)
 * @param compareDate - The date to compare against (defaults to current date)
 * @returns true if date is before compareDate, false otherwise (including invalid dates)
 */
export function safeIsDateBefore(
  date: Date | string | null | undefined,
  compareDate: Date = new Date()
): boolean {
  if (!date) return false;

  try {
    let dateObj: Date;
    
    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return false;
    }

    // Check if the Date object is valid
    if (isNaN(dateObj.getTime()) || isNaN(compareDate.getTime())) {
      return false;
    }

    return dateObj < compareDate;
  } catch {
    return false;
  }
}
