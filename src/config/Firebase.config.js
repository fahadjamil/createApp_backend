// Firebase Admin SDK Service Account Configuration
// Project: create-1cd84
//
// TO GET THESE CREDENTIALS:
// 1. Go to: https://console.firebase.google.com/u/0/project/create-1cd84/settings/serviceaccounts/adminsdk
// 2. Click "Generate new private key"
// 3. Download the JSON file
// 4. Copy the values from that JSON file here

const adminConfig = {
  type: "service_account",
  project_id: "create-1cd84",
  private_key_id: "YOUR_PRIVATE_KEY_ID",
  private_key: "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-xxxxx@create-1cd84.iam.gserviceaccount.com",
  client_id: "YOUR_CLIENT_ID",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40create-1cd84.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

module.exports = adminConfig;

