const PASSWORD_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function generatePassword(length = 8) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += PASSWORD_CHARS[values[i] % PASSWORD_CHARS.length];
  }
  return pass;
}
