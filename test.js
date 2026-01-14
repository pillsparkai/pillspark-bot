const axios = require('axios');

// உங்கள் கீஸ் (Keys) - Hardcoded
const CASHFREE_APP_ID = "TEST1091396310dfe108fb76b8f27f0a36931901";
const CASHFREE_SECRET_KEY = "cfsk_ma_test_3ee82db9aaebd1ff5131dc679facf236_c83ae945";
const CASHFREE_URL = 'https://sandbox.cashfree.com/pg/orders';

async function testPayment() {
    console.log("🚀 Starting Cashfree Test...");
    
    const orderId = `ORDER_${Date.now()}`;
    const payload = {
        order_amount: 49.00,
        order_currency: "INR",
        order_id: orderId,
        customer_details: {
            customer_id: "TEST_USER_123",
            customer_phone: "9003121146", // சும்மா ஒரு நம்பர்
            customer_name: "Test User"
        },
        order_meta: { return_url: "https://www.google.com" }
    };

    try {
        console.log("📡 Sending request to Cashfree...");
        const response = await axios.post(CASHFREE_URL, payload, {
            headers: {
                'x-client-id': CASHFREE_APP_ID,
                'x-client-secret': CASHFREE_SECRET_KEY,
                'x-api-version': '2023-08-01', // புது வெர்ஷன்
                'Content-Type': 'application/json'
            }
        });
        console.log("\n✅ SUCCESS! Payment Link Generated:");
        console.log(response.data.payment_link);
    } catch (error) {
        console.log("\n❌ FAILED! Here is the error:");
        // எரரை முழுசா காட்ட சொல்லுவோம்
        console.error(JSON.stringify(error.response?.data || error.message, null, 2));
    }
}

testPayment();