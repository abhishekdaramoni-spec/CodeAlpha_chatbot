/**
 * Sunrise University FAQ Assistant: Client Controller
 * Engineered with HTML5 local history persistence, Web Speech transcribers, 
 * instant in-browser autocomplete, feedback aggregators, and system analytics dashboards.
 */

document.addEventListener("DOMContentLoaded", () => {
    // --- DOM Elements ---
    const htmlNode = document.documentElement;
    const btnThemeToggle = document.getElementById("btn-theme-toggle");

    // View switching elements
    const btnChatView = document.getElementById("btn-chat-view");
    const btnAdminView = document.getElementById("btn-admin-view");
    const chatSection = document.getElementById("chat-section");
    const adminSection = document.getElementById("admin-section");

    // Chat Panel elements
    const chatMessagesStream = document.getElementById("chat-messages-stream");
    const chatInputField = document.getElementById("chat-input-field");
    const chatSendBtn = document.getElementById("chat-send-btn");
    const btnClearChat = document.getElementById("btn-clear-chat");
    const btnVoiceInput = document.getElementById("btn-voice-input");
    const autocompleteBox = document.getElementById("autocomplete-box");
    const chatCategoryFilters = document.getElementById("chat-category-filters");
    const welcomeBanner = document.getElementById("chat-welcome-banner");
    const quickSuggestionsPanel = document.getElementById("hero-quick-suggestions");

    // Admin Auth elements
    const modalAdminLogin = document.getElementById("modal-admin-login");
    const adminPasswordInput = document.getElementById("admin-password-input");
    const btnSubmitLogin = document.getElementById("btn-submit-login");
    const loginErrorMsg = document.getElementById("login-error-msg");
    const togglePasswordVisibility = document.getElementById("toggle-password-visibility");
    const btnLogout = document.getElementById("btn-logout");

    // Admin Sidebar tabs
    const adminTabBtns = document.querySelectorAll(".admin-tab-btn");
    const adminTabPanels = document.querySelectorAll(".admin-tab-panel");
    const btnRefreshAnalytics = document.getElementById("btn-refresh-analytics");

    // Admin FAQ Manager CRUD elements
    const adminSearchInput = document.getElementById("admin-search-input");
    const adminFaqTableRows = document.getElementById("admin-faq-table-rows");
    const btnOpenCreateModal = document.getElementById("btn-open-create-modal");
    const btnExportFaqs = document.getElementById("btn-export-faqs");
    const faqImportFileInput = document.getElementById("faq-import-file-input");

    // Admin Analytics elements
    const analyticTotalQueries = document.getElementById("analytic-total-queries");
    const analyticAvgConfidence = document.getElementById("analytic-avg-confidence");
    const analyticFeedbackRatio = document.getElementById("analytic-feedback-ratio");
    const analyticFailedCount = document.getElementById("analytic-failed-count");
    const analyticListTopAsked = document.getElementById("analytic-list-top-asked");
    const analyticListFailed = document.getElementById("analytic-list-failed");
    const analyticCategoryDistributionBars = document.getElementById("analytic-category-distribution-bars");
    const analyticFbHelpful = document.getElementById("analytic-fb-helpful");
    const analyticFbNothelpful = document.getElementById("analytic-fb-nothelpful");
    const analyticFbUnrated = document.getElementById("analytic-fb-unrated");

    // Modal FAQ Form elements
    const modalFaqForm = document.getElementById("modal-faq-form");
    const faqModalTitle = document.getElementById("faq-modal-title");
    const faqCrudForm = document.getElementById("faq-crud-form");
    const faqFormId = document.getElementById("faq-form-id");
    const faqFormCategory = document.getElementById("faq-form-category");
    const faqFormQuestion = document.getElementById("faq-form-question");
    const faqFormAnswer = document.getElementById("faq-form-answer");
    const faqFormVariationInput = document.getElementById("faq-form-variation-input");
    const btnAddVariationChip = document.getElementById("btn-add-variation-chip");
    const faqFormVariationsChips = document.getElementById("faq-form-variations-chips");
    const btnSaveFaq = document.getElementById("btn-save-faq");

    // Toast Container
    const toastContainer = document.getElementById("toast-container");

    // --- State Variables ---
    let localFaqCache = [];             // CRUD FAQs cache
    let autocompleteDictionary = [];     // List of all primary questions and variations
    let currentFormVariations = [];     // Temporary tags for CRUD form variations
    let chatHistory = [];               // Browser persistent chat logs
    let speechRecognizer = null;        // Voice WebSpeech instance
    let isRecordingVoice = false;

    // ==========================================================================
    // 🎨 DESIGN THEME CONFIGURATION (Light & Dark toggle)
    // ==========================================================================
    const currentTheme = localStorage.getItem("sunrise_theme") || "dark";
    htmlNode.setAttribute("data-theme", currentTheme);

    btnThemeToggle.addEventListener("click", () => {
        const targetTheme = htmlNode.getAttribute("data-theme") === "dark" ? "light" : "dark";
        htmlNode.setAttribute("data-theme", targetTheme);
        localStorage.setItem("sunrise_theme", targetTheme);
        showToast(`Theme switched to ${targetTheme} mode.`, "info");
    });

    // ==========================================================================
    // 📂 TOAST NOTIFICATIONS SYSTEM
    // ==========================================================================
    function showToast(message, type = "success") {
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;

        let iconHtml = '<i class="fa-solid fa-circle-check toast-icon"></i>';
        if (type === "error") {
            iconHtml = '<i class="fa-solid fa-circle-exclamation toast-icon"></i>';
        } else if (type === "warning") {
            iconHtml = '<i class="fa-solid fa-triangle-exclamation toast-icon"></i>';
        } else if (type === "info") {
            iconHtml = '<i class="fa-solid fa-circle-info toast-icon"></i>';
        }

        toast.innerHTML = `${iconHtml}<span>${message}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add("hide");
            setTimeout(() => { toast.remove(); }, 300);
        }, 3500);
    }

    // ==========================================================================
    // 📂 MODAL UTILITIES
    // ==========================================================================
    function openModal(modalElement) {
        modalElement.style.display = "flex";
        setTimeout(() => { modalElement.classList.add("active"); }, 10);
    }

    function closeModal(modalElement) {
        modalElement.classList.remove("active");
        setTimeout(() => { modalElement.style.display = "none"; }, 300);
    }

    document.querySelectorAll("[data-close-target]").forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-close-target");
            closeModal(document.getElementById(targetId));
        });
    });

    window.addEventListener("click", (e) => {
        if (e.target.classList.contains("modal-overlay")) closeModal(e.target);
    });

    togglePasswordVisibility.addEventListener("click", () => {
        const type = adminPasswordInput.getAttribute("type") === "password" ? "text" : "password";
        adminPasswordInput.setAttribute("type", type);
        togglePasswordVisibility.querySelector("i").className = type === "password" ? "fa-solid fa-eye" : "fa-solid fa-eye-slash";
    });

    // ==========================================================================
    // 📂 VIEW MANAGEMENT & TAB SWITCHERS
    // ==========================================================================
    btnChatView.addEventListener("click", () => {
        btnAdminView.classList.remove("active");
        btnChatView.classList.add("active");
        adminSection.classList.remove("active");
        chatSection.classList.add("active");
    });

    btnAdminView.addEventListener("click", () => {
        if (isAdminAuthenticated()) {
            enterAdminPanel();
        } else {
            openModal(modalAdminLogin);
            adminPasswordInput.focus();
        }
    });

    btnLogout.addEventListener("click", () => {
        sessionStorage.removeItem("adminPassword");
        showToast("Session closed.", "info");
        btnAdminView.classList.remove("active");
        btnChatView.classList.add("active");
        adminSection.classList.remove("active");
        chatSection.classList.add("active");
    });

    function isAdminAuthenticated() {
        return sessionStorage.getItem("adminPassword") !== null;
    }

    function getAdminPassword() {
        return sessionStorage.getItem("adminPassword") || "";
    }

    function enterAdminPanel() {
        btnChatView.classList.remove("active");
        btnAdminView.classList.add("active");
        chatSection.classList.remove("active");
        adminSection.classList.add("active");
        loadAdminFaqData();
        loadAdminAnalytics();
    }

    // Admin view sub-tab switching
    adminTabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            adminTabBtns.forEach(b => b.classList.remove("active"));
            adminTabPanels.forEach(p => p.classList.remove("active"));

            btn.classList.add("active");
            const targetPanelId = btn.getAttribute("data-tab");
            document.getElementById(targetPanelId).classList.add("active");

            if (targetPanelId === "admin-tab-analytics") {
                loadAdminAnalytics();
            } else if (targetPanelId === "admin-tab-faqs") {
                loadAdminFaqData();
            }
        });
    });

    btnRefreshAnalytics.addEventListener("click", loadAdminAnalytics);

    // ==========================================================================
    // 📂 ADMIN LOGIN SERVICE
    // ==========================================================================
    btnSubmitLogin.addEventListener("click", performLogin);
    adminPasswordInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") performLogin();
    });

    function performLogin() {
        const password = adminPasswordInput.value.trim();
        if (!password) {
            loginErrorMsg.textContent = "Password is required.";
            loginErrorMsg.classList.remove("hide");
            return;
        }

        loginErrorMsg.classList.add("hide");

        fetch("/api/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password })
        })
        .then(async response => {
            const data = await response.json();
            if (response.ok && data.success) {
                sessionStorage.setItem("adminPassword", password);
                closeModal(modalAdminLogin);
                adminPasswordInput.value = "";
                showToast("Admin session unlocked.", "success");
                enterAdminPanel();
            } else {
                throw new Error(data.message || "Invalid password.");
            }
        })
        .catch(err => {
            loginErrorMsg.textContent = err.message || "Access denied.";
            loginErrorMsg.classList.remove("hide");
        });
    }

    // ==========================================================================
    // 🎤 BROWSER SPEECH RECOGNITION (Voice Input)
    // ==========================================================================
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        speechRecognizer = new SpeechRecognition();
        speechRecognizer.continuous = false;
        speechRecognizer.lang = 'en-US';
        speechRecognizer.interimResults = false;
        speechRecognizer.maxAlternatives = 1;

        speechRecognizer.onstart = () => {
            isRecordingVoice = true;
            btnVoiceInput.classList.add("recording");
            btnVoiceInput.setAttribute("title", "Listening... Click to stop.");
            showToast("Microphone is active. Speak now!", "info");
        };

        speechRecognizer.onerror = (e) => {
            logger.error("Speech transcription error:", e.error);
          console.error("Speech transcription error:", e.error);
            showToast(`Voice input error: ${e.error}`, "error");
            resetVoiceRecordingState();
        };

        speechRecognizer.onend = () => {
            resetVoiceRecordingState();
        };

        speechRecognizer.onresult = (event) => {
            const resultText = event.results[0][0].transcript;
            if (resultText) {
                chatInputField.value = resultText;
                showToast(`Transcribed: "${resultText}"`, "success");
                handleChatSubmit(); // Auto send message
            }
        };

        btnVoiceInput.addEventListener("click", () => {
            if (isRecordingVoice) {
                speechRecognizer.stop();
            } else {
                speechRecognizer.start();
            }
        });
    } else {
        // Speech not supported in browser
        btnVoiceInput.style.display = "none";
        logger.info("SpeechRecognition API not supported in this browser.");
        console.info("SpeechRecognition API not supported in this browser.");
    }

    function resetVoiceRecordingState() {
        isRecordingVoice = false;
        btnVoiceInput.classList.remove("recording");
        btnVoiceInput.setAttribute("title", "Dictate with voice input");
    }

    // ==========================================================================
    // 📂 LOCAL HISTORY PERSISTENCE (localStorage)
    // ==========================================================================
    function saveHistoryToBrowser() {
        localStorage.setItem("sunrise_chat_history", JSON.stringify(chatHistory));
    }

    function restoreChatHistory() {
        chatMessagesStream.innerHTML = "";
        const savedHistory = localStorage.getItem("sunrise_chat_history");

        if (savedHistory) {
            try {
                chatHistory = JSON.parse(savedHistory);
                if (chatHistory.length > 0) {
                    welcomeBanner.classList.add("hide"); // Hide banner if history exists
                    if (quickSuggestionsPanel) quickSuggestionsPanel.classList.add("hide");
                    chatHistory.forEach(msg => {
                        appendMessageBubble(msg.sender, msg.text, msg.time, msg.metadata, false);
                    });
                    scrollToBottom();
                    return;
                }
            } catch (e) {
                logger.error("Failed to parse local history:", e);
                chatHistory = [];
            }
        }

        // Append Welcome Message if empty history
        appendWelcomeMessage();
    }

    function appendWelcomeMessage() {
        welcomeBanner.classList.remove("hide");
        if (quickSuggestionsPanel) quickSuggestionsPanel.classList.remove("hide");
        appendMessageBubble("bot", "Hello! 👋 Welcome back. I'm the Sunrise University FAQ Assistant, your upgraded intelligent academic chatbot. Ask me about admissions, financials, housing, and campus life!", getFormattedTime(), null, false);
    }

    // Clear History handler
    btnClearChat.addEventListener("click", () => {
        chatHistory = [];
        saveHistoryToBrowser();
        restoreChatHistory();
        showToast("Conversation history cleared.", "info");
    });

    // ==========================================================================
    // 📂 INSTANT AUTOCOMPLETE (In-browser substring match)
    // ==========================================================================
    function loadAutocompleteIndex() {
        fetch("/api/autocomplete")
        .then(async response => {
            const data = await response.json();
            if (response.ok && data.success) {
                autocompleteDictionary = data.suggestions || [];
            }
        })
        .catch(err => logger.error("Failed to fetch autocomplete corpus:", err));
    }

    chatInputField.addEventListener("input", () => {
        const query = chatInputField.value.trim().toLowerCase();
        if (!query || query.length < 2) {
            hideAutocompleteBox();
            return;
        }

        // Search locally within suggestions dictionary
        const matches = autocompleteDictionary.filter(item => 
            item.toLowerCase().includes(query)
        ).slice(0, 5); // limit to 5 matching suggestions

        if (matches.length > 0) {
            renderAutocompleteItems(matches);
        } else {
            hideAutocompleteBox();
        }
    });

    function renderAutocompleteItems(matches) {
        autocompleteBox.innerHTML = "";
        matches.forEach(item => {
            const div = document.createElement("div");
            div.className = "autocomplete-item";
            div.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i><span>${item}</span>`;

            div.addEventListener("click", () => {
                chatInputField.value = item;
                hideAutocompleteBox();
                handleChatSubmit(); // Auto submit
            });
            autocompleteBox.appendChild(div);
        });
        autocompleteBox.classList.add("active");
    }

    function hideAutocompleteBox() {
        autocompleteBox.classList.remove("active");
    }

    // Hide box when clicking outside
    window.addEventListener("click", (e) => {
        if (e.target !== chatInputField && !autocompleteBox.contains(e.target)) {
            hideAutocompleteBox();
        }
    });

    // Hide box on Escape key
    chatInputField.addEventListener("keydown", (e) => {
        if (e.key === "Escape") hideAutocompleteBox();
    });

    // ==========================================================================
    // 📂 CATEGORY FILTER PILLS
    // ==========================================================================
    document.querySelectorAll(".filter-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            pill.classList.toggle("active");
            showToast(`Filtering updated.`, "info");
        });
    });

    function getActiveCategories() {
        const pills = document.querySelectorAll(".filter-pill.active");
        if (pills.length === 0) return []; // searching all categories
        return Array.from(pills).map(p => p.getAttribute("data-category"));
    }

    // ==========================================================================
    // 📂 CHAT LOGIC & RENDER BUBBLES (Thumbs rating & Quality labels)
    // ==========================================================================
    function scrollToBottom() {
        chatMessagesStream.scrollTop = chatMessagesStream.scrollHeight;
    }

    function getFormattedTime() {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Appends message to DOM
    function appendMessageBubble(sender, text, time, metadata = null, saveToState = true) {
        welcomeBanner.classList.add("hide"); // Always hide banner upon bubble
        if (quickSuggestionsPanel) quickSuggestionsPanel.classList.add("hide");

        const wrapper = document.createElement("div");
        wrapper.className = `message-wrapper ${sender === "user" ? "user-message" : "bot-message"}`;

        const avatar = document.createElement("div");
        avatar.className = "message-avatar";
        avatar.innerHTML = sender === "user" ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';

        const container = document.createElement("div");
        container.className = "message-bubble-container";

        // Show Spell Correction notification if corrected
        if (sender === "user" && metadata && metadata.corrected && metadata.corrected !== text) {
            const correctionSpan = document.createElement("span");
            correctionSpan.className = "spell-corrected-badge";
            correctionSpan.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Corrected spelling: "${metadata.corrected}"`;
            container.appendChild(correctionSpan);
        }

        const bubble = document.createElement("div");
        bubble.className = "message-bubble";
        bubble.textContent = text;
        container.appendChild(bubble);

        // Include NLP Quality Dashboard for bot responses
        if (sender === "bot" && metadata) {
            const metaCard = document.createElement("div");
            metaCard.className = "bot-metadata animate-fade-in";

            // Format score as percentage progress
            const scoreVal = metadata.confidence || 0.0;
            const scorePercentage = (scoreVal * 100).toFixed(0);

            let qualityLabel = "Weak";
            let colorClass = "weak";

            if (scoreVal >= 0.80) {
                qualityLabel = "Excellent";
                colorClass = "excellent";
            } else if (scoreVal >= 0.60) {
                qualityLabel = "Good";
                colorClass = "good";
            } else if (scoreVal >= 0.40) {
                qualityLabel = "Fair";
                colorClass = "fair";
            }

            let metaHtml = "";

            // 1. Matched Question details
            if (metadata.matched_question) {
                metaHtml += `
                    <div class="meta-row" title="This is the FAQ node matched in the database">
                        <i class="fa-solid fa-bullseye"></i>
                        <span>Matched FAQ: <strong>${metadata.matched_question}</strong></span>
                    </div>
                `;
            }

            // 2. Progress Bar
            metaHtml += `
                <div class="meta-row progress-row">
                    <div class="progress-label-bar">
                        <span>Semantic Confidence</span>
                        <span class="quality-badge ${colorClass}">${scorePercentage}% (${qualityLabel})</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill ${colorClass}" style="width: ${scorePercentage}%"></div>
                    </div>
                </div>
            `;

            // 3. 👍/👎 Feedback Buttons
            if (metadata.log_id) {
                // If feedback is already submitted, show text, otherwise buttons
                if (metadata.feedback_submitted) {
                    metaHtml += `
                        <div class="feedback-action-row">
                            <span class="feedback-registered-text"><i class="fa-solid fa-circle-check"></i> Thank you for your feedback!</span>
                        </div>
                    `;
                } else {
                    metaHtml += `
                        <div class="feedback-action-row" id="fb-row-${metadata.log_id}">
                            <span class="feedback-question">Was this helpful?</span>
                            <div class="feedback-buttons">
                                <button class="feedback-btn up-btn" data-log-id="${metadata.log_id}" title="Yes, this was helpful">
                                    <i class="fa-solid fa-thumbs-up"></i>
                                </button>
                                <button class="feedback-btn down-btn" data-log-id="${metadata.log_id}" title="No, this was not helpful">
                                    <i class="fa-solid fa-thumbs-down"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }
            }

            metaCard.innerHTML = metaHtml;
            container.appendChild(metaCard);

            // 4. "Did you mean?" suggestions
            if (metadata.top_suggestions && metadata.top_suggestions.length > 0) {
                const suggContainer = document.createElement("div");
                suggContainer.className = "did-you-mean-container animate-fade-in";

                const label = document.createElement("span");
                label.className = "did-you-mean-label";
                label.innerHTML = metadata.confidence < 0.25 ? '<i class="fa-solid fa-circle-question"></i> Did you mean?' : '<i class="fa-solid fa-lightbulb"></i> Alternative suggestions:';
                suggContainer.appendChild(label);

                const list = document.createElement("div");
                list.className = "suggestion-buttons-list";

                metadata.top_suggestions.forEach(s => {
                    const btn = document.createElement("button");
                    btn.className = "suggest-reply-btn";
                    const scorePct = (s.score * 100).toFixed(0);
                    btn.innerHTML = `
                        <span>${s.question}</span>
                        <span class="badge-score">${scorePct}%</span>
                    `;

                    btn.addEventListener("click", () => {
                        chatInputField.value = s.question;
                        handleChatSubmit();
                    });
                    list.appendChild(btn);
                });

                suggContainer.appendChild(list);
                container.appendChild(suggContainer);
            }
        }

        const timeNode = document.createElement("span");
        timeNode.className = "message-time";
        timeNode.textContent = time;
        container.appendChild(timeNode);

        wrapper.appendChild(avatar);
        wrapper.appendChild(container);

        chatMessagesStream.appendChild(wrapper);
        scrollToBottom();

        // Attach listeners to feedback buttons if rendered
        if (sender === "bot" && metadata && metadata.log_id && !metadata.feedback_submitted) {
            const upBtn = wrapper.querySelector(`.up-btn`);
            const downBtn = wrapper.querySelector(`.down-btn`);

            if (upBtn && downBtn) {
                upBtn.addEventListener("click", () => sendFeedback(metadata.log_id, "helpful"));
                downBtn.addEventListener("click", () => sendFeedback(metadata.log_id, "not_helpful"));
            }
        }

        // Save to browser history
        if (saveToState) {
            chatHistory.push({ sender, text, time, metadata });
            saveHistoryToBrowser();
        }
    }

    function showTypingIndicator() {
        const wrapper = document.createElement("div");
        wrapper.className = "message-wrapper bot-message temp-typing";
        wrapper.id = "bot-typing-node";

        const avatar = document.createElement("div");
        avatar.className = "message-avatar";
        avatar.innerHTML = '<i class="fa-solid fa-robot"></i>';

        const container = document.createElement("div");
        container.className = "message-bubble-container";

        const bubble = document.createElement("div");
        bubble.className = "message-bubble";

        const typing = document.createElement("div");
        typing.className = "typing-indicator";
        typing.innerHTML = `
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
        `;

        bubble.appendChild(typing);
        container.appendChild(bubble);
        wrapper.appendChild(avatar);
        wrapper.appendChild(container);

        chatMessagesStream.appendChild(wrapper);
        scrollToBottom();
    }

    function hideTypingIndicator() {
        const node = document.getElementById("bot-typing-node");
        if (node) node.remove();
    }

    // Submit user message
    function handleChatSubmit() {
        const query = chatInputField.value.trim();
        if (!query) return;

        hideAutocompleteBox();

        // 1. Get Selected Categories
        const categories = getActiveCategories();

        // 2. Local submit user bubble
        appendMessageBubble("user", query, getFormattedTime(), null, true);
        chatInputField.value = "";

        showTypingIndicator();

        // 3. Make AJAX POST Call
        fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: query, categories: categories })
        })
        .then(async response => {
            const data = await response.json();

            // Simulated delay for conversational realism
            setTimeout(() => {
                hideTypingIndicator();

                if (response.ok || response.status === 200 || response.status === 400) {
                    // Update user's bubble in history if corrected
                    if (data.corrected_query && data.corrected_query !== query) {
                        const lastUserMsgIdx = chatHistory.length - 1;
                        if (lastUserMsgIdx >= 0 && chatHistory[lastUserMsgIdx].sender === "user") {
                            chatHistory[lastUserMsgIdx].metadata = { corrected: data.corrected_query };
                            saveHistoryToBrowser();

                            // Re-render chat to show corrected spell badge
                            restoreChatHistory();
                        }
                    }

                    // Render bot response
                    appendMessageBubble("bot", data.answer, getFormattedTime(), {
                        log_id: data.log_id,
                        confidence: data.confidence,
                        matched_question: data.matched_question,
                        matched_expression: data.matched_expression,
                        top_suggestions: data.top_suggestions || []
                    }, true);
                } else {
                    appendMessageBubble("bot", "An error occurred in query matching. Please try again shortly.");
                }
            }, 650);
        })
        .catch(err => {
            setTimeout(() => {
                hideTypingIndicator();
                appendMessageBubble("bot", "Failed to connect to the Flask server. Please check local server bounds.");
                showToast("Transmission failed.", "error");
            }, 650);
        });
    }

    chatSendBtn.addEventListener("click", handleChatSubmit);
    chatInputField.addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleChatSubmit();
    });

    // ==========================================================================
    // 📂 FEEDBACK SUBMISSION CONTROLLER
    // ==========================================================================
    function sendFeedback(logId, feedbackType) {
        fetch("/api/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ log_id: logId, feedback: feedbackType })
        })
        .then(async response => {
            const data = await response.json();
            if (response.ok && data.success) {
                // Update active state in local history
                chatHistory.forEach(msg => {
                    if (msg.sender === "bot" && msg.metadata && msg.metadata.log_id === logId) {
                        msg.metadata.feedback_submitted = true;
                    }
                });
                saveHistoryToBrowser();

                // Redraw feedback text inline
                const row = document.getElementById(`fb-row-${logId}`);
                if (row) {
                    row.innerHTML = `<span class="feedback-registered-text"><i class="fa-solid fa-circle-check"></i> Thank you for your feedback!</span>`;
                }
                showToast("Feedback captured. Thank you!", "success");
            } else {
                throw new Error(data.message || "Feedback save failed.");
            }
        })
        .catch(err => {
            showToast(err.message || "Failed to submit feedback.", "error");
        });
    }

    // ==========================================================================
    // 📂 ADMIN CRUD DATABASE SYSTEM
    // ==========================================================================
    function loadAdminFaqData() {
        adminFaqTableRows.innerHTML = `
            <tr>
                <td colspan="5" class="loading-td">
                    <i class="fa-solid fa-spinner fa-spin"></i> Retrieving Live database catalog...
                </td>
            </tr>
        `;

        fetch("/api/admin/faqs", {
            method: "GET",
            headers: { "X-Admin-Password": getAdminPassword() }
        })
        .then(async response => {
            if (!response.ok) {
                if (response.status === 401) {
                    sessionStorage.removeItem("adminPassword");
                    throw new Error("Session expired. Please re-authenticate.");
                }
                throw new Error("Failed to load FAQ database.");
            }
            const data = await response.json();
            localFaqCache = data.faqs || [];
            renderFaqTable(localFaqCache);
        })
        .catch(err => {
            showToast(err.message || "FAQ load error.", "error");
            adminFaqTableRows.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-td">
                        <i class="fa-solid fa-triangle-exclamation" style="color: var(--color-danger)"></i> 
                        ${err.message || "Failed to load database."}
                    </td>
                </tr>
            `;
        });
    }

    function renderFaqTable(faqs) {
        if (!faqs || faqs.length === 0) {
            adminFaqTableRows.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-td">
                        <i class="fa-solid fa-box-open"></i> No FAQs matched your filters.
                    </td>
                </tr>
            `;
            return;
        }

        adminFaqTableRows.innerHTML = "";
        faqs.forEach(faq => {
            const row = document.createElement("tr");
            const categoryClass = faq.category ? faq.category.replace(/\s+/g, '_') : 'General';
            const displayAns = faq.answer.length > 90 ? faq.answer.substring(0, 90) + "..." : faq.answer;

            row.innerHTML = `
                <td><strong>#${faq.id}</strong></td>
                <td><span class="cat-pill ${categoryClass}">${faq.category || "General"}</span></td>
                <td>
                    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">${faq.question}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">
                        <i class="fa-solid fa-tags"></i> Match variations: ${faq.variations ? faq.variations.length : 0}
                    </div>
                </td>
                <td title="${faq.answer}">${displayAns}</td>
                <td>
                    <div class="row-actions">
                        <button class="action-btn edit-btn" data-id="${faq.id}" title="Edit FAQ">
                            <i class="fa-solid fa-pencil"></i>
                        </button>
                        <button class="action-btn delete-btn" data-id="${faq.id}" title="Delete FAQ">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            `;

            row.querySelector(".edit-btn").addEventListener("click", () => openEditFaqModal(faq.id));
            row.querySelector(".delete-btn").addEventListener("click", () => handleDeleteFaq(faq.id));

            adminFaqTableRows.appendChild(row);
        });
    }

    // CRUD search filter
    adminSearchInput.addEventListener("input", () => {
        const query = adminSearchInput.value.toLowerCase().trim();
        if (!query) {
            renderFaqTable(localFaqCache);
            return;
        }

        const filtered = localFaqCache.filter(faq => {
            const cat = (faq.category || "").toLowerCase();
            const q = (faq.question || "").toLowerCase();
            const a = (faq.answer || "").toLowerCase();
            const vars = (faq.variations || []).map(v => v.toLowerCase()).join(" ");

            return cat.includes(query) || q.includes(query) || a.includes(query) || vars.includes(query);
        });

        renderFaqTable(filtered);
    });

    // --- VARIATION CHIP TAG MANAGER SYSTEM (Inside CRUD Modal) ---
    function renderVariationChips() {
        faqFormVariationsChips.innerHTML = "";
        currentFormVariations.forEach((variation, index) => {
            const chip = document.createElement("div");
            chip.className = "variation-chip animate-fade-in";
            chip.innerHTML = `
                <span title="${variation}">${variation}</span>
                <button type="button" class="remove-variation-btn" data-index="${index}"><i class="fa-solid fa-xmark"></i></button>
            `;

            chip.querySelector(".remove-variation-btn").addEventListener("click", () => {
                currentFormVariations.splice(index, 1);
                renderVariationChips();
            });
            faqFormVariationsChips.appendChild(chip);
        });
    }

    function triggerAddVariation() {
        const variation = faqFormVariationInput.value.trim();
        if (!variation) return;

        if (currentFormVariations.includes(variation)) {
            showToast("Variation tag already exists.", "warning");
            return;
        }

        currentFormVariations.push(variation);
        faqFormVariationInput.value = "";
        renderVariationChips();
        faqFormVariationInput.focus();
    }

    btnAddVariationChip.addEventListener("click", triggerAddVariation);
    faqFormVariationInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            triggerAddVariation();
        }
    });

    // Add clean FAQ modal open
    btnOpenCreateModal.addEventListener("click", () => {
        faqModalTitle.innerHTML = '<i class="fa-solid fa-plus"></i> Create New FAQ';
        faqFormId.value = "";
        faqCrudForm.reset();
        currentFormVariations = [];
        renderVariationChips();
        openModal(modalFaqForm);
    });

    function openEditFaqModal(id) {
        const faq = localFaqCache.find(f => f.id === id);
        if (!faq) return;

        faqModalTitle.innerHTML = `<i class="fa-solid fa-pencil"></i> Edit FAQ #${faq.id}`;
        faqFormId.value = faq.id;
        faqFormCategory.value = faq.category || "General";
        faqFormQuestion.value = faq.question || "";
        faqFormAnswer.value = faq.answer || "";
        currentFormVariations = [...(faq.variations || [])];

        renderVariationChips();
        openModal(modalFaqForm);
    }

    // Save FAQ CRUD (With duplicate checking validations)
    btnSaveFaq.addEventListener("click", () => {
        const id = faqFormId.value;
        const category = faqFormCategory.value;
        const question = faqFormQuestion.value.trim();
        const answer = faqFormAnswer.value.trim();

        if (!question || !answer) {
            showToast("Question and Answer are required.", "warning");
            return;
        }

        const payload = {
            category,
            question,
            answer,
            variations: currentFormVariations
        };

        const isEdit = id !== "";
        const url = isEdit ? `/api/admin/faqs/${id}` : "/api/admin/faqs";
        const method = isEdit ? "PUT" : "POST";

        fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "X-Admin-Password": getAdminPassword()
            },
            body: JSON.stringify(payload)
        })
        .then(async response => {
            const data = await response.json();
            if (response.ok && data.success) {
                showToast(data.message || "FAQ saved.", "success");
                closeModal(modalFaqForm);
                loadAdminFaqData(); // Reload Table
                loadAutocompleteIndex(); // Reload instant auto-complete suggestions
            } else {
                throw new Error(data.message || "Save failed.");
            }
        })
        .catch(err => {
            showToast(err.message || "Duplicate or schema validation failed.", "error");
        });
    });

    // Delete CRUD FAQ
    function handleDeleteFaq(id) {
        const faq = localFaqCache.find(f => f.id === id);
        if (!faq) return;

        if (confirm(`Delete FAQ #${faq.id}: "${faq.question}"?`)) {
            fetch(`/api/admin/faqs/${id}`, {
                method: "DELETE",
                headers: { "X-Admin-Password": getAdminPassword() }
            })
            .then(async response => {
                const data = await response.json();
                if (response.ok && data.success) {
                    showToast(data.message || "FAQ deleted.", "success");
                    loadAdminFaqData();
                    loadAutocompleteIndex();
                } else {
                    throw new Error(data.message || "Delete operation failed.");
                }
            })
            .catch(err => {
                showToast(err.message || "Delete failed.", "error");
            });
        }
    }

    // ==========================================================================
    // 📂 BULK IMPORT / EXPORT OPERATIONS
    // ==========================================================================
    btnExportFaqs.addEventListener("click", () => {
        const password = getAdminPassword();
        window.location.href = `/api/admin/faqs/export?X-Admin-Password=${password}`;
        showToast("Database downloaded.", "success");
    });

    faqImportFileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        fetch("/api/admin/faqs/import", {
            method: "POST",
            headers: { "X-Admin-Password": getAdminPassword() },
            body: formData
        })
        .then(async response => {
            const data = await response.json();
            if (response.ok && data.success) {
                showToast(data.message || "JSON Database imported.", "success");
                loadAdminFaqData();
                loadAutocompleteIndex();
            } else {
                throw new Error(data.message || "Import schema failed.");
            }
        })
        .catch(err => {
            showToast(err.message || "File import failed.", "error");
        })
        .finally(() => {
            faqImportFileInput.value = ""; // clear file upload input
        });
    });

    // ==========================================================================
    // 📂 SYSTEM ANALYTICS COMPILER
    // ==========================================================================
    function loadAdminAnalytics() {
        // Reset dashboard metrics
        analyticTotalQueries.textContent = "-";
        analyticAvgConfidence.textContent = "-%";
        analyticFeedbackRatio.textContent = "-%";
        analyticFailedCount.textContent = "-";

        fetch("/api/admin/analytics", {
            method: "GET",
            headers: { "X-Admin-Password": getAdminPassword() }
        })
        .then(async response => {
            if (!response.ok) throw new Error("Could not fetch analytics.");
            const data = await response.json();

            // Populate metrics
            analyticTotalQueries.textContent = data.total_queries || 0;
            analyticAvgConfidence.textContent = data.total_queries ? `${(data.avg_confidence * 100).toFixed(1)}%` : "0.0%";

            const helpfulCount = data.feedback_stats ? data.feedback_stats.helpful : 0;
            const nothelpfulCount = data.feedback_stats ? data.feedback_stats.not_helpful : 0;
            const ratedSum = helpfulCount + nothelpfulCount;
            const helpfulRatio = ratedSum > 0 ? (helpfulCount / ratedSum) * 100 : 0.0;
            analyticFeedbackRatio.textContent = ratedSum > 0 ? `${helpfulRatio.toFixed(1)}%` : "0.0%";

            analyticFailedCount.textContent = data.failed_count || 0;

            // 1. Most Asked FAQs List
            analyticListTopAsked.innerHTML = "";
            if (data.top_asked && data.top_asked.length > 0) {
                data.top_asked.forEach(item => {
                    const li = document.createElement("li");
                    li.innerHTML = `<span>${item.question}</span><span class="count-badge">${item.count} asks</span>`;
                    analyticListTopAsked.appendChild(li);
                });
            } else {
                analyticListTopAsked.innerHTML = `<li class="empty-list-li">No queries matched FAQs yet.</li>`;
            }

            // 2. Failed Queries List
            analyticListFailed.innerHTML = "";
            if (data.top_failed && data.top_failed.length > 0) {
                data.top_failed.forEach(item => {
                    const li = document.createElement("li");
                    li.innerHTML = `<span>"${item.query}"</span><span class="count-badge">${item.count} misses</span>`;
                    analyticListFailed.appendChild(li);
                });
            } else {
                analyticListFailed.innerHTML = `<li class="empty-list-li">No failed searches logged.</li>`;
            }

            // 3. Category Distribution progress bars
            analyticCategoryDistributionBars.innerHTML = "";
            if (data.category_distribution && Object.keys(data.category_distribution).length > 0) {
                const total = data.total_queries;

                Object.entries(data.category_distribution).forEach(([category, count]) => {
                    const pct = ((count / total) * 100).toFixed(0);
                    const barGroup = document.createElement("div");
                    barGroup.className = "cat-stat-bar-group";

                    barGroup.innerHTML = `
                        <div class="cat-stat-meta">
                            <span class="cat-stat-name">${category}</span>
                            <span>${count} asks (${pct}%)</span>
                        </div>
                        <div class="cat-stat-bar-bg">
                            <div class="cat-stat-bar-fill" style="width: ${pct}%"></div>
                        </div>
                    `;
                    analyticCategoryDistributionBars.appendChild(barGroup);
                });
            } else {
                analyticCategoryDistributionBars.innerHTML = `<div class="empty-list-li">No categories tracked yet.</div>`;
            }

            // 4. Thumbs Feedback Breakdowns
            analyticFbHelpful.textContent = helpfulCount;
            analyticFbNothelpful.textContent = nothelpfulCount;
            analyticFbUnrated.textContent = data.feedback_stats ? data.feedback_stats.no_feedback : 0;

        })
        .catch(err => {
            showToast("Failed to load query analytics dashboard.", "error");
        });
    }

    // ==========================================================================
    // INITIALIZATION SEQUENCING
    // ==========================================================================
    restoreChatHistory();      // 1. Recover history
    loadAutocompleteIndex();   // 2. Setup suggestions

    // --- Hero Action Bindings ---
    const btnHeroStart = document.getElementById("btn-hero-start");
    const btnHeroExplore = document.getElementById("btn-hero-explore");

    if (btnHeroStart) {
        btnHeroStart.addEventListener("click", () => {
            chatInputField.focus();
            chatInputField.scrollIntoView({ behavior: "smooth", block: "center" });
        });
    }

    if (btnHeroExplore) {
        btnHeroExplore.addEventListener("click", () => {
            if (quickSuggestionsPanel) {
                quickSuggestionsPanel.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        });
    }

    // --- Common Suggested Questions Click Handler ---
    document.querySelectorAll(".quick-suggest-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const questionText = btn.getAttribute("data-question");
            if (questionText) {
                chatInputField.value = questionText;
                handleChatSubmit();
            }
        });
    });
});
