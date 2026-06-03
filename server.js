const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const { ConfidentialClientApplication } = require("@azure/msal-node");
require("dotenv").config();

const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cors());

// MSAL: client credentials flow (app-only, sin login de usuario)
const cca = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
    clientSecret: process.env.CLIENT_SECRET,
  },
});

async function getAccessToken() {
  const result = await cca.acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  });
  return result.accessToken;
}

app.post("/email", cors({ origin: "*" }), async (req, res) => {
  const { name, email, tel, message } = req.body;

  try {
    const token = await getAccessToken();
    const sender = process.env.SENDER_EMAIL;

    const toRecipients = process.env.RECIPIENT_EMAIL.split(",")
      .map((addr) => addr.trim())
      .filter(Boolean)
      .map((addr) => ({ emailAddress: { address: addr } }));

    const payload = {
      message: {
        subject: `Website Contact Form: ${name}`,
        body: {
          contentType: "Text",
          content: `Nombre: ${name}\nTelefono: ${tel}\nCorreo: ${email}\nMensaje: ${message}`,
        },
        toRecipients,
        replyTo: [{ emailAddress: { address: email } }],
      },
      saveToSentItems: true,
    };

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${sender}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (response.ok) {
      console.log("Email sent via Microsoft Graph");
      res.send("success");
    } else {
      const errText = await response.text();
      console.error("Graph error:", response.status, errText);
      res.status(500).send("error");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("error");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
