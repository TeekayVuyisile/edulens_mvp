// Generate random password
export const generatePassword = () => {
  const length = 10;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  
  return password;
};

// Format date to readable string
export const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Calculate percentage
export const calculatePercentage = (obtained, total) => {
  if (!total || total === 0) return 0;
  return Math.round((obtained / total) * 100);
};

// Determine grade letter based on percentage
export const getGradeLetter = (percentage) => {
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
};

// Validate email
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Truncate text with ellipsis
export const truncateText = (text, maxLength = 100) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// Get current academic year
export const getCurrentAcademicYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 = January
  
  // If month is before July, it's still previous academic year
  return month < 6 ? year - 1 : year;
};

// Convert term number to term name
export const getTermName = (termNumber) => {
  const terms = {
    '1': 'Term 1',
    '2': 'Term 2',
    '3': 'Term 3',
    '4': 'Term 4'
  };
  return terms[termNumber] || `Term ${termNumber}`;
};

// Generate school code
export const generateSchoolCode = (schoolName) => {
  const prefix = schoolName.substring(0, 3).toUpperCase();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${random}`;
};