require('dotenv').config();
const path = require('path');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const schedule = require('node-schedule');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const app = express();

// Middleware
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(bodyParser.urlencoded({ extended: true }));

// ---------------- CONFIGURATION ----------------
const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp_bot';

// IMAGES
const WELCOME_IMAGE_URL = 'https://res.cloudinary.com/degvmklqe/image/upload/v1765368437/PILL_tngrkd.jpg';

// ---------------- CASHFREE HELPER FUNCTION (Not used now, but kept safe) ----------------
async function createCashfreeOrder(amount, phone, name) {
    const CASHFREE_APP_ID = "TEST1091396310dfe108fb76b8f27f0a36931901";
    const CASHFREE_SECRET_KEY = "cfsk_ma_test_3ee82db9aaebd1ff5131dc679facf236_c83ae945";
    const CASHFREE_URL = 'https://sandbox.cashfree.com/pg/links';

    console.log("🚀 Cashfree Function Started!"); 
    
    // For now, we just return null because it's free mode
    return null; 
}

// ---------------- MULTI-LANGUAGE TEXTS ----------------
const locales = {
    en: {
        welcome_title: "Select Language",
        welcome_body: "Please select your preferred language:",
        ask_name: "👋 Welcome! Please type your **Name**:",
        menu_title: "PILLSPARK HOME",
        menu_body: "How can I help you, {{name}}?",
        btn_add: "➕ Add Medicine",
        btn_view: "📋 View Schedule",
        btn_del: "🗑️ Delete Medicine",
        btn_sub: "🎁 Offer Status", // Changed Name
        btn_feed: "⭐ Feedback",
        btn_guardian: "👨‍👩‍👦 Change Guardian",
        btn_lang: "🌐 Change Language",
        med_alert: "🔔 *Medication Alert*",
        take_msg: "Hi {{name}}, time for **{{medName}}**.",
        taken: "✅ Taken",
        snooze: "💤 Snooze 5m",
        ask_med_name: "💊 Enter **Medicine Name**:",
        ask_med_time: "⏰ Enter Time (e.g. 8:00 AM):",
        ask_med_photo: "📸 Upload **Photo** of medicine.",
        photo_skip_btn: "⏩ Skip Photo",
        ask_guardian: "👨‍👩‍👦 Enter Guardian Phone (or type SKIP):",
        guardian_saved: "✅ Guardian Saved!",
        setup_done: "🎉 **Done!** Reminder set for {{medName}}.",
        ask_feedback: "📝 Please type your feedback:",
        feedback_thanks: "🙏 Thank you!",
        invalid_time: "❌ Invalid Time. Try 8:00 AM"
    },
    ta: {
        welcome_title: "மொழியைத் தேர்ந்தெடுக்கவும்",
        welcome_body: "தொடர மொழியைத் தேர்ந்தெடுக்கவும்:",
        ask_name: "👋 வணக்கம்! உங்கள் **பெயரை** டைப் செய்யவும்:",
        menu_title: "பில்ஸ்பார்க் மெனு",
        menu_body: "வணக்கம் {{name}}, உங்களுக்கு எப்படி உதவலாம்?",
        btn_add: "➕ மாத்திரை சேர்",
        btn_view: "📋 அட்டவணை பார்",
        btn_del: "🗑️ நீக்கவும்",
        btn_sub: "🎁 சலுகை விவரம்", // Changed Name
        btn_feed: "⭐ கருத்து (Feedback)",
        btn_guardian: "👨‍👩‍👦 கார்டியன் மாற்றம்",
        btn_lang: "🌐 மொழி மாற்றம்",
        med_alert: "🔔 *மாத்திரை நேரம்*",
        take_msg: "வணக்கம் {{name}}, **{{medName}}** எடுத்துக்கொள்ளவும்.",
        taken: "✅ எடுத்தாச்சு",
        snooze: "💤 5 நிமி ஒத்திவை",
        ask_med_name: "💊 மாத்திரை பெயரை டைப் செய்யவும்:",
        ask_med_time: "⏰ நேரம் என்ன? (எ.கா: 8:00 AM):",
        ask_med_photo: "📸 மாத்திரை போட்டோ அனுப்பவும்.",
        photo_skip_btn: "⏩ போட்டோ வேண்டாம்",
        ask_guardian: "👨‍👩‍👦 கார்டியன் நம்பரை அனுப்பவும் (அல்லது SKIP):",
        guardian_saved: "✅ கார்டியன் சேமிக்கப்பட்டது!",
        setup_done: "🎉 **முடிந்தது!** {{medName}} ரிமைண்டர் செட் செய்யப்பட்டது.",
        ask_feedback: "📝 உங்கள் கருத்துக்களை கீழே டைப் செய்யவும்:",
        feedback_thanks: "🙏 நன்றி!",
        invalid_time: "❌ தவறான நேரம். 8:00 AM என முயற்சிக்கவும்."
    },
    hi: {
        welcome_title: "भाषा चुनें",
        welcome_body: "कृपया अपनी भाषा चुनें:",
        ask_name: "👋 नमस्ते! अपना **नाम** लिखें:",
        menu_title: "मेनू",
        menu_body: "नमस्ते {{name}}, मैं कैसे मदद करूँ?",
        btn_add: "➕ दवा जोड़ें",
        btn_view: "📋 शेड्यूल देखें",
        btn_del: "🗑️ दवा हटाएं",
        btn_sub: "🎁 ऑफ़र स्थिति", // Changed Name
        btn_feed: "⭐ सुझाव (Feedback)",
        btn_guardian: "👨‍👩‍👦 अभिभावक बदलें",
        btn_lang: "🌐 भाषा बदलें",
        med_alert: "🔔 *दवा का समय*",
        take_msg: "नमस्ते {{name}}, **{{medName}}** लें।",
        taken: "✅ ले लिया",
        snooze: "💤 5 मिनट बाद",
        ask_med_name: "💊 दवा का नाम लिखें:",
        ask_med_time: "⏰ समय डालें (जैसे 8:00 AM):",
        ask_med_photo: "📸 दवा की फोटो भेजें",
        photo_skip_btn: "⏩ फोटो छोड़ें",
        ask_guardian: "👨‍👩‍👦 अभिभावक का नंबर (या SKIP लिखें):",
        guardian_saved: "✅ सहेजा गया!",
        setup_done: "🎉 हो गया! {{medName}} सेट है।",
        ask_feedback: "📝 सुझाव नीचे लिखें:",
        feedback_thanks: "🙏 धन्यवाद!",
        invalid_time: "❌ गलत समय। 8:00 AM लिखें।"
    },
    te: {
        welcome_title: "భాషను ఎంచుకోండి",
        welcome_body: "దయచేసి భాషను ఎంచుకోండి:",
        ask_name: "👋 స్వాగతం! మీ **పేరు** టైప్ చేయండి:",
        menu_title: "మెనూ",
        menu_body: "హలో {{name}}, మీకు ఎలా సహాయపడాలి?",
        btn_add: "➕ మందులు జోడించు",
        btn_view: "📋 షెడ్యూల్",
        btn_del: "🗑️ తొలగించు",
        btn_sub: "🎁 ఆఫర్", // Changed Name
        btn_feed: "⭐ అభిప్రాయం",
        btn_guardian: "👨‍👩‍👦 గార్డియన్‌ని మార్చండి",
        btn_lang: "🌐 భాష మార్చండి",
        med_alert: "🔔 *మందుల సమయం*",
        take_msg: "హాయ్ {{name}}, **{{medName}}** వేసుకునే సమయం.",
        taken: "✅ వేసుకున్నాను",
        snooze: "💤 5 నిమిషాలు",
        ask_med_name: "💊 మందు పేరును టైప్ చేయండి:",
        ask_med_time: "⏰ సమయం నమోదు చేయండి (ఉదా: 8:00 AM):",
        ask_med_photo: "📸 మందు ఫోటోను అప్‌లోడ్ చేయండి.",
        photo_skip_btn: "⏩ ఫోటో వద్దు (Skip)",
        ask_guardian: "👨‍👩‍👦 గార్డియన్ నంబర్ (లేదా SKIP):",
        guardian_saved: "✅ సేవ్ చేయబడింది!",
        setup_done: "🎉 **పూర్తయింది!** {{medName}} సెట్ చేయబడింది.",
        ask_feedback: "📝 మీ అభిప్రాయాన్ని వ్రాయండి:",
        feedback_thanks: "🙏 ధన్యవాదాలు!",
        invalid_time: "❌ తప్పు సమయం. 8:00 AM లా ప్రయత్నించండి."
    },
    ml: {
        welcome_title: "ഭാഷ തിരഞ്ഞെടുക്കുക",
        welcome_body: "ദയവായി ഭാഷ തിരഞ്ഞെടുക്കുക:",
        ask_name: "👋 സ്വാഗതം! നിങ്ങളുടെ **പേര്** പറയൂ:",
        menu_title: "മെനു",
        menu_body: "ഹലോ {{name}}, എന്താണ് വേണ്ടത്?",
        btn_add: "➕ മരുന്ന് ചേർക്കുക",
        btn_view: "📋 സമയം",
        btn_del: "🗑️ നീക്കം",
        btn_sub: "🎁 ഓഫർ", // Changed Name
        btn_feed: "⭐ അഭിപ്രായം",
        btn_guardian: "👨‍👩‍👦 ഗാർഡിയനെ മാറ്റുക",
        btn_lang: "🌐 ഭാഷ മാറ്റുക",
        med_alert: "🔔 *മരുന്ന് സമയം*",
        take_msg: "ഹായ് {{name}}, **{{medName}}** കഴിക്കൂ.",
        taken: "✅ കഴിച്ചു",
        snooze: "💤 5 മിനിറ്റ്",
        ask_med_name: "💊 മരുന്നിന്റെ പേര് നൽകുക:",
        ask_med_time: "⏰ സമയം നൽകുക (ഉദാ: 8:00 AM):",
        ask_med_photo: "📸 മരുന്നിന്റെ ഫോട്ടോ അപ്‌ലോഡ് ചെയ്യുക.",
        photo_skip_btn: "⏩ ഫോട്ടോ ഒഴിവാക്കുക",
        ask_guardian: "👨‍👩‍👦 ഗാർഡിയൻ നമ്പർ (അല്ലെങ്കിൽ SKIP):",
        guardian_saved: "✅ സേവ് ചെയ്തു!",
        setup_done: "🎉 **പൂർത്തിയായി!** {{medName}} സെറ്റ് ചെയ്തു.",
        ask_feedback: "📝 അഭിപ്രായം താഴെ എഴുതുക:",
        feedback_thanks: "🙏 നന്ദി!",
        invalid_time: "❌ തെറ്റായ സമയം. 8:00 AM എന്ന് നൽകുക."
    }
};

function t(key, lang, params = {}) {
    const selectedLang = locales[lang] || locales['en'];
    let text = selectedLang[key] || locales['en'][key] || key;
    Object.keys(params).forEach(param => { text = text.replace(`{{${param}}}`, params[param]); });
    return text;
}

// ---------------- DATABASE ----------------
mongoose.connect(MONGODB_URI)
    .then(() => { console.log('✅ Connected to MongoDB'); initializeScheduledReminders(); startGuardianChecker(); })
    .catch(err => console.error('❌ MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true },
    name: { type: String, default: 'Friend' },
    language: { type: String, default: 'en' },
    step: { type: String, default: 'IDLE' },
    guardian_phone: { type: String, default: '' },
    subscription_end_date: { type: Date },
    last_payment_amount: { type: Number },
    temp_medicine_name: { type: String, default: '' },
    temp_time: { type: String, default: '' },
    temp_photo_id: { type: String, default: '' },
    medicines: [{
        _id: mongoose.Schema.Types.ObjectId,
        name: String, time: String, photo_id: String, jobId: String,
        created_at: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

const logSchema = new mongoose.Schema({
    userId: String, medicineName: String, sentAt: Date, guardianPhone: String,
    status: { type: String, enum: ['PENDING', 'TAKEN', 'SNOOZED', 'ESCALATED'], default: 'PENDING' }
});
const ReminderLog = mongoose.model('ReminderLog', logSchema);

const feedbackSchema = new mongoose.Schema({
    userId: String, userName: String, message: String, date: { type: Date, default: Date.now }
});
const Feedback = mongoose.model('Feedback', feedbackSchema);

const scheduledJobs = new Map();

// ---------------- UTILS ----------------
function parseTimeString(timeStr) {
    if (!timeStr) return null;
    const cleanTime = timeStr.trim().toUpperCase();
    let hours, minutes;
    const time12Match = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
    if (time12Match) {
        hours = parseInt(time12Match[1]); minutes = parseInt(time12Match[2]);
        if (time12Match[3] === 'PM' && hours !== 12) hours += 12; else if (time12Match[3] === 'AM' && hours === 12) hours = 0;
    } else {
        const time24Match = cleanTime.match(/^(\d{1,2}):(\d{2})$/);
        if (time24Match) { hours = parseInt(time24Match[1]); minutes = parseInt(time24Match[2]); } else return null;
    }
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return { hours, minutes };
}

// ---------------- SCHEDULING ----------------
function scheduleReminder(userPhone, medicine, jobId) {
    const parsed = parseTimeString(medicine.time);
    if (!parsed) return null;
    if (scheduledJobs.has(jobId)) scheduledJobs.get(jobId).cancel();

    const job = schedule.scheduleJob(jobId, { hour: parsed.hours, minute: parsed.minutes, tz: 'Asia/Kolkata' }, async () => {
        const currentUser = await User.findOne({ phone: userPhone });
        if (!currentUser) return;
        
        const lang = currentUser.language || 'en';
        
        // Subscription Check REMOVED for FREE MONTH
        // const now = new Date();
        // const hasActiveSub = currentUser.subscription_end_date && currentUser.subscription_end_date > now;
        
        try {
            console.log(`⏰ Sending Reminder: ${medicine.name} to ${userPhone}`);
            await sendMedicineReminder(userPhone, medicine.name, medicine.photo_id, currentUser.name, lang);
            await ReminderLog.create({ userId: userPhone, medicineName: medicine.name, sentAt: new Date(), guardianPhone: currentUser.guardian_phone || '', status: 'PENDING' });
        } catch (error) { console.error(`❌ Failed to send reminder:`, error); }
    });
    if (job) scheduledJobs.set(jobId, job);
    return job;
}

function startGuardianChecker() {
    setInterval(async () => {
        const checkTime = new Date(Date.now() - 10 * 60 * 1000); 
        const overdueLogs = await ReminderLog.find({ status: 'PENDING', sentAt: { $lt: checkTime } });
        if (overdueLogs.length === 0) return;
        const guardianAlerts = {};
        for (const log of overdueLogs) {
            log.status = 'ESCALATED'; await log.save();
            if (log.guardianPhone && log.guardianPhone.length > 5) {
                if (!guardianAlerts[log.guardianPhone]) guardianAlerts[log.guardianPhone] = { user: log.userId, medicines: [] };
                guardianAlerts[log.guardianPhone].medicines.push(log.medicineName);
            }
        }
        for (const [gPhone, data] of Object.entries(guardianAlerts)) {
            await sendTextMessage(gPhone, `🚨 *Emergency Alert*\n\nYour ward (${data.user}) has NOT taken: *${data.medicines.join(', ')}*.\nPlease call them immediately.`);
        }
    }, 60 * 1000);
}

async function initializeScheduledReminders() {
    const users = await User.find({ 'medicines.0': { $exists: true } });
    for (const user of users) {
        for (const medicine of user.medicines) scheduleReminder(user.phone, medicine, `${user.phone}_${medicine._id}`);
    }
    console.log(`🔄 Restored ${scheduledJobs.size} reminders.`);
}

// ---------------- WHATSAPP SENDERS ----------------
async function sendWhatsAppMessage(to, messageData) {
    try { await axios.post(`${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`, { messaging_product: 'whatsapp', to: to, ...messageData }, { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' } }); }
    catch (error) { console.error('Send Error:', error.response?.data || error.message); }
}
async function sendTextMessage(to, text) { return sendWhatsAppMessage(to, { type: 'text', text: { body: text } }); }
async function sendImageMessage(to, imageUrl, caption = '') {
    if (imageUrl.startsWith('http')) return sendWhatsAppMessage(to, { type: 'image', image: { link: imageUrl, caption: caption } });
    else return sendWhatsAppMessage(to, { type: 'image', image: { id: imageUrl, caption: caption } });
}
async function sendLanguageSelection(to) {
    return sendWhatsAppMessage(to, { type: 'interactive', interactive: { type: 'list', header: { type: 'text', text: 'Select Language' }, body: { text: 'Please choose your preferred language:' }, footer: { text: 'PillSpark AI' }, action: { button: 'Languages', sections: [{ title: 'Select Language', rows: [
        { id: 'LANG_EN', title: 'English' }, 
        { id: 'LANG_TA', title: 'Tamil' }, 
        { id: 'LANG_HI', title: 'Hindi' },
        { id: 'LANG_TE', title: 'Telugu' }, 
        { id: 'LANG_ML', title: 'Malayalam' } 
    ] }] } } });
}

async function sendWelcomeFlow(to) {
    await sendImageMessage(to, WELCOME_IMAGE_URL, `🤖 PillSpark AI`);
    await sendTextMessage(to, `👋*Quote:*\n_"Health is wealth."_`);
    await sendLanguageSelection(to);
}

async function sendMenu(to, user) {
    const lang = user.language || 'en';
    return sendWhatsAppMessage(to, { type: 'interactive', interactive: { type: 'list', header: { type: 'text', text: t('menu_title', lang) }, body: { text: t('menu_body', lang, { name: user.name }) }, footer: { text: 'Health is Wealth' }, action: { button: 'OPEN MENU', sections: [{ title: 'Options', rows: [{ id: 'ADD_MED', title: t('btn_add', lang) }, { id: 'VIEW_MEDS', title: t('btn_view', lang) }, { id: 'DELETE_MED', title: t('btn_del', lang) }, { id: 'CHECK_SUB', title: t('btn_sub', lang) }] }, { title: 'Support', rows: [{ id: 'SEND_FEEDBACK', title: t('btn_feed', lang) }] }, { title: 'Settings', rows: [{ id: 'CHANGE_GUARDIAN', title: t('btn_guardian', lang) }, { id: 'CHANGE_LANG', title: t('btn_lang', lang) }] }] } } });
}

async function sendMedicineReminder(to, medicineName, photoId, userName, lang) {
    const bodyText = photoId ? `${t('med_alert', lang)}\n\n${t('take_msg', lang, { name: userName, medName: medicineName })}` : `💊 *${t('med_alert', lang)}*\n\n${t('take_msg', lang, { name: userName, medName: medicineName })}`;
    const msg = { type: 'interactive', interactive: { type: 'button', body: { text: bodyText }, action: { buttons: [{ type: 'reply', reply: { id: `TAKEN_${medicineName}`, title: t('taken', lang) } }, { type: 'reply', reply: { id: `SNOOZE_${medicineName}`, title: t('snooze', lang) } }] } } };
    if (photoId) msg.interactive.header = { type: 'image', image: { id: photoId } };
    return sendWhatsAppMessage(to, msg);
}

// ---------------- MAIN LOGIC ----------------
async function handleIncomingMessage(from, message) {
    try {
        let user = await User.findOne({ phone: from });
        
        if (!user) {
            // New users setup (expiry not relevant for free month but setting defaults)
            const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 30); 
            user = new User({ phone: from, step: 'ASK_LANGUAGE', subscription_end_date: trialEnd });
            await user.save(); await sendWelcomeFlow(from); return;
        }
        
        if (!user.language) { user.language = 'en'; await user.save(); }

        const msgType = message.type; let userInput = '', selectedId = '';
        if (msgType === 'text') userInput = message.text.body.trim();
        else if (msgType === 'interactive') {
            if (message.interactive.type === 'list_reply') { selectedId = message.interactive.list_reply.id; userInput = message.interactive.list_reply.title.toLowerCase(); }
            else if (message.interactive.type === 'button_reply') { selectedId = message.interactive.button_reply.id; userInput = message.interactive.button_reply.title.toLowerCase(); }
        }

        if (['hi', 'hello', 'menu', 'reset'].includes(userInput.toLowerCase())) { user.step = 'ASK_LANGUAGE'; await user.save(); await sendWelcomeFlow(from); return; }

        switch (user.step) {
            case 'ASK_LANGUAGE':
                if (selectedId.startsWith('LANG_')) {
                    const map = { 'LANG_EN': 'en', 'LANG_TA': 'ta', 'LANG_HI': 'hi', 'LANG_TE': 'te', 'LANG_ML': 'ml' };
                    user.language = map[selectedId] || 'en';
                    
                    if (user.name !== 'Friend') { user.step = 'IDLE'; await user.save(); await sendMenu(from, user); }
                    else { user.step = 'ASK_USER_NAME'; await user.save(); await sendTextMessage(from, t('ask_name', user.language)); }
                } else await sendLanguageSelection(from);
                break;

            case 'ASK_USER_NAME': 
                if (msgType === 'text') { 
                    user.name = userInput; 
                    user.step = 'ASK_GUARDIAN_ONBOARDING'; 
                    await user.save(); 
                    await sendTextMessage(from, t('ask_guardian', user.language)); 
                } 
                break;
            
            case 'ASK_GUARDIAN_ONBOARDING':
                if (msgType === 'text') {
                    if (userInput.toLowerCase() === 'skip') {
                         user.guardian_phone = '';
                    } else {
                         user.guardian_phone = userInput;
                         await sendTextMessage(from, t('guardian_saved', user.language));
                    }
                    user.step = 'IDLE';
                    await user.save();
                    await sendMenu(from, user);
                }
                break;

            case 'IDLE':
                if (selectedId === 'ADD_MED') { user.step = 'ASK_MED'; await user.save(); await sendTextMessage(from, t('ask_med_name', user.language)); }
                else if (selectedId === 'VIEW_MEDS') {
                    if (!user.medicines.length) await sendTextMessage(from, '📭 No medicines.');
                    else { let l = `🗓️ *Schedule:*\n\n`; user.medicines.forEach((m, i) => l += `${i + 1}. **${m.name}** at ${m.time}\n`); await sendTextMessage(from, l); }
                }
                else if (selectedId === 'DELETE_MED') {
                    if (!user.medicines.length) await sendTextMessage(from, 'Nothing to delete.');
                    else { let l = '🗑️ *Reply Number to Delete:*\n\n'; user.medicines.forEach((m, i) => l += `${i + 1}. ${m.name}\n`); user.step = 'DELETE_MED_SELECT'; await user.save(); await sendTextMessage(from, l); }
                }
                else if (selectedId === 'SEND_FEEDBACK') { user.step = 'ASK_FEEDBACK'; await user.save(); await sendTextMessage(from, t('ask_feedback', user.language)); }
                else if (selectedId === 'CHANGE_GUARDIAN') { user.step = 'ASK_NEW_GUARDIAN'; await user.save(); await sendTextMessage(from, t('ask_guardian', user.language)); }
                
                // 🔥 MODIFIED: Free Month Message
                else if (selectedId === 'CHECK_SUB') {
                    const freeMsg = {
                        en: "🎉 *Great News!*\n\nSubscription is **FREE** for this month! You can use all features without payment.",
                        ta: "🎉 *மகிழ்ச்சியான செய்தி!*\n\nஇந்த மாதம் சந்தா முழுவதும் **இலவசம்**! பணம் செலுத்தத் தேவையில்லை.",
                        hi: "🎉 *खुशखबरी!*\n\nइस महीने सब्सक्रिप्शन मुफ़्त है!",
                        te: "🎉 *శుభవార్త!*\n\nఈ నెల చందా ఉచితం!",
                        ml: "🎉 *സന്തോഷവാർത്ത!*\n\nഈ മാസം സബ്സ്ക്രിപ്ഷൻ സൗജന്യമാണ്!"
                    };
                    await sendTextMessage(from, freeMsg[user.language] || freeMsg['en']);
                }
                else if (selectedId === 'CHANGE_LANG') { user.step = 'ASK_LANGUAGE'; await user.save(); await sendLanguageSelection(from); }
                break;

            case 'ASK_MED': if (msgType === 'text') { user.temp_medicine_name = userInput; user.step = 'ASK_TIME'; await user.save(); await sendTextMessage(from, t('ask_med_time', user.language, { medName: user.temp_medicine_name })); } break;
            case 'ASK_TIME': if (msgType === 'text') { const p = parseTimeString(userInput); if (!p) { await sendTextMessage(from, t('invalid_time', user.language)); return; } user.temp_time = userInput; user.step = 'ASK_PHOTO'; await user.save(); await sendWhatsAppMessage(from, { type: 'interactive', interactive: { type: 'button', body: { text: t('ask_med_photo', user.language, { time: user.temp_time }) }, action: { buttons: [{ type: 'reply', reply: { id: 'PHOTO_SKIP', title: t('photo_skip_btn', user.language) } }] } } }); } break;
            case 'ASK_PHOTO':
                let pid = ''; if (msgType === 'image') pid = message.image.id; else if (selectedId !== 'PHOTO_SKIP') { await sendTextMessage(from, '❌ Send Photo OR Skip.'); return; }
                user.temp_photo_id = pid; 
                await user.save();
                await finalizeMedicine(from, user);
                break;

            case 'ASK_NEW_GUARDIAN': if (msgType === 'text') { user.guardian_phone = userInput; user.step = 'IDLE'; await user.save(); await sendTextMessage(from, t('guardian_saved', user.language)); await sendMenu(from, user); } break;
            case 'ASK_FEEDBACK': if (msgType === 'text') { await Feedback.create({ userId: from, userName: user.name, message: userInput }); user.step = 'IDLE'; await user.save(); await sendTextMessage(from, t('feedback_thanks', user.language)); await sendMenu(from, user); } break;
            case 'DELETE_MED_SELECT': if (msgType === 'text') { const idx = parseInt(userInput) - 1; if (isNaN(idx) || idx < 0 || idx >= user.medicines.length) { await sendTextMessage(from, '❌ Invalid.'); return; } const del = user.medicines[idx]; if (del.jobId && scheduledJobs.has(del.jobId)) scheduledJobs.get(del.jobId).cancel(); user.medicines.splice(idx, 1); user.step = 'IDLE'; await user.save(); await sendTextMessage(from, `🗑️ Deleted: ${del.name}`); await sendMenu(from, user); } break;
            default: user.step = 'IDLE'; await user.save(); await sendMenu(from, user); break;
        }

        // Handle Payment Buttons (Disabled/Hidden but kept for safety)
        if (selectedId === 'SUB_MONTHLY' || selectedId === 'SUB_YEARLY') {
            await sendTextMessage(from, "🎉 This month is FREE! No payment needed.");
        }

        if (selectedId && selectedId.startsWith('TAKEN_')) { await ReminderLog.updateMany({ userId: from, medicineName: selectedId.replace('TAKEN_', ''), status: 'PENDING' }, { $set: { status: 'TAKEN' } }); await sendTextMessage(from, '✅ Taken.'); }
        if (selectedId && selectedId.startsWith('SNOOZE_')) {
            const mName = selectedId.replace('SNOOZE_', ''); await ReminderLog.updateMany({ userId: from, medicineName: mName, status: 'PENDING' }, { $set: { status: 'SNOOZED' } }); await sendTextMessage(from, '💤 Snoozed 5m.');
            const sDate = new Date(Date.now() + 5 * 60 * 1000); schedule.scheduleJob(sDate, async () => { const u = await User.findOne({ phone: from }); const m = u.medicines.find(x => x.name === mName); if (m) { await sendMedicineReminder(from, mName, m.photo_id, u.name, u.language); await ReminderLog.create({ userId: from, medicineName: mName, sentAt: new Date(), guardianPhone: u.guardian_phone || '', status: 'PENDING' }); } });
        }
    } catch (e) { console.error(e); }
}

async function finalizeMedicine(from, user) {
    const medId = new mongoose.Types.ObjectId(); const jobId = `${from}_${medId}`;
    const newMed = { _id: medId, name: user.temp_medicine_name, time: user.temp_time, photo_id: user.temp_photo_id || '', jobId: jobId };
    user.medicines.push(newMed); scheduleReminder(from, newMed, jobId);
    user.step = 'IDLE'; user.temp_medicine_name = ''; user.temp_time = ''; user.temp_photo_id = '';
    await user.save(); await sendTextMessage(from, t('setup_done', user.language, { medName: newMed.name })); await sendMenu(from, user);
}

// ---------------- SERVER ----------------
app.get('/webhook', (req, res) => { if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) res.send(req.query['hub.challenge']); else res.sendStatus(403); });
app.post('/webhook', async (req, res) => {
    const body = req.body; if (body.object === 'whatsapp_business_account') {
        for (const entry of body.entry || []) { for (const change of entry.changes || []) { if (change.field === 'messages') { for (const msg of change.value.messages || []) await handleIncomingMessage(msg.from, msg); } } }
        res.sendStatus(200);
    } else res.sendStatus(404);
});
// ---------------- ADMIN DASHBOARD ROUTES ----------------

// 1. Admin Page Load
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// 2. Dashboard Stats API (இதுதான் மிஸ் ஆகி இருந்தது!)
app.get('/api/stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const allUsers = await User.find();
        let totalReminders = 0;
        allUsers.forEach(u => totalReminders += u.medicines.length);
        
        const logs = await ReminderLog.find().sort({ sentAt: -1 }).limit(5);
        
        res.json({
            users: totalUsers,
            reminders: totalReminders,
            uptime: process.uptime(),
            recentLogs: logs
        });
    } catch (error) {
        res.status(500).json({ error: 'Data fetch failed' });
    }
});

// 3. Get All Users List (New)
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        res.json(users);
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 4. Get Single User Details (New)
app.get('/api/user/:phone', async (req, res) => {
    try {
        const user = await User.findOne({ phone: req.params.phone });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 5. Send Message (New)
app.post('/api/send-message', async (req, res) => {
    const { type, target, message } = req.body;
    try {
        if (type === 'all') {
            const users = await User.find();
            let count = 0;
            for (const u of users) {
                await sendTextMessage(u.phone, `📢 *Admin Update:*\n\n${message}`);
                count++;
            }
            res.json({ success: true, count });
        } else if (type === 'single') {
            await sendTextMessage(target, `📢 *Message from Admin:*\n\n${message}`);
            res.json({ success: true });
        }
    } catch (e) { res.status(500).json({ error: 'Failed to send' }); }
});
// 👇👇👇 FEEDBACK API (Add this below /api/send-message) 👇👇👇

// 6. Get Feedbacks
app.get('/api/feedbacks', async (req, res) => {
    try {
        // Fetch last 50 feedbacks, newest first
        const feedbacks = await Feedback.find().sort({ date: -1 }).limit(50);
        res.json(feedbacks);
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 👆👆👆 End of Feedback API 👆👆👆

// ---------------- SERVER START ----------------
app.get('/', (req, res) => res.json({ status: 'Online', service: 'PillSpark Pro (Free Month)' }));
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));