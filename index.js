const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");

const qrCode = require("qrcode-terminal");

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
  const chat = await message.getChat();
  const body = message.body;

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
});

client.initialize();
