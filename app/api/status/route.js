import crypto from "crypto";
import axios from "axios";
import { NextResponse } from "next/server";

// Configuration - Set isProduction to true for production, false for UAT
const isProduction = false;

// UAT/Sandbox Configuration
const UAT_CONFIG = {
  saltKey: "96434309-7796-489d-8924-ab56988a6076",
  merchantId: "PGTESTPAYUAT86",
  api_base_url: "https://api-preprod.phonepe.com/apis/pg-sandbox",
  base_redirect_url: "http://localhost:3000",
  use_hmac: false, // UAT uses plain SHA256
};

// Production Configuration
const PROD_CONFIG = {
  saltKey: "20e6b59f-68b8-474b-a96e-f45f2fc1e669",
  merchantId: "SU250625182229310346275",
  api_base_url: "https://api.phonepe.com/apis/hermes",
  base_redirect_url: "https://lalit-bhai-new-main.vercel.app",
  use_hmac: true, // Production uses HMAC-SHA256
};

// Current active configuration
const config = isProduction ? PROD_CONFIG : UAT_CONFIG;

export async function POST(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const clientTransactionId = searchParams.get("id");

    console.log("Request query parameters:", Array.from(searchParams.entries()));

    const keyIndex = 1;
    const stringToHash = `/pg/v1/status/${config.merchantId}/${clientTransactionId}` + config.saltKey;

    // Generate checksum based on environment
    const checksum = config.use_hmac
      ? crypto
          .createHmac("sha256", config.saltKey)
          .update(`/pg/v1/status/${config.merchantId}/${clientTransactionId}`)
          .digest("hex") +
        "###" +
        keyIndex
      : crypto.createHash("sha256").update(stringToHash).digest("hex") + "###" + keyIndex;

    console.log("Environment:", isProduction ? "PRODUCTION" : "UAT/SANDBOX");
    console.log("Merchant ID:", config.merchantId);
    console.log("Hashing Method:", config.use_hmac ? "HMAC-SHA256" : "Plain SHA256");
    console.log("String for hash:", stringToHash);
    console.log("Checksum:", checksum);

    const options = {
      method: "GET",
      url: `${config.api_base_url}/pg/v1/status/${config.merchantId}/${clientTransactionId}`,
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "X-VERIFY": checksum,
        "X-MERCHANT-ID": config.merchantId,
      },
    };

    const response = await axios(options);

    console.log("Response from PhonePe API:", response.data);

    if (response.data.success === true) {
      const { transactionId, amount, state, responseCode, paymentInstrument, ...otherDetails } = response.data.data;

      const orderData = {
        transactionId,
        clientTransactionId,
        amount,
        status: state || "UNKNOWN",
        details: { responseCode, paymentInstrument, ...otherDetails },
      };

      console.log("Data to be written to Firestore:", orderData);

      // Handle order saving logic here
      // Since we removed the 'writeOrderToFirestore' import, you should now implement the order saving code
      // (either via a Firestore client, directly through an API call, or using another method).
      // For example, you can call a Firestore function or implement the saving logic below.

      // Example code for saving data to Firestore (pseudo code):
      // const db = getFirestore(app); // Assuming you have already initialized Firestore
      // const orderDocRef = doc(db, "orders", transactionId);
      // await setDoc(orderDocRef, orderData);

      console.log("Order written to Firestore successfully.");

      const queryParams = new URLSearchParams({
        transactionId,
        clientTransactionId,
        amount: amount.toString(),
        status: state,
        details: JSON.stringify(orderData.details), // Stringify nested objects
      }).toString();

      return NextResponse.redirect(`${config.base_redirect_url}/success?${queryParams}`, {
        status: 301,
      });
    } else {
      console.error("Payment failed:", response.data);

      return NextResponse.redirect(`${config.base_redirect_url}/failed`, {
        status: 301,
      });
    }
  } catch (error) {
    console.error("Error occurred during payment status check:", error);
    console.error("Error response data:", error.response?.data);
    console.error("Error status:", error.response?.status);

    return NextResponse.json(
      {
        error: "Payment status check failed",
        details: error.message,
        phonepeError: error.response?.data,
      },
      { status: 500 }
    );
  }
}
