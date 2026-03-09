const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrCode = require("qrcode-terminal");
const bcrypt = require("bcrypt");
const fs = require("fs");

// ============ DATABASE FUNCTIONS ============
const USERS_FILE = "./users.json";

// Load users from JSON file
function loadUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return { users: {} };
  }
}

// Save users to JSON file
function saveUsers(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

// Active sessions (phone numbers of logged in users)
const activeSessions = new Set();

// ============ CAESAR CIPHER ============
const ALPHABET_SIZE = 26;

// Caesar Cipher functions
function shiftCharacter(character, shiftValue, alphabetStart) {
  const position = character.charCodeAt(0) - alphabetStart;
  const newPosition = ((position + shiftValue) % ALPHABET_SIZE + ALPHABET_SIZE) % ALPHABET_SIZE;
  return String.fromCharCode(newPosition + alphabetStart);
}

function encryptText(plainText, shiftKey) {
  let encryptedResult = "";
  
  for (const character of plainText) {
    if (character >= 'a' && character <= 'z') {
      encryptedResult += shiftCharacter(character, shiftKey, 'a'.charCodeAt(0));
    } else if (character >= 'A' && character <= 'Z') {
      encryptedResult += shiftCharacter(character, shiftKey, 'A'.charCodeAt(0));
    } else {
      encryptedResult += character;
    }
  }
  
  return encryptedResult;
}

function decryptText(cipherText, shiftKey) {
  return encryptText(cipherText, -shiftKey);
}

const client = new Client({
  authStrategy: new LocalAuth(),
});

client.on("qr", (qr) => {
  qrCode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Client is ready!");
});

client.on("message", async (message) => {
  try {
    // Skip messages from WhatsApp Channels (they cause errors)
    if (message.from.includes("@newsletter")) {
      return;
    }

    const body = message.body;
    const phoneNumber = message.from; // WhatsApp number as username

  // ============ REGISTER COMMAND ============
  if (body.toLowerCase().startsWith("!register ")) {
    const password = body.split(" ")[1];
    
    if (!password || password.length < 4) {
      message.reply("❌ Password must be at least 4 characters.\nUsage: !register YourPassword");
      return;
    }

    const usersData = loadUsers();
    
    // Check if user already exists
    if (usersData.users[phoneNumber]) {
      message.reply("⚠️ You are already registered! Use !login to access.");
      return;
    }

    // Hash password and save
    const hashedPassword = await bcrypt.hash(password, 10);
    usersData.users[phoneNumber] = {
      password: hashedPassword,
      registeredAt: new Date().toISOString()
    };
    saveUsers(usersData);

    message.reply("✅ Registration successful!\nNow use: !login YourPassword");
    return;
  }

  // ============ LOGIN COMMAND ============
  if (body.toLowerCase().startsWith("!login ")) {
    const password = body.split(" ")[1];
    
    if (!password) {
      message.reply("❌ Usage: !login YourPassword");
      return;
    }

    // Check if already logged in
    if (activeSessions.has(phoneNumber)) {
      message.reply("✅ You are already logged in!");
      return;
    }

    const usersData = loadUsers();
    const user = usersData.users[phoneNumber];

    // Check if user exists
    if (!user) {
      message.reply("❌ User not found. Please !register first.");
      return;
    }

    // Compare passwords
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (passwordMatch) {
      activeSessions.add(phoneNumber);
      message.reply("✅ Login successful! You can now use all bot commands.");
    } else {
      message.reply("❌ Incorrect password. Try again.");
    }
    return;
  }

  // ============ LOGOUT COMMAND ============
  if (body.toLowerCase() === "!logout") {
    if (activeSessions.has(phoneNumber)) {
      activeSessions.delete(phoneNumber);
      message.reply("👋 Logged out successfully!");
    } else {
      message.reply("⚠️ You are not logged in.");
    }
    return;
  }

  // ============ STATUS COMMAND ============
  if (body.toLowerCase() === "!status") {
    const usersData = loadUsers();
    const isRegistered = usersData.users[phoneNumber] ? "Yes" : "No";
    const isLoggedIn = activeSessions.has(phoneNumber) ? "Yes" : "No";
    message.reply(`📊 Your Status:\n• Registered: ${isRegistered}\n• Logged in: ${isLoggedIn}`);
    return;
  }

  // ============ PROTECTED COMMANDS (require login) ============
  // Check if user is logged in before allowing other commands
  if (!activeSessions.has(phoneNumber)) {
    // Allow only public commands without login
    if (body.toLowerCase() === "!help") {
      message.reply("📋 *Available Commands:*\n\n" +
        "*Public:*\n" +
        "• !register PASSWORD - Create account\n" +
        "• !login PASSWORD - Login to bot\n" +
        "• !status - Check your status\n" +
        "• !help - Show this message\n\n" +
        "*After Login:*\n" +
        "• ping - Test bot\n" +
        "• !cypher WORD SHIFT - Encrypt text\n" +
        "• !decypher WORD SHIFT - Decrypt text\n" +
        "• que / q - Get sticker\n" +
        "• !logout - End session");
      return;
    }
    
    // Block other commands
    if (body.startsWith("!") || body.toLowerCase() === "ping" || body.toLowerCase() === "que" || body.toLowerCase() === "q") {
      message.reply("🔒 Please login first!\nUse: !register PASSWORD (if new)\nOr: !login PASSWORD");
      return;
    }
    return; // Ignore other messages
  }

  // ============ LOGGED IN USER COMMANDS ============
  
  // Caesar Cipher commands
  if (body.toLowerCase().startsWith("!cypher ")) {
    const parts = body.split(" ");
    if (parts.length >= 3) {
      const text = parts[1];
      const shift = parseInt(parts[2]);
      if (!isNaN(shift) && shift >= 1 && shift <= 26) {
        const result = encryptText(text, shift);
        message.reply(result);
      } else {
        message.reply("Shift must be a number between 1 and 26.");
      }
    } else {
      message.reply("Usage: !cypher WORD SHIFT (e.g., !cypher HELLO 3)");
    }
  } else if (body.toLowerCase().startsWith("!decypher ")) {
    const parts = body.split(" ");
    if (parts.length >= 3) {
      const text = parts[1];
      const shift = parseInt(parts[2]);
      if (!isNaN(shift) && shift >= 1 && shift <= 26) {
        const result = decryptText(text, shift);
        message.reply(result);
      } else {
        message.reply("Shift must be a number between 1 and 26.");
      }
    } else {
      message.reply("Usage: !decypher WORD SHIFT (e.g., !decypher KHOOR 3)");
    }
  } else if (body.toLowerCase() === "ping") {
    message.reply("Pong!");
  } else if (body.toLowerCase() === "que" || body.toLowerCase() === "q") {
    const url =
      "https://images7.memedroid.com/images/UPLOADED574/625f4dd6290b4.jpeg";

    try {
      const media = await MessageMedia.fromUrl(url);

      await client.sendMessage(message.from, media, {
        sendMediaAsSticker: true,

        stickerAuthor: "KBRN",

        stickerName: "CHTM",
      });
    } catch (error) {
      console.error("Error sending sticker:", error);
    }
  }
  } catch (error) {
    console.error("Error processing message:", error.message);
  }
});

client.initialize();
