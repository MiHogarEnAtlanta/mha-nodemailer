const { ConfidentialClientApplication } = require("@azure/msal-node");

// MSAL: client credentials flow (app-only, sin login de usuario).
// Se crea a nivel de módulo para reutilizarse entre invocaciones "calientes".
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

// Headers CORS para que la web (en Hostinger) pueda llamar a la función desde el navegador.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  // Preflight CORS
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: "Method Not Allowed",
    };
  }

  // Parseo defensivo: si el cuerpo no es JSON valido, respondemos 400 claro.
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (err) {
    return { statusCode: 400, headers: corsHeaders, body: "invalid JSON" };
  }

  try {
    const { name, email, tel, message, consent } = body;

    // Acepta boolean real (true) o string ("true") por si el form lo envia distinto.
    const wantsMarketing = consent === true || consent === "true";

    const token = await getAccessToken();
    const sender = process.env.SENDER_EMAIL;

    const toRecipients = process.env.RECIPIENT_EMAIL.split(",")
      .map((addr) => addr.trim())
      .filter(Boolean)
      .map((addr) => ({ emailAddress: { address: addr } }));

    const mailMessage = {
      subject: `Website Contact Form: ${name}`,
      body: {
        contentType: "Text",
        content: `Nombre: ${name}\nTelefono: ${tel}\nCorreo: ${email}\nMensaje: ${message}\nAcepta marketing: ${wantsMarketing ? "Si" : "No"}`,
      },
      toRecipients,
    };

    // Graph rechaza replyTo sin direccion, asi que solo lo agregamos si llego un email.
    if (email && email.trim()) {
      mailMessage.replyTo = [{ emailAddress: { address: email.trim() } }];
    }

    const payload = { message: mailMessage, saveToSentItems: true };

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${sender}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (response.ok) {
      console.log("Email sent via Microsoft Graph");
      return { statusCode: 200, headers: corsHeaders, body: "success" };
    }

    const errText = await response.text();
    console.error("Graph error:", response.status, errText);
    return { statusCode: 500, headers: corsHeaders, body: "error" };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers: corsHeaders, body: "error" };
  }
};
