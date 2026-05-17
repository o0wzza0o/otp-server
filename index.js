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
      process.env.PUPPETEER_EXECUTABLE_PATH,

    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ]
  }
});

client.on("qr", qr => {
  console.log("Scan QR Code:");
  qrcode.generate(qr, { small: true });
});



client.on("ready", () => {
  console.log("WhatsApp Ready!");
});

client.initialize();

app.post("/send-otp", async (req, res) => {
  try {
    const { phone } = req.body;

    // Strip any non-digit characters (like '+') from the phone number
    let formattedPhone = phone.replace(/\D/g, '');

    // Automatically format Egyptian numbers missing the country code
    if (formattedPhone.startsWith('01') && formattedPhone.length === 11) {
      formattedPhone = '20' + formattedPhone.substring(1);
    }

    console.log(`[DEBUG] Attempting to send OTP to WhatsApp ID: ${formattedPhone}@c.us`);

    if (!formattedPhone) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number."
      });
    }

    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    otpStore[formattedPhone] = otp;

    let isRegistered = false;
    try {
      // isRegisteredUser requires the full ID with @c.us
      isRegistered = await client.isRegisteredUser(`${formattedPhone}@c.us`);
    } catch (error) {
      console.log("Validation error (t: t):", error.message);
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format or unsupported number."
      });
    }

    if (!isRegistered) {
      return res.status(400).json({
        success: false,
        message: "Phone number is not registered on WhatsApp."
      });
    }

    await client.sendMessage(
      `${formattedPhone}@c.us`,
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

  let formattedPhone = phone.replace(/\D/g, '');

  if (formattedPhone.startsWith('01') && formattedPhone.length === 11) {
    formattedPhone = '20' + formattedPhone.substring(1);
  }

  if (otpStore[formattedPhone] === otp) {

    delete otpStore[formattedPhone];

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});


app.get("/", (req, res) => {
  res.send("Server Working");
});
