"use strict";

class FieldNormalizer {
  /**
   * Normalize phone numbers to a standard format
   */
  static normalizePhone(phone) {
    if (!phone) return null;

    // Remove all non-digit characters except +
    let normalized = phone.toString().replace(/[^\d\+]/g, '');

    // Add + if it starts with a country code
    if (normalized.length > 10 && !normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }
    return normalized;
  }

  /**
   * Normalize email addresses
   */
  static normalizeEmail(email) {
    if (!email) return null;
    return email.toString().toLowerCase().trim();
  }

  /**
   * Normalize dates to ISO format
   */
  static normalizeDate(date) {
    if (!date) return null;
    try {
      const parsed = new Date(date);
      if (isNaN(parsed.getTime())) return null;
      return parsed.toISOString().split('T')[0]; // YYYY-MM-DD format
    } catch {
      return null;
    }
  }

  /**
   * Normalize URLs
   */
  static normalizeURL(url) {
    if (!url) return null;
    let normalized = url.toString().trim();

    // Add https:// if no protocol specified
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = 'https://' + normalized;
    }
    try {
      const urlObj = new URL(normalized);
      return urlObj.href;
    } catch {
      return null;
    }
  }

  /**
   * Normalize names (capitalize first letters)
   */
  static normalizeName(name) {
    if (!name) return null;
    return name.toString().trim().split(' ').map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ');
  }

  /**
   * Normalize skills array
   */
  static normalizeSkills(skills) {
    if (!skills) return [];
    const skillsArray = Array.isArray(skills) ? skills : [skills];
    return skillsArray.map(skill => skill.toString().trim()).filter(skill => skill.length > 0).map(skill => skill.charAt(0).toUpperCase() + skill.slice(1));
  }

  /**
   * Extract and normalize duration from dates
   */
  static calculateDuration(startDate, endDate) {
    if (!startDate) return null;
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    const diffTime = Math.abs(end - start);
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44)); // Average month length

    const years = Math.floor(diffMonths / 12);
    const months = diffMonths % 12;
    if (years > 0 && months > 0) {
      return `${years} year${years > 1 ? 's' : ''} ${months} month${months > 1 ? 's' : ''}`;
    } else if (years > 0) {
      return `${years} year${years > 1 ? 's' : ''}`;
    } else {
      return `${months} month${months > 1 ? 's' : ''}`;
    }
  }
}
module.exports = FieldNormalizer;