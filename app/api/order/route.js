import axios from "axios";
import crypto from "crypto";
import { NextResponse } from "next/server";

// Configuration - Use environment variable
// Temporarily set to false for testing
const isProduction = false; // Change this to test with UAT

// UAT/Sandbox Configuration
const UAT_CONFIG = {
  salt_key: "ZWRjNWRmMzktNTU2Yi00NDI0LThmNjYtNWI4NDkxYmY0Mjg2",
  merchant_id: "TEST-M23VCROFgD0PK_25062",
  api_url: "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay",
  base_redirect_url: "https://lalit-bhai-new-main.vercel.app",
  use_hmac: false, // UAT uses plain SHA256
};

// Production Configuration - Updated
const PROD_CONFIG = {
  salt_key: "20e6b59f-68b8-474b-a96e-f45f2fc1e669",
  merchant_id: "SU2506251822293103462755",
  api_url: "https://api.phonepe.com/apis/pg/v1/pay", // Changed URL
  base_redirect_url: "https://lalit-bhai-new-main.vercel.app",
  use_hmac: true, // Production uses HMAC-SHA256
};

// Current active configuration
const config = isProduction ? PROD_CONFIG : UAT_CONFIG;

export async function POST(req) {
  try {
    const reqData = await req.json();

    // Log incoming data for debugging
    console.log("Incoming request data:", reqData);

    const merchantTransactionId = reqData.transactionId;

    // Validate required fields
    if (!reqData.transactionId) {
      return NextResponse.json(
        { error: "Missing transactionId" },
        { status: 400 }
      );
    }
    if (!reqData.amount || reqData.amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    if (!reqData.mobile) {
      return NextResponse.json(
        { error: "Missing mobile number" },
        { status: 400 }
      );
    }

    const data = {
      merchantId: config.merchant_id,
      merchantTransactionId: merchantTransactionId,
      merchantUserId: reqData.name || "MUID" + Date.now(),
      amount: reqData.amount * 100, // Convert amount to smallest unit (e.g., paise)
      redirectUrl: `${config.base_redirect_url}/api/status?id=${merchantTransactionId}`,
      redirectMode: "POST",
      callbackUrl: `${config.base_redirect_url}/api/status?id=${merchantTransactionId}`,
      mobileNumber: reqData.mobile, // Fixed: Changed from reqData.phone to reqData.mobile
      paymentInstrument: {
        type: "PAY_PAGE",
      },
    };

    const payload = JSON.stringify(data);
    const payloadMain = Buffer.from(payload).toString("base64");
    const keyIndex = 1;
    const string = payloadMain + "/pg/v1/pay" + config.salt_key;

    // Generate checksum based on environment
    const sha256 = config.use_hmac
      ? crypto
          .createHmac("sha256", config.salt_key)
          .update(payloadMain + "/pg/v1/pay")
          .digest("hex")
      : crypto.createHash("sha256").update(string).digest("hex");

    const checksum = sha256 + "###" + keyIndex;

    console.log("Environment:", isProduction ? "PRODUCTION" : "UAT/SANDBOX");
    console.log("Merchant ID:", config.merchant_id);
    console.log("API URL:", config.api_url);
    console.log("Request URL:", config.api_url);
    console.log("Request Headers:", {
      "X-VERIFY": checksum,
      "X-MERCHANT-ID": config.merchant_id,
      "Content-Type": "application/json",
    });
    console.log("Request Data:", {
      request: payloadMain,
    });
    console.log(
      "Hashing Method:",
      config.use_hmac ? "HMAC-SHA256" : "Plain SHA256"
    );

    // Only log sensitive data in development
    if (!isProduction) {
      console.log("Salt Key:", config.salt_key);
      console.log("Payload being sent:", payload);
      console.log("Base64 Payload:", payloadMain);
      console.log("String for hash:", string);
      console.log("Checksum:", checksum);
    }

    const options = {
      method: "POST",
      url: config.api_url,
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "X-VERIFY": checksum,
        "X-MERCHANT-ID": config.merchant_id,
      },
      data: {
        request: payloadMain,
      },
    };

    const response = await axios(options);
    console.log("PhonePe Response:", response.data);

    // Check if PhonePe returned an error
    if (response.data && response.data.success === false) {
      console.error("PhonePe API Error:", response.data);
      return NextResponse.json(
        {
          error: "PhonePe API Error",
          details: response.data.message || "Payment gateway error",
          phonepeError: response.data,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(response.data);
  } catch (error) {
    console.error("Error initiating payment:", error);
    console.error("Error response data:", error.response?.data);
    console.error("Error status:", error.response?.status);

    return NextResponse.json(
      {
        error: "Payment initiation failed",
        details: error.message,
        phonepeError: error.response?.data,
      },
      { status: 500 }
    );
  }
}
