function normalizeCode(str = "", len = 3) {
  return String(str)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, len)
    .padEnd(len, "X");
}

// Example: FON-MOB-APL-000123
function buildSku({ categoryCode, brandCode, serial }) {
  const cat = normalizeCode(categoryCode, 3);
  const br = normalizeCode(brandCode, 3);
  const num = String(serial).padStart(6, "0");
  return `FON-${cat}-${br}-${num}`;
}

module.exports = { buildSku };