import { useNavigate } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import { supabase } from "@/lib/supabase/client";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [success, setSuccess] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");

    if (password().length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password() !== confirmPassword()) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);

    // Update the user's password
    const { error: updateError } = await supabase.auth.updateUser({
      password: password(),
    });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      // Redirect to home after 2 seconds
      setTimeout(() => {
        navigate("/");
      }, 2000);
    }
  };

  return (
    <div class="min-h-screen flex items-center justify-center bg-slate-900">
      <div class="w-full max-w-md px-6">
        <div class="bg-slate-800 rounded-lg shadow-xl p-8">
          <h1 class="text-2xl font-bold text-white mb-2">Reset Password</h1>
          <p class="text-slate-400 mb-6">Enter your new password below</p>

          <Show
            when={!success()}
            fallback={
              <div class="text-center py-8">
                <div class="text-green-500 text-5xl mb-4">✓</div>
                <p class="text-green-400 font-medium mb-2">
                  Password updated successfully!
                </p>
                <p class="text-slate-400 text-sm">Redirecting to home...</p>
              </div>
            }
          >
            <form onSubmit={handleSubmit} class="space-y-4">
              <div>
                <label
                  for="password"
                  class="block text-sm font-medium text-slate-300 mb-2"
                >
                  New Password
                </label>
                <input
                  id="password"
                  type="password"
                  autocomplete="new-password"
                  placeholder="Enter new password"
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label
                  for="confirmPassword"
                  class="block text-sm font-medium text-slate-300 mb-2"
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autocomplete="new-password"
                  placeholder="Confirm new password"
                  value={confirmPassword()}
                  onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                  class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  minLength={6}
                />
              </div>

              <Show when={error()}>
                <div class="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error()}
                </div>
              </Show>

              <button
                type="submit"
                disabled={loading()}
                class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {loading() ? "Updating..." : "Update Password"}
              </button>
            </form>
          </Show>
        </div>
      </div>
    </div>
  );
}
