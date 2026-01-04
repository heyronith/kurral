/**
 * Converts Firebase error codes to user-friendly messages
 */
export const getErrorMessage = (error: any): string => {
  if (!error) {
    return 'An unexpected error occurred. Please try again.';
  }

  // Handle Firebase Auth errors
  const code = error?.code || error?.message?.toLowerCase() || '';

  // Invalid credentials
  if (
    code.includes('auth/invalid-credential') ||
    code.includes('auth/wrong-password') ||
    code.includes('auth/user-not-found') ||
    code.includes('invalid credential')
  ) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }

  // Email already in use
  if (
    code.includes('auth/email-already-in-use') ||
    code.includes('email-already-in-use')
  ) {
    return 'This email is already registered. Please sign in or use a different email.';
  }

  // Weak password
  if (
    code.includes('auth/weak-password') ||
    code.includes('weak-password')
  ) {
    return 'Password is too weak. Please use at least 6 characters.';
  }

  // Invalid email
  if (
    code.includes('auth/invalid-email') ||
    code.includes('invalid-email')
  ) {
    return 'Please enter a valid email address.';
  }

  // Too many requests
  if (
    code.includes('auth/too-many-requests') ||
    code.includes('too-many-requests')
  ) {
    return 'Too many failed attempts. Please try again later.';
  }

  // Network errors
  if (
    code.includes('network') ||
    code.includes('network-request-failed') ||
    code.includes('auth/network-request-failed')
  ) {
    return 'Network error. Please check your connection and try again.';
  }

  // User disabled
  if (
    code.includes('auth/user-disabled') ||
    code.includes('user-disabled')
  ) {
    return 'This account has been disabled. Please contact support.';
  }

  // Handle already exists
  if (code.includes('handle') && code.includes('exists')) {
    return 'This handle is already taken. Please choose a different one.';
  }

  // Default: try to extract a meaningful message
  if (error?.message) {
    // Clean up Firebase error messages
    const message = error.message
      .replace(/^Firebase: /, '')
      .replace(/\(auth\/[^)]+\)/, '')
      .trim();
    
    if (message) {
      return message;
    }
  }

  return 'An error occurred. Please try again.';
};

