require('dotenv').config();
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const schedule = require('node-schedule');
const crypto = require('crypto');

const app = express();

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp_bot';
const BANNER_IMAGE_URL = process.env.BANNER_IMAGE_URL || 'https://via.placeholder.com/800x400/0033A0/FFFFFF?text=Medicine+Reminder+Bot';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    initializeScheduledReminders();
  })
  .catch(err => console.error('MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  step: { type: String, default: 'IDLE' },
  medicine_name: { type: String, default: '' },
  time: { type: String, default: '' },
  guardian_phone: { type: String, default: '' },
  medicines: [{
    name: String,
    time: String,
    cronExpression: String,
    guardian_phone: String,
    jobId: String,
    created_at: { type: Date, default: Date.now }
  }],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

userSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

const User = mongoose.model('User', userSchema);

const scheduledJobs = new Map();

function parseTimeString(timeStr) {
  const cleanTime = timeStr.trim().toUpperCase();
  
  let hours, minutes;
  
  const time12Match = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (time12Match) {
    hours = parseInt(time12Match[1]);
    minutes = parseInt(time12Match[2]);
    const period = time12Match[3];
    
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
  } else {
    const time24Match = cleanTime.match(/^(\d{1,2}):(\d{2})$/);
    if (time24Match) {
      hours = parseInt(time24Match[1]);
      minutes = parseInt(time24Match[2]);
    } else {
      return null;
    }
  }
  
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  
  return { hours, minutes };
}

function timeToCron(hours, minutes) {
  return `${minutes} ${hours} * * *`;
}

function scheduleReminder(userPhone, medicine, jobId) {
  const parsed = parseTimeString(medicine.time);
  if (!parsed) {
    console.error(`Invalid time format for medicine ${medicine.name}: ${medicine.time}`);
    return null;
  }
  
  const cronExpression = timeToCron(parsed.hours, parsed.minutes);
  
  if (scheduledJobs.has(jobId)) {
    scheduledJobs.get(jobId).cancel();
  }
  
  const job = schedule.scheduleJob(jobId, cronExpression, async () => {
    console.log(`Triggering reminder for ${userPhone}: ${medicine.name}`);
    try {
      await sendMedicineReminder(userPhone, medicine.name);
      
      if (medicine.guardian_phone) {
        await sendTextMessage(
          medicine.guardian_phone,
          `Reminder: ${userPhone} should take their medicine "${medicine.name}" now.`
        );
      }
    } catch (error) {
      console.error(`Failed to send reminder for ${medicine.name}:`, error);
    }
  });
  
  if (job) {
    scheduledJobs.set(jobId, job);
    console.log(`Scheduled reminder for ${medicine.name} at ${medicine.time} (cron: ${cronExpression})`);
  }
  
  return cronExpression;
}

async function initializeScheduledReminders() {
  try {
    const users = await User.find({ 'medicines.0': { $exists: true } });
    
    for (const user of users) {
      for (const medicine of user.medicines) {
        const jobId = medicine.jobId || `${user.phone}_${medicine._id}`;
        scheduleReminder(user.phone, medicine, jobId);
      }
    }
    
    console.log(`Initialized ${scheduledJobs.size} scheduled reminders`);
  } catch (error) {
    console.error('Error initializing scheduled reminders:', error);
  }
}

function cancelReminder(jobId) {
  if (scheduledJobs.has(jobId)) {
    scheduledJobs.get(jobId).cancel();
    scheduledJobs.delete(jobId);
    console.log(`Cancelled reminder job: ${jobId}`);
    return true;
  }
  return false;
}

function verifyWebhookSignature(req) {
  if (!APP_SECRET) {
    console.warn('WHATSAPP_APP_SECRET not set - skipping signature verification');
    return true;
  }
  
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    console.warn('No signature header present');
    return false;
  }
  
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', APP_SECRET)
    .update(req.rawBody)
    .digest('hex');
  
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  
  if (signatureBuffer.length !== expectedBuffer.length) {
    console.warn('Signature length mismatch');
    return false;
  }
  
  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

async function sendWhatsAppMessage(to, messageData) {
  try {
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        ...messageData
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Message sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending message:', error.response?.data || error.message);
    throw error;
  }
}

async function sendTextMessage(to, text) {
  return sendWhatsAppMessage(to, {
    type: 'text',
    text: { body: text }
  });
}

async function sendImageMessage(to, imageUrl, caption = '') {
  return sendWhatsAppMessage(to, {
    type: 'image',
    image: {
      link: imageUrl,
      caption: caption
    }
  });
}

async function sendInteractiveListMessage(to, headerText, bodyText, buttonText, sections) {
  return sendWhatsAppMessage(to, {
    type: 'interactive',
    interactive: {
      type: 'list',
      header: {
        type: 'text',
        text: headerText
      },
      body: {
        text: bodyText
      },
      footer: {
        text: 'Powered by Medicine Reminder Bot'
      },
      action: {
        button: buttonText,
        sections: sections
      }
    }
  });
}

async function sendInteractiveButtonMessage(to, headerImageUrl, bodyText, buttons) {
  return sendWhatsAppMessage(to, {
    type: 'interactive',
    interactive: {
      type: 'button',
      header: {
        type: 'image',
        image: {
          link: headerImageUrl
        }
      },
      body: {
        text: bodyText
      },
      footer: {
        text: 'Powered by Medicine Reminder Bot'
      },
      action: {
        buttons: buttons.map((btn, index) => ({
          type: 'reply',
          reply: {
            id: btn.id,
            title: btn.title
          }
        }))
      }
    }
  });
}

async function sendMainMenu(to) {
  await sendImageMessage(
    to,
    BANNER_IMAGE_URL,
    'Welcome to Medicine Reminder Bot - Your Health Partner'
  );

  await new Promise(resolve => setTimeout(resolve, 500));

  await sendInteractiveListMessage(
    to,
    'Main Menu',
    'Please select an option from the menu below to get started. We are here to help you manage your medicine reminders effectively.',
    'View Options',
    [
      {
        title: 'Medicine Management',
        rows: [
          {
            id: 'ADD_MED',
            title: 'Add Medicine',
            description: 'Add a new medicine reminder'
          },
          {
            id: 'VIEW_MEDS',
            title: 'View Medicines',
            description: 'See all your medicine reminders'
          },
          {
            id: 'DELETE_MED',
            title: 'Delete Medicine',
            description: 'Remove a medicine reminder'
          }
        ]
      },
      {
        title: 'Settings',
        rows: [
          {
            id: 'SET_GUARDIAN',
            title: 'Set Guardian',
            description: 'Add emergency contact number'
          },
          {
            id: 'HELP',
            title: 'Help',
            description: 'Get help and support'
          }
        ]
      }
    ]
  );
}

async function sendMedicineReminder(to, medicineName) {
  await sendInteractiveButtonMessage(
    to,
    BANNER_IMAGE_URL,
    `Time to take your medicine: ${medicineName}\n\nPlease confirm once you have taken your medicine.`,
    [
      { id: 'TAKEN', title: 'Taken' },
      { id: 'SNOOZE', title: 'Snooze 10 min' },
      { id: 'SKIP', title: 'Skip' }
    ]
  );
}

async function handleIncomingMessage(from, message) {
  try {
    let user = await User.findOne({ phone: from });
    
    if (!user) {
      user = new User({ phone: from, step: 'IDLE' });
      await user.save();
    }

    const messageType = message.type;
    let userInput = '';
    let selectedId = '';

    if (messageType === 'text') {
      userInput = message.text.body.trim().toLowerCase();
    } else if (messageType === 'interactive') {
      if (message.interactive.type === 'list_reply') {
        selectedId = message.interactive.list_reply.id;
        userInput = message.interactive.list_reply.title.toLowerCase();
      } else if (message.interactive.type === 'button_reply') {
        selectedId = message.interactive.button_reply.id;
        userInput = message.interactive.button_reply.title.toLowerCase();
      }
    }

    console.log(`User ${from} | Step: ${user.step} | Input: ${userInput} | Selected: ${selectedId}`);

    if (userInput === 'hi' || userInput === 'hello' || userInput === 'hey' || userInput === 'menu') {
      user.step = 'IDLE';
      await user.save();
      await sendMainMenu(from);
      return;
    }

    switch (user.step) {
      case 'IDLE':
        if (selectedId === 'ADD_MED') {
          user.step = 'ASK_MED';
          await user.save();
          await sendTextMessage(from, 'Please enter the name of your medicine:');
        } else if (selectedId === 'VIEW_MEDS') {
          await handleViewMedicines(from, user);
        } else if (selectedId === 'DELETE_MED') {
          await handleDeleteMedicine(from, user);
        } else if (selectedId === 'SET_GUARDIAN') {
          user.step = 'ASK_GUARDIAN';
          await user.save();
          await sendTextMessage(from, 'Please enter the guardian\'s phone number (with country code, e.g., +919876543210):');
        } else if (selectedId === 'HELP') {
          await sendTextMessage(from, 'Medicine Reminder Bot Help:\n\n1. Add Medicine - Set up a new medicine reminder\n2. View Medicines - See all your reminders\n3. Delete Medicine - Remove a reminder\n4. Set Guardian - Add emergency contact\n\nType "Hi" or "Menu" anytime to see the main menu.');
        } else if (selectedId === 'TAKEN') {
          await sendTextMessage(from, 'Great! You have confirmed taking your medicine. Stay healthy!');
        } else if (selectedId === 'SNOOZE') {
          await sendTextMessage(from, 'Reminder snoozed for 10 minutes. We will remind you again soon.');
          setTimeout(async () => {
            try {
              await sendTextMessage(from, 'Reminder: Please take your medicine now!');
            } catch (err) {
              console.error('Snooze reminder failed:', err);
            }
          }, 10 * 60 * 1000);
        } else if (selectedId === 'SKIP') {
          await sendTextMessage(from, 'Medicine skipped. Please remember to take it later if needed.');
        } else {
          await sendTextMessage(from, 'I didn\'t understand that. Type "Hi" or "Menu" to see the main menu.');
        }
        break;

      case 'ASK_MED':
        if (userInput && messageType === 'text') {
          user.medicine_name = message.text.body.trim();
          user.step = 'ASK_TIME';
          await user.save();
          await sendTextMessage(from, `Medicine "${user.medicine_name}" noted!\n\nPlease enter the reminder time (e.g., 08:00 AM, 14:30, 9:00 PM):`);
        } else {
          await sendTextMessage(from, 'Please enter a valid medicine name:');
        }
        break;

      case 'ASK_TIME':
        if (userInput && messageType === 'text') {
          const timeInput = message.text.body.trim();
          const parsed = parseTimeString(timeInput);
          
          if (!parsed) {
            await sendTextMessage(from, 'Invalid time format. Please enter a valid time (e.g., 08:00 AM, 14:30, 9:00 PM):');
            return;
          }
          
          user.time = timeInput;
          user.step = 'ASK_GUARDIAN_FOR_MED';
          await user.save();
          await sendTextMessage(from, `Time "${user.time}" saved!\n\nWould you like to add a guardian\'s phone number for this medicine? They will be notified if you miss a dose.\n\nEnter the phone number (with country code) or type "skip" to continue without:`);
        } else {
          await sendTextMessage(from, 'Please enter a valid time (e.g., 08:00 AM, 14:30):');
        }
        break;

      case 'ASK_GUARDIAN_FOR_MED':
        let guardianPhone = '';
        if (messageType === 'text') {
          const input = message.text.body.trim().toLowerCase();
          if (input !== 'skip') {
            guardianPhone = message.text.body.trim();
          }
        }

        const medicineId = new mongoose.Types.ObjectId();
        const jobId = `${from}_${medicineId}`;
        
        const newMedicine = {
          _id: medicineId,
          name: user.medicine_name,
          time: user.time,
          guardian_phone: guardianPhone,
          jobId: jobId
        };
        
        user.medicines.push(newMedicine);
        
        scheduleReminder(from, newMedicine, jobId);
        
        user.medicine_name = '';
        user.time = '';
        user.step = 'IDLE';
        await user.save();

        await sendTextMessage(from, 'Medicine reminder added successfully!\n\nYour medicine has been saved and you will receive reminders at the scheduled time.');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        await sendMainMenu(from);
        break;

      case 'ASK_GUARDIAN':
        if (userInput && messageType === 'text') {
          user.guardian_phone = message.text.body.trim();
          user.step = 'IDLE';
          await user.save();
          await sendTextMessage(from, `Guardian phone number saved: ${user.guardian_phone}\n\nThey will be notified in case of missed doses.`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          await sendMainMenu(from);
        } else {
          await sendTextMessage(from, 'Please enter a valid phone number with country code:');
        }
        break;

      case 'DELETE_MED_SELECT':
        if (messageType === 'text') {
          const input = message.text.body.trim().toLowerCase();
          
          if (input === 'cancel') {
            user.step = 'IDLE';
            await user.save();
            await sendTextMessage(from, 'Deletion cancelled.');
            await sendMainMenu(from);
            return;
          }
          
          const index = parseInt(input) - 1;
          
          if (isNaN(index) || index < 0 || index >= user.medicines.length) {
            await sendTextMessage(from, 'Invalid selection. Please enter a valid number or type "cancel" to go back.');
            return;
          }
          
          const deletedMedicine = user.medicines[index];
          
          if (deletedMedicine.jobId) {
            cancelReminder(deletedMedicine.jobId);
          }
          
          user.medicines.splice(index, 1);
          user.step = 'IDLE';
          await user.save();
          
          await sendTextMessage(from, `Medicine "${deletedMedicine.name}" has been deleted successfully.`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          await sendMainMenu(from);
        } else {
          await sendTextMessage(from, 'Please enter the number of the medicine to delete or type "cancel".');
        }
        break;

      default:
        user.step = 'IDLE';
        await user.save();
        await sendMainMenu(from);
        break;
    }
  } catch (error) {
    console.error('Error handling message:', error);
    await sendTextMessage(from, 'Sorry, something went wrong. Please try again or type "Hi" to start over.');
  }
}

async function handleViewMedicines(from, user) {
  if (!user.medicines || user.medicines.length === 0) {
    await sendTextMessage(from, 'You have no medicine reminders set up yet.\n\nUse the "Add Medicine" option to create your first reminder.');
  } else {
    let medicineList = 'Your Medicine Reminders:\n\n';
    user.medicines.forEach((med, index) => {
      medicineList += `${index + 1}. ${med.name}\n`;
      medicineList += `   Time: ${med.time}\n`;
      if (med.guardian_phone) {
        medicineList += `   Guardian: ${med.guardian_phone}\n`;
      }
      medicineList += '\n';
    });
    await sendTextMessage(from, medicineList);
  }
}

async function handleDeleteMedicine(from, user) {
  if (!user.medicines || user.medicines.length === 0) {
    await sendTextMessage(from, 'You have no medicine reminders to delete.');
  } else {
    let deleteOptions = 'Reply with the number of the medicine to delete:\n\n';
    user.medicines.forEach((med, index) => {
      deleteOptions += `${index + 1}. ${med.name} (${med.time})\n`;
    });
    deleteOptions += '\nOr type "cancel" to go back.';
    
    user.step = 'DELETE_MED_SELECT';
    await user.save();
    await sendTextMessage(from, deleteOptions);
  }
}

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

app.post('/webhook', async (req, res) => {
  try {
    if (!verifyWebhookSignature(req)) {
      console.error('Invalid webhook signature');
      return res.sendStatus(403);
    }
    
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            const value = change.value;
            const messages = value.messages || [];

            for (const message of messages) {
              const from = message.from;
              console.log(`Received message from ${from}:`, JSON.stringify(message, null, 2));
              await handleIncomingMessage(from, message);
            }
          }
        }
      }
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    scheduledReminders: scheduledJobs.size
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'WhatsApp Medicine Reminder Bot',
    version: '1.0.0',
    endpoints: {
      webhook: '/webhook',
      health: '/health'
    },
    status: 'running'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`WhatsApp Bot server running on port ${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
