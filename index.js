
const express = require("express");
const cors = require("cors");
const qrcode = require("qrcode-terminal");

const {
  Client,
  LocalAuth
} = require("whatsapp-web.js");

const app = express();

app.use(cors());
app.use(express.json());

const otpStore = {};

const client = new Client({
  authStrategy: new LocalAuth(),

  puppeteer: {
    headless: true,
    executablePath:
      process.env.PUPPETEER_EXECUTABLE_PATH || undefined,

    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu"
    ]
  },

  webVersionCache: {
    type: "remote",
    remotePath:
      "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
  }
});

client.on("qr", qr => {
  console.log("Scan QR Code:");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  console.log("WhatsApp Authenticated!");
});

client.on("ready", () => {
  console.log("WhatsApp Ready!");
});

client.on("auth_failure", msg => {
  console.log("Auth Failure:", msg);
});

client.on("disconnected", reason => {
  console.log("WhatsApp Disconnected:", reason);
});

client.initialize();

app.get("/", (req, res) => {
  res.send("OTP Server Working 🔥");
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

    let formattedPhone = phone.replace(/\D/g, '');

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

    const isRegistered =
      await client.isRegisteredUser(whatsappId);

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

    console.log("SEND OTP ERROR:", err);

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

    console.log("VERIFY OTP ERROR:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
