# PillSpark - WhatsApp Medicine Reminder Bot

A Node.js WhatsApp bot for managing medicine reminders with scheduled notifications, interactive menus, and guardian alerts.

## 📋 Prerequisites

Before starting the project, make sure you have:

1. **Node.js** installed (version 14 or higher)
   - Check: `node --version`
   - Download: [nodejs.org](https://nodejs.org/)

2. **MongoDB** running
   - Local MongoDB: Install and run locally on port 27017
   - OR MongoDB Atlas: Free cloud database at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)

3. **WhatsApp Business API Access** (optional for testing)
   - Meta Developer Account
   - WhatsApp Business API credentials

## 🚀 Quick Start

### Step 1: Install Dependencies

Open a terminal in the project directory and run:

```bash
npm install
```

This will install all required packages:
- `express` - Web server framework
- `mongoose` - MongoDB object modeling
- `axios` - HTTP client for WhatsApp API
- `node-schedule` - Job scheduling for reminders
- `dotenv` - Environment variable management

### Step 2: Configure Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# MongoDB Connection (Required)
MONGODB_URI=mongodb://localhost:27017/whatsapp_bot
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/whatsapp_bot

# WhatsApp API Configuration (Required for WhatsApp functionality)
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_VERIFY_TOKEN=your_verify_token
WHATSAPP_APP_SECRET=your_app_secret

# Optional Configuration
PORT=5000
BANNER_IMAGE_URL=https://via.placeholder.com/800x400/25D366/FFFFFF?text=PillSpark+AI+Assistant
```

**Note:** You can run the server without WhatsApp credentials, but it won't be able to send/receive WhatsApp messages. MongoDB is required.

### Step 3: Start MongoDB (if using local MongoDB)

**Windows:**
```bash
# If MongoDB is installed as a service, it should start automatically
# Or start manually:
"C:\Program Files\MongoDB\Server\<version>\bin\mongod.exe"
```

**Mac/Linux:**
```bash
# Using Homebrew (Mac)
brew services start mongodb-community

# Or manually
mongod
```

### Step 4: Start the Server

Run the following command:

```bash
npm start
```

Or directly:
```bash
node index.js
```

You should see output like:
```
✅ Connected to MongoDB
🔄 Restored 0 reminders.
🚀 Server running on port 5000
```

## 🌐 Accessing the Server

Once started, the server will be available at:

- **Main API**: `http://localhost:5000/`
- **Health Check**: `http://localhost:5000/health`
- **Webhook Endpoint**: `http://localhost:5000/webhook`
- **Admin Dashboard**: `http://localhost:5000/admin`

### Admin Dashboard

Visit `http://localhost:5000/admin` to see:
- Total users
- Active reminders
- User details with last active times

## 📱 Setting Up WhatsApp Webhook

To connect WhatsApp:

1. **Get WhatsApp Business API credentials** from Meta Developer Portal
2. **Set up webhook URL**: `https://your-domain.com/webhook`
3. **Configure verify token** in Meta Developer Portal (must match `WHATSAPP_VERIFY_TOKEN`)
4. **Subscribe to webhook events**: messages

## 🔧 Troubleshooting

### Port Already in Use

If port 5000 is already in use:

```bash
# Change the port in .env file
PORT=3000

# Or stop the process using port 5000
# Windows:
netstat -ano | findstr :5000
taskkill /PID <process_id> /F

# Mac/Linux:
lsof -ti:5000 | xargs kill
```

### MongoDB Connection Error

**Error:** `MongoDB connection error`

**Solutions:**
- Ensure MongoDB is running
- Check MongoDB URI in `.env` file
- Verify network connection if using MongoDB Atlas
- Check firewall settings

### Missing Environment Variables

The server will start but WhatsApp features won't work without:
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_VERIFY_TOKEN`

## 📦 Project Structure

```
WhatsAppMedReminder/
├── index.js          # Main application file
├── package.json      # Dependencies and scripts
├── .env              # Environment variables (create this)
├── .env.example      # Example environment file (optional)
└── README.md         # This file
```

## 🛠️ Available Scripts

- `npm start` - Start the server
- `node index.js` - Start the server directly

## 📝 Features

- ✅ Interactive WhatsApp menu with images
- ✅ Medicine reminder scheduling
- ✅ Photo upload for medicines
- ✅ Guardian/emergency contact support
- ✅ Admin dashboard
- ✅ 12-hour and 24-hour time format support
- ✅ Snooze functionality

## 🔒 Security Notes

- Never commit `.env` file to version control
- Keep `WHATSAPP_APP_SECRET` secure
- Use HTTPS for production webhook URLs
- Enable webhook signature verification in production

## 📞 Support

For issues or questions, check the logs in the terminal where the server is running.

---

**Happy Coding! 💊✨**
