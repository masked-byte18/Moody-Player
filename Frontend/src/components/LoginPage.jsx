import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "./AuthPage.css";

const API = "http://localhost:3000";

function LoginPage({ onAuthSuccess }) {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [emailForOtp, setEmailForOtp] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState(false);

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
      onAuthSuccess(response.data.user);
      navigate("/");
    } catch (error) {
      alert(error?.response?.data?.message || "OTP verification failed");
    }
  };

  const handleGoogleSignIn = async () => {
    const email = window.prompt("Google email");
    if (!email) return;
    const displayName = window.prompt("Google display name") || "Google User";

    try {
      const response = await axios.post(`${API}/auth/google`, { email, displayName });
      onAuthSuccess(response.data.user);
      navigate("/");
    } catch (error) {
      alert(error?.response?.data?.message || "Google sign in failed");
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
            <button type="button" className="auth-google-btn" onClick={handleGoogleSignIn}>
              Sign in with Google
            </button>
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
