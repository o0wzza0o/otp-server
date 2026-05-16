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
  authStrategy: new LocalAuth()
});

client.on("qr", qr => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("WhatsApp Ready!");
});

client.initialize();

app.post("/send-otp", async (req, res) => {
  try {
    const { phone } = req.body;

    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    otpStore[phone] = otp;

    await client.sendMessage(
      `${phone}@c.us`,
      `Your OTP code is: ${otp}`
    );

    res.json({
      success: true,
      otp
    });

  } catch (err) {
    console.log(err);

    res.json({
      success: false
    });
  }
});

app.post("/verify-otp", (req, res) => {
  const { phone, otp } = req.body;

  if (otpStore[phone] === otp) {

    delete otpStore[phone];

    return res.json({
      success: true,
      message: "Login Success"
    });
  }

  res.json({
    success: false,
    message: "Invalid OTP"
  });
});

app.listen(3000, () => {
  console.log("Server running...");
});