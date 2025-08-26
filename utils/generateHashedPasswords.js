import bcrypt from 'bcryptjs';

// Utility script to generate bcrypt hashed passwords
// Run this script to generate hashed passwords for admin users

const passwords = [
  'superadmin123',
  'admin123', 
  'staff123',
  'helper123'
];

console.log('Generating bcrypt hashed passwords...\n');

passwords.forEach(password => {
  const hashedPassword = bcrypt.hashSync(password, 10);
  console.log(`Password: ${password}`);
  console.log(`Hashed: ${hashedPassword}\n`);
});

console.log('Copy these hashed passwords to use in your database or for testing.');
console.log('Note: In production, always use bcrypt.hash() with async/await for better security.');
