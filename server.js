import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();


// ------------------------------------------------------
// 🔵 ADD THE LOGGING MIDDLEWARE *RIGHT HERE*
// ------------------------------------------------------
app.use((req, res, next) => {
  console.log("INCOMING REQUEST:", req.method, req.url);
  next();
});


// ------------------------------------------------------
// CORS MUST BE BEFORE ANY ROUTES
// Allow both Softr Live + Preview domains
// ------------------------------------------------------
app.use(
  cors({
    origin: [
      "https://groomeconsulting.softr.app",
      "https://groomeconsulting.preview.softr.app"
    ],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

// ------------------------------------------------------
// Load environment variables from Render
// ------------------------------------------------------
const tenantId = process.env.TENANT_ID;
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const groupId = process.env.GROUP_ID;
const reportId = process.env.REPORT_ID;
const datasetId = process.env.DATASET_ID;

// ------------------------------------------------------
// TEST ENDPOINT: Confirms Softr ✔ Render ✔ email passing
// ------------------------------------------------------
app.get("/test-email", (req, res) => {
  res.json({
    status: "ok",
    receivedEmail: req.query.email
  });
});

// ------------------------------------------------------
// MAIN ENDPOINT: Generate Embed Token with RLS
// ------------------------------------------------------
app.get("/embed-token", async (req, res) => {
  try {
    const userEmail = req.query.email;

    if (!userEmail) {
      return res.status(400).json({ error: "Missing ?email= in query string" });
    }

    console.log("Generating token for:", userEmail);

    // 1. Azure AD App Token (Service Principal)
    const tokenRes = await axios.post(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://analysis.windows.net/powerbi/api/.default"
      })
    );

    const accessToken = tokenRes.data.access_token;

    // 2. Power BI Embed Token WITH RLS Identity
    const embedRes = await axios.post(
      `https://api.powerbi.com/v1.0/myorg/groups/${groupId}/reports/${reportId}/GenerateToken`,
      {
        accessLevel: "view",
        identities: [
          {
            username: userEmail,      // <-- Passed from Softr
            roles: ["ClientRLS"],     // <-- Your RLS role name in Power BI
            datasets: [datasetId]     // <-- REQUIRED for RLS to work
          }
        ]
      },
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    res.json({
      embedToken: embedRes.data.token,
      embedUrl: embedRes.data.embedUrl,
      reportId
    });

  } catch (error) {
    console.error("Power BI error:", error.response?.data || error.message);
    res.status(500).json({
      error: "Failed to generate Power BI embed token",
      details: error.response?.data || error.message
    });
  }
});

// ------------------------------------------------------
// Start Server
// ------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Power BI RLS Token Server running on port ${PORT}`);
});
