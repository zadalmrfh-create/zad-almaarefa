document.addEventListener("DOMContentLoaded", function () {
  const chatToggleBtn = document.getElementById("chat-toggle-btn");
  const chatBox = document.getElementById("chat-box");
  const closeChat = document.getElementById("close-chat");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const chatMessages = document.getElementById("chat-messages");

  const API_URL = "/api/chat";

  if (chatToggleBtn && chatBox && closeChat) {
    chatToggleBtn.addEventListener("click", () => {
      chatBox.classList.toggle("hidden");
    });

    closeChat.addEventListener("click", () => {
      chatBox.classList.add("hidden");
    });
  }

  if (chatForm) {
    chatForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const messageText = chatInput.value.trim();
      if (messageText === "") return;

      appendMessage(messageText, "user");
      chatInput.value = "";

      const loadingId = "loading-" + Date.now();
      appendLoadingMessage(loadingId);

      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: messageText }),
        });

        let data;
        try {
          data = await response.json();
        } catch {
          throw new Error("السيرفر أرسل ردًا غير صالح.");
        }

        console.log("Chatbot response:", data);
        console.log("HTTP status:", response.status);

        removeLoadingMessage(loadingId);

        if (response.ok && data.reply) {
          appendMessage(data.reply, "bot");
        } else if (data.error) {
          appendMessage("⚠️ حدث خطأ:\n" + data.error, "bot");
        } else {
          appendMessage(
            "⚠️ السيرفر لم يُرجع إجابة مفهومة.\nكود الخطأ: " +
              response.status,
            "bot"
          );
        }
      } catch (error) {
        console.error("Chatbot Error:", error);
        removeLoadingMessage(loadingId);

        appendMessage(
          "⚠️ تعذر الاتصال بالسيرفر.\n\nالتفاصيل: " + error.message,
          "bot"
        );
      }
    });
  }

  function appendMessage(text, sender) {
    const messageContainer = document.createElement("div");
    messageContainer.className =
      sender === "user"
        ? "flex justify-end"
        : "flex justify-start";

    const textBubble = document.createElement("div");
    textBubble.style.maxWidth = "85%";
    textBubble.style.fontSize = "13px";
    textBubble.style.lineHeight = "1.6";
    textBubble.style.whiteSpace = "pre-line";

    if (sender === "user") {
      textBubble.className =
        "bg-emerald-600 text-white p-3 rounded-2xl rounded-tl-none shadow-sm";
    } else {
      textBubble.className =
        "bg-white text-gray-800 p-3 rounded-2xl rounded-tr-none shadow-sm border border-gray-100 text-right";
    }

    textBubble.innerText = text;
    messageContainer.appendChild(textBubble);
    chatMessages.appendChild(messageContainer);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function appendLoadingMessage(id) {
    const loadingContainer = document.createElement("div");
    loadingContainer.id = id;
    loadingContainer.className = "flex justify-start";
    loadingContainer.innerHTML = `
      <div class="bg-white text-gray-400 p-3 rounded-2xl rounded-tr-none shadow-sm border border-gray-100 text-xs flex items-center gap-2">
        <span>يتفكر المساعد الأزهري</span>
        <i class="fas fa-spinner fa-spin text-emerald-600"></i>
      </div>
    `;
    chatMessages.appendChild(loadingContainer);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function removeLoadingMessage(id) {
    const element = document.getElementById(id);
    if (element) element.remove();
  }
});
