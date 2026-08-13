import { useState } from "react";
import { supabase } from "../services/supabase";

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgot, setForgot] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(event) {
    event.preventDefault();

    setError("");
    setMessage("");
    setLoading(true);

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (error) throw error;

      onLogin(data.user);
    } catch (error) {
      setError(error.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(event) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);

    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: window.location.origin,
          }
        );

      if (error) throw error;

      setMessage(
        "Password reset link has been sent to your email."
      );
    } catch (error) {
      setError(
        error.message ||
          "Could not send password reset email."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-emerald-50 px-4 dark:from-slate-900 dark:via-slate-950 dark:to-emerald-950">

      <div className="flex min-h-screen items-center justify-center py-10">

        <div className="w-full max-w-md">

          {/* LOGO / BRAND */}
          <div className="mb-6 text-center">

            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 text-3xl shadow-lg shadow-green-500/20">
              🌾
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              धनपुरा किसान सेवा केन्द्र
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Billing & Management System
            </p>

          </div>

          {/* CARD */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 sm:p-8">

            {!forgot ? (
              <>
                {/* LOGIN HEADER */}
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    Welcome back 👋
                  </h2>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Sign in to continue to your dashboard.
                  </p>
                </div>

                <form
                  onSubmit={handleLogin}
                  className="space-y-5"
                >

                  {/* EMAIL */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Email
                    </label>

                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                        ✉️
                      </span>

                      <input
                        type="email"
                        value={email}
                        onChange={(e) =>
                          setEmail(e.target.value)
                        }
                        placeholder="Enter your email"
                        autoComplete="email"
                        required
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800"
                      />
                    </div>
                  </div>

                  {/* PASSWORD */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Password
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          setForgot(true);
                          setError("");
                          setMessage("");
                        }}
                        className="text-sm font-semibold text-green-600 hover:text-green-700 dark:text-green-400"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                        🔒
                      </span>

                      <input
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        value={password}
                        onChange={(e) =>
                          setPassword(e.target.value)
                        }
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        required
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-12 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword(!showPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      >
                        {showPassword ? "🙈" : "👁️"}
                      </button>
                    </div>
                  </div>

                  {/* ERROR */}
                  {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                      ⚠️ {error}
                    </div>
                  )}

                  {/* LOGIN */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 py-3.5 font-semibold text-white shadow-lg shadow-green-500/20 transition hover:from-green-600 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading
                      ? "Signing in..."
                      : "Sign In"}
                  </button>

                </form>
              </>
            ) : (
              <>
                {/* FORGOT PASSWORD */}
                <div className="mb-6 text-center">

                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl dark:bg-green-500/15">
                    🔐
                  </div>

                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    Forgot Password?
                  </h2>

                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Enter your email and we'll send you a
                    password reset link.
                  </p>

                </div>

                <form
                  onSubmit={handleForgotPassword}
                  className="space-y-5"
                >

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Email Address
                    </label>

                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                        ✉️
                      </span>

                      <input
                        type="email"
                        value={email}
                        onChange={(e) =>
                          setEmail(e.target.value)
                        }
                        placeholder="Enter your email"
                        autoComplete="email"
                        required
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* MESSAGE */}
                  {message && (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-400">
                      ✅ {message}
                    </div>
                  )}

                  {/* ERROR */}
                  {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                      ⚠️ {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 py-3.5 font-semibold text-white shadow-lg shadow-green-500/20 transition hover:from-green-600 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading
                      ? "Sending..."
                      : "Send Reset Link"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForgot(false);
                      setError("");
                      setMessage("");
                    }}
                    className="w-full rounded-xl border border-slate-300 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    ← Back to Login
                  </button>

                </form>
              </>
            )}

          </div>

          {/* FOOTER */}
          <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
            Secure billing system · धनपुरा किसान सेवा केन्द्र
          </p>

        </div>
      </div>
    </div>
  );
}

export default Login;