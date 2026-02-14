// PII detection regex patterns and validation functions

export type PiiType = 'email' | 'phone' | 'ip' | 'credit_card';

export interface PiiMatch {
  type: PiiType;
  text: string;
  startIndex: number;
  endIndex: number;
}

// Email pattern - matches common email formats
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Phone patterns - matches various formats
const PHONE_PATTERNS = [
  /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, // US/Canada: (555) 123-4567, 555-123-4567, +1-555-123-4567
  /\d{3}[-.\s]\d{4}/g, // Short format: 555-1234
];

// IPv4 pattern
const IPV4_PATTERN = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;

// IPv6 pattern (simplified - matches most common formats)
const IPV6_PATTERN = /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b|\b(?:[0-9a-fA-F]{1,4}:){1,7}:\b|\b::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}\b/g;

// Credit card pattern - matches 13-19 digit cards with optional spaces/dashes
const CREDIT_CARD_PATTERN = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}(?:[-\s]?\d{3})?\b/g;

/**
 * Luhn algorithm to validate credit card numbers
 * https://en.wikipedia.org/wiki/Luhn_algorithm
 */
function validateLuhn(cardNumber: string): boolean {
  // Remove all non-digit characters
  const digits = cardNumber.replace(/\D/g, '');

  // Must be between 13-19 digits
  if (digits.length < 13 || digits.length > 19) {
    return false;
  }

  let sum = 0;
  let isEven = false;

  // Loop through values from right to left
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Find all email addresses in text
 */
export function findEmails(text: string): PiiMatch[] {
  const matches: PiiMatch[] = [];
  const regex = new RegExp(EMAIL_PATTERN);
  let match;

  while ((match = regex.exec(text)) !== null) {
    matches.push({
      type: 'email',
      text: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return matches;
}

/**
 * Find all phone numbers in text
 */
export function findPhones(text: string): PiiMatch[] {
  const matches: PiiMatch[] = [];

  for (const pattern of PHONE_PATTERNS) {
    const regex = new RegExp(pattern);
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Filter out obvious false positives (e.g., dates, sequential numbers)
      const digits = match[0].replace(/\D/g, '');

      // Skip if it's a simple sequence (e.g., 1234567890)
      const isSequential = /^(0123456789|1234567890|9876543210)$/.test(digits);
      if (isSequential) {
        continue;
      }

      matches.push({
        type: 'phone',
        text: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }
  }

  // Remove duplicates (overlapping matches)
  return deduplicateMatches(matches);
}

/**
 * Find all IP addresses in text (IPv4 and IPv6)
 */
export function findIpAddresses(text: string): PiiMatch[] {
  const matches: PiiMatch[] = [];

  // Find IPv4 addresses
  const ipv4Regex = new RegExp(IPV4_PATTERN);
  let match;

  while ((match = ipv4Regex.exec(text)) !== null) {
    // Validate that each octet is <= 255
    const octets = match[0].split('.').map(Number);
    const isValid = octets.every(octet => octet >= 0 && octet <= 255);

    if (isValid) {
      matches.push({
        type: 'ip',
        text: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }
  }

  // Find IPv6 addresses
  const ipv6Regex = new RegExp(IPV6_PATTERN);
  while ((match = ipv6Regex.exec(text)) !== null) {
    matches.push({
      type: 'ip',
      text: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return matches;
}

/**
 * Find all credit card numbers in text (with Luhn validation)
 */
export function findCreditCards(text: string): PiiMatch[] {
  const matches: PiiMatch[] = [];
  const regex = new RegExp(CREDIT_CARD_PATTERN);
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Validate with Luhn algorithm
    if (validateLuhn(match[0])) {
      matches.push({
        type: 'credit_card',
        text: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }
  }

  return matches;
}

/**
 * Find all PII in text
 */
export function findAllPii(text: string): PiiMatch[] {
  const allMatches = [
    ...findEmails(text),
    ...findPhones(text),
    ...findIpAddresses(text),
    ...findCreditCards(text),
  ];

  // Sort by start index
  return allMatches.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * Remove duplicate/overlapping matches
 */
function deduplicateMatches(matches: PiiMatch[]): PiiMatch[] {
  if (matches.length === 0) return matches;

  // Sort by start index
  const sorted = [...matches].sort((a, b) => a.startIndex - b.startIndex);
  const deduplicated: PiiMatch[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = deduplicated[deduplicated.length - 1];

    // Check if overlapping
    if (current.startIndex >= last.endIndex) {
      deduplicated.push(current);
    }
  }

  return deduplicated;
}
