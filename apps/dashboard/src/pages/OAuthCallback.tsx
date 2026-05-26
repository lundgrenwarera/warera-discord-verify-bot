import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/Button";
import { Panel } from "../components/Panel";
import { completeLogin } from "../lib/auth";

export function OAuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    const err = params.get("error");
    if (err) { setError(`Discord refused: ${err}`); return; }
    if (!code || !state) { setError("missing code or state"); return; }
    completeLogin(code, state)
      .then(() => navigate("/servers", { replace: true }))
      .catch((e) => setError(String(e?.message ?? e)));
  }, [params, navigate]);

  return (
    <section className="mx-auto w-full max-w-xl px-4 py-12 sm:py-20">
      <div className="text-center">
        <div className="label">Authentication</div>
        <h1 className="mt-2 bracket-heading text-2xl sm:text-3xl text-text">
          {error ? "Sign-in failed" : "Signing in"}
        </h1>
      </div>

      {error && (
        <div className="mt-8">
          <Panel>
            <div className="label text-loss">Error</div>
            <p className="mt-2 text-sm text-text">{error}</p>
            <Button onClick={() => navigate("/")} variant="ghost" className="mt-4">
              ← Back to start
            </Button>
          </Panel>
        </div>
      )}
    </section>
  );
}
