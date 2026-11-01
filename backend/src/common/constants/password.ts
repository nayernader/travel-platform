// ACC-01: at least 8 characters, with at least one letter and one digit
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
export const PASSWORD_MESSAGE =
  'Password must be at least 8 characters and include at least one letter and one digit';