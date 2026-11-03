// ======================
// IMAGE FUNCTIONS
// ======================

/**
 * Change the image shown on the left side.
 * @param {string} imageUrl - URL or path of the new image
 */
function changeImage(imageUrl) {
  // TODO: Write your logic here
  // Example idea:
  // const img = document.getElementById("mainImage");
  // const placeholder = document.getElementById("imagePlaceholder");
  // img.src = imageUrl;
  // img.style.display = "block";
  // placeholder.style.display = "none";
}

/**
 * Clear the current image and show the placeholder again
 */
function clearImage() {
  // TODO: Write your logic here
}

// ======================
// CHATBOT FUNCTIONS
// ======================

/**
 * Add a message to the chat window
 * @param {string} text - Message content
 * @param {"user" | "bot"} sender - Who sent the message
 */
function addMessage(text, sender) {
  // TODO: Write your logic here
  // Example idea:
  // const messagesDiv = document.getElementById("chatMessages");
  // const msg = document.createElement("div");
  // msg.className = `message ${sender}`;
  // msg.textContent = text;
  // messagesDiv.appendChild(msg);
  // messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

/**
 * Called when the user clicks Send or presses Enter
 */
function sendMessage() {
  // TODO: Write your logic here
  // Example idea:
  // const input = document.getElementById("chatInput");
  // const text = input.value.trim();
  // if (!text) return;
  // addMessage(text, "user");
  // input.value = "";
  // handleBotResponse(text);   // you will write this
}

/**
 * Handle the bot's reply after user sends a message
 * @param {string} userMessage
 */
function handleBotResponse(userMessage) {
  // TODO: Write your bot logic / API call here
  // Then call addMessage(reply, "bot");
}

/**
 * Optional: Clear all chat messages
 */
function clearChat() {
  // TODO: Write your logic here
}

// ======================
// EVENT LISTENERS
// ======================
document.getElementById("sendBtn").addEventListener("click", sendMessage);

document.getElementById("chatInput").addEventListener("keypress", function (e) {
  if (e.key === "Enter") {
    sendMessage();
  }
});

// Example of how you can call changeImage later:
// changeImage("https://example.com/image.jpg");