import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "./AuthPage.css";

const API = "http://localhost:3000";

function SignupPage({ onAuthSuccess }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState(false);

  const handleSignup = async (event) => {
    event.preventDefault();
    try {
      await axios.post(`${API}/auth/signup`, {
        username,
        displayName,
        email,
        password,
      });
      setOtpStep(true);
      alert("Signup OTP sent. Check your email (or backend console in dev mode).");
    } catch (error) {
      alert(error?.response?.data?.message || "Signup failed");
    }
  };

  const handleVerifySignup = async (event) => {
    event.preventDefault();
    try {
      const response = await axios.post(`${API}/auth/verify-signup`, {
        email,
        otp,
      });
      onAuthSuccess(response.data.user);
      navigate("/");
    } catch (error) {
      alert(error?.response?.data?.message || "Signup verification failed");
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2>Sign Up</h2>
        <p>Create account with username, email and password, then verify OTP.</p>

        {!otpStep ? (
          <form className="auth-form" onSubmit={handleSignup}>
            <label>
              Username
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </label>
            <label>
              Name
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleVerifySignup}>
            <label>
              OTP
              <input
                type="text"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                required
              />
            </label>
            <button type="submit">Verify and Sign Up</button>
          </form>
        )}

        <p className="auth-hint">
          Already have an account? <Link to="/login">Go to login</Link>
        </p>
      </div>
    </div>
  );
}

export default SignupPage;
