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

let isClientReady = false;

let isInitializing = false;

const client = new Client({

  authStrategy: new LocalAuth({

    clientId: "otp-server-session",

    dataPath: "./sessions"

  }),

  puppeteer: {

    headless: "new",

    executablePath:
      process.env.PUPPETEER_EXECUTABLE_PATH,

    protocolTimeout: 120000,

    ignoreHTTPSErrors: true,

    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
      "--no-zygote",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-features=site-per-process",
      "--disable-web-security",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars"
    ]
  }
});

async function initializeWhatsApp() {

  if (
    isInitializing ||
    isClientReady
  ) {
    return;
  }

  try {

    isInitializing = true;

    console.log(
      "Initializing WhatsApp..."
    );

    await client.initialize();

  } catch (e) {

    console.log(
      "Initialize Error:"
    );

    console.log(e);

  } finally {

    isInitializing = false;
  }
}

client.on("qr", async (qr) => {

  console.log("QR Generated!");

  latestQr =
    await QRCode.toDataURL(qr);
});

client.on("ready", () => {

  isClientReady = true;

  console.log("WhatsApp Ready!");
});

client.on("authenticated", () => {

  console.log(
    "WhatsApp Authenticated!"
  );
});

client.on("auth_failure", (msg) => {

  isClientReady = false;

  console.log(
    "Auth Failure:",
    msg
  );
});

client.on("disconnected", (reason) => {

  isClientReady = false;

  console.log(
    "WhatsApp Disconnected:",
    reason
  );
});

client.on("message_ack", (msg, ack) => {

  console.log(
    "Message ACK:",
    ack
  );
});

setInterval(async () => {

  try {

    await client.getState();

  } catch (e) {

    console.log(
      "Reinitializing client..."
    );

    isClientReady = false;

    initializeWhatsApp();
  }

}, 30000);

app.get("/", (req, res) => {

  res.send("Server Working");
});

app.get("/qr", (req, res) => {

  if (!latestQr) {

    return res.send(
      "QR not generated yet"
    );
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

        <img
          src="${latestQr}"
          style="
            width:350px;
            background:white;
            padding:20px;
            border-radius:20px;
          "
        />

      </body>

    </html>
  `);
});

app.post(
  "/send-otp",

  async (req, res) => {

    try {

      if (!isClientReady) {

        return res
          .status(503)
          .json({

            success: false,

            message:
              "WhatsApp client is not ready yet"
          });
      }

      const { phone } = req.body;

      if (!phone) {

        return res
          .status(400)
          .json({

            success: false,

            message:
              "Phone number required"
          });
      }

      let formattedPhone =
        phone.replace(/\D/g, '');

      if (
        formattedPhone.startsWith(
          "01"
        ) &&
        formattedPhone.length === 11
      ) {

        formattedPhone =
          "20" +
          formattedPhone.substring(1);
      }

      const whatsappId =
        `${formattedPhone}@c.us`;

      console.log(
        `[DEBUG] Sending OTP to ${whatsappId}`
      );

      const otp = Math.floor(
        100000 +
        Math.random() * 900000
      ).toString();

      otpStore[
        formattedPhone
      ] = otp;

      const sendResult =
        await Promise.race([

          client.sendMessage(
            whatsappId,
            `Your OTP code is: ${otp}`
          ),

          new Promise(
            (_, reject) =>

              setTimeout(() =>

                reject(
                  new Error(
                    "Send timeout"
                  )
                ),

                90000
              )
          )
        ]);

      console.log(
        `[SUCCESS] OTP SENT TO ${whatsappId}`
      );

      console.log(sendResult);

      return res.json({

        success: true,

        message:
          "OTP sent successfully"
      });

    } catch (err) {

      console.log(
        "SEND OTP ERROR:"
      );

      console.log(err);

      isClientReady = false;

      return res
        .status(500)
        .json({

          success: false,

          error: err.message
        });
    }
  }
);

app.post(
  "/verify-otp",

  (req, res) => {

    try {

      const { phone, otp } =
        req.body;

      if (!phone || !otp) {

        return res
          .status(400)
          .json({

            success: false,

            message:
              "Phone and OTP required"
          });
      }

      let formattedPhone =
        phone.replace(/\D/g, '');

      if (
        formattedPhone.startsWith(
          "01"
        ) &&
        formattedPhone.length === 11
      ) {

        formattedPhone =
          "20" +
          formattedPhone.substring(1);
      }

      if (
        otpStore[
          formattedPhone
        ] === otp
      ) {

        delete otpStore[
          formattedPhone
        ];

        return res.json({

          success: true,

          message:
            "Login Success"
        });
      }

      return res
        .status(400)
        .json({

          success: false,

          message:
            "Invalid OTP"
        });

    } catch (err) {

      console.log(
        "VERIFY OTP ERROR:"
      );

      console.log(err);

      return res
        .status(500)
        .json({

          success: false,

          error: err.message
        });
    }
  }
);

const PORT =
  process.env.PORT || 3000;

app.listen(

  PORT,

  "0.0.0.0",

  () => {

    console.log(
      `Server running on port ${PORT}`
    );

    setTimeout(() => {

      initializeWhatsApp();

    }, 10000);
  }
);
