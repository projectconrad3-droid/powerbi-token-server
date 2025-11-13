import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors()); // allow Softr to call this API

// Load from Render environment variables
const tenantId = process.env.TENANT_ID;
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const groupId = process.env.GROUP_ID;
const reportId = process.env.REPORT_ID;
const datasetId = process.env.DATASET_ID;   // <-- IMPORTANT for RLS

app.get("/embed-token", async (req, res) => {
  try {
    const userEmail = req.query.email;

    if (!userEmail) {
      return res.status(400).json({ error: "Missing ?email= parameter" });
    }

    // 1. Azure AD token
    const tokenRes = await axios.post(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://analysis.windows.net/powerbi/api/.default",
      })
    );

    const accessToken = tokenRes.data.access_token;

    // 2. Generate embed token WITH RLS
    const embedRes = await axios.post(
      `https://api.powerbi.com/v1.0/myorg/groups/${groupId}/reports/${reportId}/GenerateToken`,
      {
        accessLevel: "view",
        identities: [
          {
            username: userEmail,     // the Softr user
            roles: ["ClientRLS"],    // your Power BI RLS role name
            datasets: [datasetId]
          }
        ]
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    res.json({
      embedToken: embedRes.data.token,
      embedUrl: embedRes.data.embedUrl,
      reportId
    });
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

