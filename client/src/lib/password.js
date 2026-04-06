export const PASSWORD_RULE_HINT = 'Minimo 8 caracteres, con mayuscula, minuscula y numero.';

export function getPasswordStrengthError(password, { required = false } = {}) {
  if (!password) {
    return required ? 'La contrasena es obligatoria.' : '';
  }

  if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    return PASSWORD_RULE_HINT;
  }

  return '';
}