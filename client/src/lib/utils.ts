import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Validates that a date string is in ISO 8601 format (YYYY-MM-DD).
 * 
 * @param dateString - The date string to validate
 * @returns true if the date string is in valid ISO 8601 format, false otherwise
 */
export function isValidISO8601Date(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  
  // Check format using regex
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso8601Regex.test(dateString)) {
    return false;
  }
  
  // Validate that the date is actually valid
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return false;
  }
  
  // Ensure the formatted date matches the input (handles invalid dates like 2023-02-30)
  return format(date, "yyyy-MM-dd") === dateString;
}

/**
 * Validates an object's date fields to ensure they are in ISO 8601 format before API submission.
 * Logs validation results for debugging.
 * 
 * @param obj - Object containing date fields
 * @param dateFields - Array of field names that should contain ISO 8601 dates
 * @returns true if all date fields are valid, false otherwise
 */
export function validateDateFieldsForAPI(obj: Record<string, any>, dateFields: string[]): boolean {
  let allValid = true;
  
  for (const field of dateFields) {
    const value = obj[field];
    if (value !== null && value !== undefined) {
      const isValid = isValidISO8601Date(value);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Date Validation] Field '${field}': ${value} -> ${isValid ? 'VALID' : 'INVALID'}`);
      }
      
      if (!isValid) {
        allValid = false;
        console.error(`[Date Validation Error] Invalid date format in field '${field}': ${value}. Expected ISO 8601 format (YYYY-MM-DD).`);
      }
    }
  }
  
  return allValid;
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

    const formattedDate = format(dateObj, "yyyy-MM-dd");
    
    // Log successful date formatting for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Date Formatting] Successfully formatted date: ${date} -> ${formattedDate}`);
    }
    
    return formattedDate;
  } catch (error) {
    const errorMessage = `Invalid date provided: ${date}`;
    
    // Log error for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error(`[Date Formatting Error] ${errorMessage}`, error);
    }
    
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
