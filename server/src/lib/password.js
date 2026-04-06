const PASSWORD_RULE_HINT = 'La contrasena debe tener al menos 8 caracteres, incluir una mayuscula, una minuscula y un numero.';

function getPasswordStrengthError(password, { required = true } = {}) {
  if (!password) {
    return required ? 'La contrasena es obligatoria.' : null;
  }

  if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    return PASSWORD_RULE_HINT;
  }

  return null;
}

function assertStrongPassword(password, options) {
  const errorMessage = getPasswordStrengthError(password, options);
  if (!errorMessage) return;

  const error = new Error(errorMessage);
  error.status = 400;
  error.code = password ? 'WEAK_PASSWORD' : 'PASSWORD_REQUIRED';
  throw error;
}

module.exports = {
  PASSWORD_RULE_HINT,
  getPasswordStrengthError,
  assertStrongPassword,
};