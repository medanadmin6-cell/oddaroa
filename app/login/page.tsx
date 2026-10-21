"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/store";
import { getCountry, normalisePhone } from "@/lib/countries";
import { AuthScreen, CountryBar, PhoneField, PasswordField, PrimaryButton } from "@/components/AuthFields";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/";
  const signIn = useSession((s) => s.signIn);

  const [countryCode, setCountryCode] = useState("GH");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const country = getCountry(countryCode);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password) {
      setError("Enter your number and password");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Send the number in full international form so the server does not have
      // to guess which market a bare local number belongs to.
      const identifier = normalisePhone(phone, countryCode) ?? phone;

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Wrong login details");
        return;
      }
      signIn(json.user);
      router.push(next);
    } catch {
      setError("Network problem. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen title="Login">
      <form onSubmit={submit} className="space-y-5">
        <CountryBar country={country} onChange={setCountryCode} />
        <PhoneField country={country} value={phone} onChange={setPhone} autoFocus />
        <PasswordField value={password} onChange={setPassword} />

        {error && (
          <p className="rounded-xl bg-red-950/60 px-3 py-2.5 text-[13px] text-red-300">{error}</p>
        )}

        <PrimaryButton type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Login"}
        </PrimaryButton>
      </form>

      <div className="mt-5 flex items-center justify-between text-[14px]">
        <Link href="/forgot-password" className="text-zinc-400">
          Forgot Password?
        </Link>
        <Link href="/register" className="font-semibold text-[#ff4d4d]">
          Create an Account
        </Link>
      </div>
    </AuthScreen>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
