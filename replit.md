# WhatsApp Medicine Reminder Bot

## Overview
A Node.js WhatsApp Bot backend using Express and Mongoose for managing medicine reminders. Features HDFC-style UI with image banners and interactive list/button messages via Meta Cloud API.

## Tech Stack
- **Runtime:** Node.js 20
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose
- **HTTP Client:** Axios (for WhatsApp API calls)
- **Scheduler:** node-schedule (for automated reminders)

## Project Structure
```
/
├── index.js          # Main application with all bot logic
├── package.json      # Node.js dependencies
├── .env.example      # Environment variable template
├── .gitignore        # Git ignore rules
└── replit.md         # This documentation
```

## Features
1. **HDFC-Style UI**
   - Image banner followed by interactive list menu
   - Interactive button messages for reminders (Taken/Snooze/Skip)
   
2. **User Flow**
   - "Hi" message → Main Menu (Image + List)
   - ADD_MED → Ask medicine name → Ask time → Ask guardian phone → Save & Schedule
   - View/Delete medicines with confirmation
   - Set guardian contact for notifications

3. **Automated Reminders**
   - Schedules reminders using node-schedule with cron expressions
   - Supports 12-hour (AM/PM) and 24-hour time formats
   - Snooze functionality (10 minutes)
   - Guardian notifications when reminders fire

4. **Security**
   - Webhook signature verification (X-Hub-Signature-256)
   - App secret validation for incoming requests

## Database Schema (User)
| Field | Type | Description |
|-------|------|-------------|
| phone | String | User's WhatsApp number (unique) |
| step | String | Current conversation state |
| medicine_name | String | Temporary field during setup |
| time | String | Temporary field during setup |
| guardian_phone | String | Default guardian contact |
| medicines | Array | Saved medicine reminders |
| medicines[].name | String | Medicine name |
| medicines[].time | String | Reminder time |
| medicines[].jobId | String | Scheduled job identifier |
| medicines[].guardian_phone | String | Medicine-specific guardian |

## Environment Variables Required
| Variable | Description | Required |
|----------|-------------|----------|
| `WHATSAPP_PHONE_NUMBER_ID` | Meta WhatsApp Business Phone Number ID | Yes |
| `WHATSAPP_ACCESS_TOKEN` | Meta Graph API Access Token | Yes |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification token | Yes |
| `WHATSAPP_APP_SECRET` | Meta App Secret for signature verification | Recommended |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `BANNER_IMAGE_URL` | URL for the menu banner image | No (has default) |
| `PORT` | Server port | No (default: 5000) |

## API Endpoints
- `GET /` - API info and status
- `GET /health` - Health check with MongoDB status and scheduled jobs count
- `GET /webhook` - WhatsApp webhook verification
- `POST /webhook` - Receive WhatsApp messages

## Setup Instructions
1. Set up Meta WhatsApp Business API account
2. Configure webhook URL: `https://your-domain/webhook`
3. Set the verify token to match `WHATSAPP_VERIFY_TOKEN`
4. Add `WHATSAPP_ACCESS_TOKEN` secret in Replit
5. Add `WHATSAPP_APP_SECRET` for webhook security
6. Connect to MongoDB Atlas or use local MongoDB

## Conversation States
- `IDLE` - Default state, awaiting menu selection
- `ASK_MED` - Waiting for medicine name
- `ASK_TIME` - Waiting for reminder time
- `ASK_GUARDIAN_FOR_MED` - Waiting for guardian phone
- `ASK_GUARDIAN` - Setting default guardian
- `DELETE_MED_SELECT` - Waiting for deletion selection

## Recent Changes
- **2025-12-03**: Initial project setup with complete bot logic
- **2025-12-03**: Added node-schedule for automated reminders
- **2025-12-03**: Added webhook signature verification
- **2025-12-03**: Added DELETE_MED_SELECT flow handling
