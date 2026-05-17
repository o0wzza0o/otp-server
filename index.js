
const express = require("express");
const cors = require("cors");
const QRCode = require("qrcode");

const {
  Client,
  LocalAuth
} = require("whatsapp-web.js");

const app = express();

app.use(cors());
app.use(express.json());

const otpStore = {};

let latestQr = null;

const client = new Client({
  authStrategy: new LocalAuth(),

  puppeteer: {
    headless: true,
    executablePath:
      process.env.PUPPETEER_EXECUTABLE_PATH,

    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ]
  }
});

client.on("qr", async (qr) => {

  console.log("QR Generated!");

  latestQr = await QRCode.toDataURL(qr);
});

client.on("ready", () => {
  console.log("WhatsApp Ready!");
});

client.on("authenticated", () => {
  console.log("WhatsApp Authenticated!");
});

client.on("auth_failure", (msg) => {
  console.log("Auth Failure:", msg);
});

client.on("disconnected", (reason) => {
  console.log("WhatsApp Disconnected:", reason);
});

client.initialize();

app.get("/", (req, res) => {
  res.send("Server Working");
});

app.get("/qr", (req, res) => {

  if (!latestQr) {
    return res.send("QR not generated yet");
  }

  res.send(`
    <html>
      <body style="
        background:#000;
        display:flex;
        justify-content:center;
        align-items:center;
        height:100vh;
        margin:0;
      ">
        <img src="${latestQr}" />
      </body>
    </html>
  `);
});

app.post("/send-otp", async (req, res) => {

  try {

    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number required"
      });
    }

    let formattedPhone =
      phone.replace(/\D/g, '');

    if (
      formattedPhone.startsWith('01') &&
      formattedPhone.length === 11
    ) {
      formattedPhone =
        '20' + formattedPhone.substring(1);
    }

    const whatsappId =
      `${formattedPhone}@c.us`;

    console.log(
      `[DEBUG] Sending OTP to ${whatsappId}`
    );

    let isRegistered = false;

    try {

      isRegistered =
        await client.isRegisteredUser(
          whatsappId
        );

    } catch (error) {

      console.log(
        "Validation Error:",
        error.message
      );

      return res.status(400).json({
        success: false,
        message:
          "Invalid phone number format"
      });
    }

    if (!isRegistered) {

      return res.status(400).json({
        success: false,
        message:
          "Phone number is not registered on WhatsApp."
      });
    }

    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    otpStore[formattedPhone] = otp;

    await client.sendMessage(
      whatsappId,
      `Your OTP code is: ${otp}`
    );

    res.json({
      success: true,
      message: "OTP sent successfully"
    });

  } catch (err) {

    console.log(
      "SEND OTP ERROR:",
      err
    );

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.post("/verify-otp", (req, res) => {

  try {

    const { phone, otp } = req.body;

    let formattedPhone =
      phone.replace(/\D/g, '');

    if (
      formattedPhone.startsWith('01') &&
      formattedPhone.length === 11
    ) {
      formattedPhone =
        '20' + formattedPhone.substring(1);
    }

    if (
      otpStore[formattedPhone] === otp
    ) {

      delete otpStore[formattedPhone];

      return res.json({
        success: true,
        message: "Login Success"
      });
    }

    res.status(400).json({
      success: false,
      message: "Invalid OTP"
    });

  } catch (err) {

    console.log(
      "VERIFY OTP ERROR:",
      err
    );

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

const PORT =
  process.env.PORT || 3000;

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Server running on port ${PORT}`
    );
  }
);
