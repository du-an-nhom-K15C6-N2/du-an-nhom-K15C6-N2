function normalizePhone(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('0084')) return `0${digits.slice(4)}`;
  if (digits.startsWith('84')) return `0${digits.slice(2)}`;
  return digits;
}

module.exports = { normalizePhone };
