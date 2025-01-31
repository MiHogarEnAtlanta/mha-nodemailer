const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const nodemailer = require("nodemailer");
require("dotenv").config();

const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cors());

app.post("/email", cors({ origin: "*" }), async (req, res) => {
  let { name, email, tel, message, subject } = req.body;

  const transport = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_FROM,
      pass: process.env.EMAIL_PASS,
    },
  });

  transport.verify(function (error, success) {
    if (error) {
      console.log(error);
    } else {
      console.log(success);
      console.log("Server is ready to take our messages");
    }
  });

  transport.sendMail(
    {
      from: `crivas@i-nimble.com`,
      to: `mihogarenatlanta@gmail.com`,
      subject: `Website Contact Form: ${name}`,
      text: `Nombre: ${name} \n Telefono: ${tel} \n Correo: ${email} \n Mensaje: ${message}`,
    },
    (error, info) => {
      if (error) {
        console.log(error);
        res.send("error");
      } else {
        console.log("Email sent: " + info.response);
        res.send("success");
      }
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
