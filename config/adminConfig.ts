// Admin Configuration
// Add admin emails here to grant admin access

export const ADMIN_CONFIG = {
  // List of whitelisted admin emails
  whitelistedEmails: [
    'qsmceoglvn@gmail.com',
    // Add more admin emails here as needed
  ],
  
  // Check if an email is an admin
  isAdmin: (email: string): boolean => {
    if (!email) return false;
    
    const emailLower = email.toLowerCase();
    
    // Check if email contains 'admin'
    if (emailLower.includes('admin')) {
      return true;
    }
    
    // Check against whitelist
    return ADMIN_CONFIG.whitelistedEmails.some(
      adminEmail => adminEmail.toLowerCase() === emailLower
    );
  }
};
