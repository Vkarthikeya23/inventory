import bcrypt from 'bcrypt';

const password = 'password';
const saltRounds = 10;

bcrypt.hash(password, saltRounds).then(hash => {
  console.log('Password: password');
  console.log('Hash:', hash);
});
