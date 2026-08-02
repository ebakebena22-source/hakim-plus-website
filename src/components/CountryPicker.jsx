import { useState } from "react";
import { countryOptions, countryByCode, resolveCountry } from "../profile/countries";

export default function CountryPicker({ id = "country", label = "Country of residence", value = "", onChange, required = false, disabled = false, error = "" }) {
  const selected = countryByCode(value);
  const [query, setQuery] = useState(selected?.name || "");
  const listId = `${id}-options`;

  function handleChange(event) {
    const nextQuery = event.target.value;
    const option = resolveCountry(nextQuery);
    setQuery(nextQuery);
    onChange?.(option?.code || "");
  }

  return (
    <label className="block text-sm font-semibold text-slate-800" htmlFor={id}>
      {label}
      <input
        id={id}
        list={listId}
        autoComplete="country-name"
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-100"
        value={query}
        onChange={handleChange}
        onBlur={() => { if (!selected) setQuery(""); }}
        placeholder="Search all countries"
        required={required}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : `${id}-currency`}
      />
      <datalist id={listId}>
        {countryOptions.map((country) => <option key={country.code} value={country.name}>{country.code} · {country.currency}</option>)}
      </datalist>
      {selected && <span id={`${id}-currency`} className="mt-2 block text-xs font-medium text-slate-500">Default currency: {selected.currency}</span>}
      {error && <span id={`${id}-error`} className="mt-2 block text-xs font-medium text-red-700">{error}</span>}
    </label>
  );
}
