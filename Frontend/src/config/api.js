// Central API base URL configuration
// Uses the Render URL when built for production, and localhost for local development
const API = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://moody-player-1pva.onrender.com" : "http://localhost:3000");

export default API;
