import axios from "axios";
import crypto from "crypto";
import { NextResponse } from "next/server";

// Test PhonePe credentials (commented out)
const salt_key = "96434309-7796-489d-8924-ab56988a6076";
const merchant_id = "PGTESTPAYUAT86";

// Production PhonePe credentials
// const salt_key = "20e6b59f-68b8-474b-a96e-f45f2fc1e669";
// const merchant_id = "SU250625182229310346275";

export async function POST(req) {
  try {
    const reqData = await req.json();
    const merchantTransactionId = reqData.transactionId;

    const data = {
      merchantId: merchant_id,
      merchantTransactionId: merchantTransactionId,
      merchantUserId: reqData.name || "MUID" + Date.now(),
      amount: reqData.amount * 100, // Convert amount to smallest unit (e.g., paise)
      // Production URL:
      // redirectUrl: `https://lalit-bhai-new-main.vercel.app/api/status?id=${merchantTransactionId}`,
      // For localhost testing:
      redirectUrl: `http://localhost:3000/api/status?id=${merchantTransactionId}`,
      redirectMode: "POST",
      // Production URL:
      // callbackUrl: `https://lalit-bhai-new-main.vercel.app/api/status?id=${merchantTransactionId}`,
      // For localhost testing:
      callbackUrl: `http://localhost:3000/api/status?id=${merchantTransactionId}`,
      mobileNumber: reqData.phone,
      paymentInstrument: {
        type: "PAY_PAGE",
      },
    };

    const payload = JSON.stringify(data);
    const payloadMain = Buffer.from(payload).toString("base64");
    const keyIndex = 1;
    const string = payloadMain + "/pg/v1/pay";
    // For UAT/Sandbox - using HMAC-SHA256 (recommended and secure)
    const sha256 = crypto.createHmac("sha256", salt_key).update(string).digest("hex");

    // Alternative for some UAT environments - plain SHA256 (less secure, try if HMAC fails)
    // const sha256 = crypto.createHash("sha256").update(string + salt_key).digest("hex");

    const checksum = sha256 + "###" + keyIndex;

    console.log("Merchant ID:", merchant_id);
    console.log("Salt Key:", salt_key);
    console.log("Payload being sent:", payload);
    console.log("Base64 Payload:", payloadMain);
    console.log("String for hash:", string);
    console.log("Checksum:", checksum);

    // Sandbox URL (for testing):
    const prod_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay";
    // Production URL:
    // const prod_URL = "https://api.phonepe.com/apis/hermes/pg/v1/pay";

    const options = {
      method: "POST",
      url: prod_URL,
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "X-VERIFY": checksum,
        "X-MERCHANT-ID": merchant_id,
      },
      data: {
        request: payloadMain,
      },
    };

    const response = await axios(options);
    console.log("PhonePe Response:", response.data);

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
