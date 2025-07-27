/**
 * Generates a custom UUID v4 format string
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * Where x is any hexadecimal digit and y is one of 8, 9, A, or B
 */
export const generateCustomUUID = () => {
    const hexDigits = '0123456789abcdef';
    let uuid = '';
    
    // Generate 8 random hex digits
    for (let i = 0; i < 8; i++) {
        uuid += hexDigits[Math.floor(Math.random() * 16)];
    }
    
    uuid += '-';
    
    // Generate 4 random hex digits
    for (let i = 0; i < 4; i++) {
        uuid += hexDigits[Math.floor(Math.random() * 16)];
    }
    
    uuid += '-';
    
    // Generate 4 random hex digits (version 4)
    uuid += '4';
    for (let i = 0; i < 3; i++) {
        uuid += hexDigits[Math.floor(Math.random() * 16)];
    }
    
    uuid += '-';
    
    // Generate 4 random hex digits (variant)
    uuid += hexDigits[Math.floor(Math.random() * 4) + 8]; // 8, 9, a, or b
    for (let i = 0; i < 3; i++) {
        uuid += hexDigits[Math.floor(Math.random() * 16)];
    }
    
    uuid += '-';
    
    // Generate 12 random hex digits
    for (let i = 0; i < 12; i++) {
        uuid += hexDigits[Math.floor(Math.random() * 16)];
    }
    
    return uuid;
};

/**
 * Alternative implementation using crypto.randomBytes for better randomness
 * (if crypto module is available)
 */
export const generateSecureUUID = () => {
    try {
        const crypto = require('crypto');
        return crypto.randomUUID();
    } catch (error) {
        // Fallback to custom implementation if crypto.randomUUID is not available
        return generateCustomUUID();
    }
}; 