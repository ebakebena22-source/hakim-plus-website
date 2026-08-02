import countries from "world-countries";

function primaryCurrency(country) {
  return Object.keys(country.currencies || {})[0] || "USD";
}

export const countryOptions = countries
  .map((country) => ({
    code: country.cca2,
    name: country.name.common,
    currency: primaryCurrency(country),
  }))
  .sort((left, right) => left.name.localeCompare(right.name));

const countriesByCode = new Map(countryOptions.map((country) => [country.code, country]));
const countriesByName = new Map(countryOptions.map((country) => [country.name.toLocaleLowerCase(), country]));

export function countryByCode(code) {
  return countriesByCode.get(String(code || "").trim().toUpperCase()) || null;
}

export function resolveCountry(value) {
  if (value && typeof value === "object") {
    return countryByCode(value.countryCode || value.code) || resolveCountry(value.countryName || value.name);
  }
  const normalized = String(value || "").trim();
  return countryByCode(normalized) || countriesByName.get(normalized.toLocaleLowerCase()) || null;
}

export function profileCountry(profile = {}) {
  return resolveCountry(profile.countryCode || profile.country || profile.countryName);
}

export function normalizedCountryProfile(input) {
  const country = resolveCountry(input);
  if (!country) return null;
  return {
    countryCode: country.code,
    countryName: country.name,
    country: country.name,
    currency: country.currency,
  };
}
