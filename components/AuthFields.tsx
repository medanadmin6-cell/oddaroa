"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, Eye, EyeOff, Globe, Lock, X } from "lucide-react";
import { allCountries, type CountryConfig } from "@/lib/countries";

/**
 * Login and register, drawn like the dark account form: a floating label on
 * each outlined field, icons inside, and one pill button.
 */

const ink = "#111113";
const field = "#161618";

export function Flag({ code, size = 18 }: { code: string; size?: number }) {
  return (
    <Image
      src={`/flags/${code.toLowerCase()}.svg`}
      alt=""
      width={size}
      height={Math.round((size * 2) / 3)}
      className="shrink-0 rounded-[3px]"
    />
  );
}

export function AuthScreen({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen px-5 py-8" style={{ background: ink, color: "#f4f4f5" }}>
      <div className="mx-auto w-full max-w-[420px]">
        <h1 className="mb-8 text-center text-[26px] font-bold tracking-tight">{title}</h1>
        {children}
      </div>
    </div>
  );
}

function Frame({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative block">
      <span
        className="absolute -top-2 left-3 z-10 px-1 text-[12px] text-zinc-400"
        style={{ background: ink }}
      >
        {label}
      </span>
      <div
        className="flex items-center gap-2.5 rounded-xl border border-zinc-600 px-3 py-3.5"
        style={{ background: field }}
      >
        {children}
      </div>
    </div>
  );
}

const inputClass =
  "min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-zinc-500";

/** Country row as a labelled select. `onClose` is unused; kept for callers. */
export function CountryBar({
  country,
  onChange,
}: {
  country: CountryConfig;
  onChange: (code: string) => void;
  onClose?: () => void;
}) {
  const [picking, setPicking] = useState(false);

  return (
    <div className="relative">
      <button type="button" onClick={() => setPicking((p) => !p)} className="w-full text-left">
        <Frame label="Country">
          <Globe size={18} strokeWidth={1.8} className="shrink-0 text-zinc-400" />
          <Flag code={country.code} size={18} />
          <span className="flex-1 text-[15px]">
            {country.name} (+{country.dialCode})
          </span>
          <ChevronDown size={18} className="shrink-0 text-zinc-400" />
        </Frame>
      </button>
      {picking && (
        <ul
          className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-zinc-600"
          style={{ background: field }}
        >
          {allCountries().map((c) => (
            <li key={c.code}>
              <button
                type="button"
                onClick={() => {
                  onChange(c.code);
                  setPicking(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[14px]"
              >
                <Flag code={c.code} />
                <span className="flex-1">{c.name}</span>
                <span className="text-zinc-400">+{c.dialCode}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PhoneField({
  country,
  value,
  onChange,
  autoFocus,
}: {
  country: CountryConfig;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <Frame label="Mobile Number">
      <Flag code={country.code} size={18} />
      <span className="shrink-0 text-[15px] font-semibold text-[#ff4d4d]">+{country.dialCode}</span>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        autoFocus={autoFocus}
        value={value}
        placeholder="24 123 4567"
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
        className={inputClass}
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear phone number" className="text-zinc-500">
          <X size={16} />
        </button>
      )}
    </Frame>
  );
}

export function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  type = "text",
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  type?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Frame label={label}>
      {icon}
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </Frame>
  );
}

export function PasswordField({
  value,
  onChange,
  autoComplete = "current-password",
  placeholder = "Password",
  label = "Password",
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
  label?: string;
}) {
  const [shown, setShown] = useState(false);

  return (
    <Frame label={label}>
      <Lock size={18} strokeWidth={1.8} className="shrink-0 text-zinc-400" />
      <input
        type={shown ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        className="shrink-0 text-zinc-400"
      >
        {shown ? <Eye size={18} /> : <EyeOff size={18} />}
      </button>
    </Frame>
  );
}

export function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer select-none items-start gap-2.5">
      <span
        className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border border-zinc-500"
        style={{ background: checked ? "#fff" : "transparent" }}
      >
        {checked && <span className="h-2.5 w-2.5 rounded-[2px] bg-[#e10600]" />}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span className="text-[13px] leading-snug text-zinc-300">{label}</span>
    </label>
  );
}

export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="w-full rounded-full bg-[#e10600] py-3.5 text-[16px] font-bold text-white shadow-[0_8px_24px_rgba(225,6,0,0.35)] disabled:cursor-wait disabled:opacity-70"
    >
      {children}
    </button>
  );
}
