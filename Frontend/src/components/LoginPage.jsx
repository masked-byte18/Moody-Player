import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "./AuthPage.css";

const API = "http://localhost:3000";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

function LoginPage({ onAuthSuccess }) {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [emailForOtp, setEmailForOtp] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const googleButtonRef = useRef(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;

    let cancelled = false;

    const renderGoogleButton = () => {
      if (!googleButtonRef.current || !window.google?.accounts?.id) return;

      const containerWidth = Math.max(
        220,
        Math.min(Math.floor(googleButtonRef.current.offsetWidth || 320), 380)
      );

      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        width: containerWidth,
      });
    };

    const initializeGoogle = () => {
      if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            const authResponse = await axios.post(`${API}/auth/google`, {
              idToken: response.credential,
            });

            onAuthSuccess({
              ...authResponse.data.user,
              token: authResponse.data.token || "",
            });
            navigate("/");
          } catch (error) {
            alert(error?.response?.data?.message || "Google sign in failed");
          }
        },
      });

      renderGoogleButton();
      setGoogleReady(true);
    };

    const handleResize = () => {
      if (!cancelled && googleReady) {
        renderGoogleButton();
      }
    };

    window.addEventListener("resize", handleResize);

    if (window.google?.accounts?.id) {
      initializeGoogle();
      return () => {
        cancelled = true;
      };
    }

    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener("load", initializeGoogle, { once: true });
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogle;
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", handleResize);
    };
  }, [googleReady, navigate, onAuthSuccess]);

  const handleLogin = async (event) => {
    event.preventDefault();
    try {
      const response = await axios.post(`${API}/auth/login`, {
        identifier,
        password,
      });
      setEmailForOtp(response.data.email || "");
      setOtpStep(true);
      alert("OTP sent. Check your email (or backend console in dev mode).");
    } catch (error) {
      alert(error?.response?.data?.message || "Login failed");
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    try {
      const response = await axios.post(`${API}/auth/verify-login`, {
        email: emailForOtp,
        otp,
      });
      onAuthSuccess({
        ...response.data.user,
        token: response.data.token || "",
      });
      navigate("/");
    } catch (error) {
      alert(error?.response?.data?.message || "OTP verification failed");
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2>Log In</h2>
        <p>Use username/email + password, then verify OTP.</p>

        {!otpStep ? (
          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              Username or Email
              <input
                type="text"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <button type="submit">Send OTP</button>
            {GOOGLE_CLIENT_ID ? (
              <div className={`google-button-shell ${googleReady ? "is-ready" : ""}`}>
                <div ref={googleButtonRef} className="google-button-slot" />
              </div>
            ) : null}
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleVerifyOtp}>
            <label>
              OTP
              <input
                type="text"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                required
              />
            </label>
            <button type="submit">Verify and Log In</button>
          </form>
        )}

        <p className="auth-hint">
          New here? <Link to="/signup">Create account</Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
