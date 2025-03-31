let currentChatId = null;
let isSidebarOpen = false;
let isGenerating = false;

// Remove local assistantMessageElement – we'll use the global one defined in global.js

// Helper: Extract chat ID from URL
function getChatIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    if (!sidebar || !mainContent) {
        console.error("Sidebar or main content elements not found");
        return;
    }
    isSidebarOpen = !isSidebarOpen;
    console.log("Toggling sidebar:", isSidebarOpen ? "open" : "closed");
    if (isSidebarOpen) {
        sidebar.classList.add('open');
        mainContent.classList.add('sidebar-open');
    } else {
        sidebar.classList.remove('open');
        mainContent.classList.remove('sidebar-open');
    }
}

function setSidebarState(open) {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    if (!sidebar || !mainContent) {
        console.error("Sidebar or main content elements not found");
        return;
    }
    isSidebarOpen = open;
    console.log("Setting sidebar:", isSidebarOpen ? "open" : "closed");
    if (isSidebarOpen) {
        sidebar.classList.add('open');
        mainContent.classList.add('sidebar-open');
    } else {
        sidebar.classList.remove('open');
        mainContent.classList.remove('sidebar-open');
    }
}

function loadMessages() {
    if (!currentChatId) {
        console.error("No current chat ID available");
        return;
    }
    console.log("Loading messages for chat:", currentChatId);
    eel.get_chat(currentChatId)(function(chat) {
        if (!chat) {
            console.error("Chat not found:", currentChatId);
            showPopupMessage("Chat not found. Redirecting to home...");
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }
        console.log("Loaded chat:", chat);
        const container = document.getElementById('messagesContainer');
        if (!container) {
            console.error("Messages container not found");
            return;
        }
        container.innerHTML = ``;
        if (!chat.messages || chat.messages.length === 0) {
            console.log("No messages found in chat");
            container.innerHTML = `
                <div class="message system">
                    <div class="message-content">
                        No messages yet. Start a conversation!
                    </div>
                </div>
            `;
            return;
        }
        console.log(`Adding ${chat.messages.length} messages to chat`);
        chat.messages.forEach((message, index) => {
            console.log(`Adding message ${index + 1}/${chat.messages.length}`);
            container.appendChild(createMessageElement(message));
        });
        container.scrollTop = container.scrollHeight;
    });
}

marked.setOptions({
    highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(code, { language: lang }).value;
            } catch (__) {}
        }
        return hljs.highlightAuto(code).value;
    },
    langPrefix: 'hljs language-',
    breaks: true,
    gfm: true,
    sanitize: false,
});

function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = `message ${message.role}`;

    // Create header container
    const header = document.createElement('div');
    header.className = 'message-header';

    if (message.name) {
        const nameElem = document.createElement('div');
        nameElem.className = 'message-name';
        nameElem.textContent = message.name;
        header.appendChild(nameElem);
    }
    if (message.role) {
        const roleElem = document.createElement('div');
        roleElem.className = 'message-role';
        roleElem.textContent = message.role;
        header.appendChild(roleElem);
    }
    div.appendChild(header);

    // Create the main content container
    const content = document.createElement('div');
    content.className = 'message-content';

    // Extract and remove the <think> block from the content
    const thinkRegex = /<think>([\s\S]*?)<\/think>/;
    const thinkMatch = message.content.match(thinkRegex);
    let mainContent = message.content;
    if (thinkMatch) {
        mainContent = mainContent.replace(thinkRegex, '');
        // Create and append the think container inside the main content container
        const thinkDiv = document.createElement('div');
        thinkDiv.className = 'think-container';
        thinkDiv.innerHTML = marked.parse(thinkMatch[1]);
        content.appendChild(thinkDiv);
    }

    // Append the remaining content
    const parsedContent = document.createElement('div');
    parsedContent.innerHTML = marked.parse(mainContent);
    content.appendChild(parsedContent);

    // Highlight code blocks if any
    content.querySelectorAll('pre code').forEach(block => {
        hljs.highlightBlock(block);
    });

    div.appendChild(content);
    return div;
}

function addMessageToUI(message) {
    const container = document.getElementById('messagesContainer');
    const messageElement = createMessageElement(message);
    container.appendChild(messageElement);
    container.scrollTop = container.scrollHeight;
}

function updateChatTitle(chatId) {
    eel.generate_title(chatId)(function(response) {
        if (!response.error) {
            const headerTitle = document.getElementById('headerTitle');
            if (headerTitle) {
                headerTitle.textContent = response.title;
            }
            // Update sidebar if open
            document.querySelectorAll('.sidebar-chat').forEach(chatElement => {
                if (chatElement.querySelector('.sidebar-chat-title').textContent === response.title) {
                    chatElement.querySelector('.sidebar-chat-title').textContent = response.title;
                }
            });
        }
    });
}

async function start_generating() {
    if (isGenerating) return;
    isGenerating = true;

    const input = document.getElementById('inputTextArea').value.trim();
    if (!input) return;

    document.getElementById('stopButton').style.display = 'inline-block';
    document.getElementById('inputTextArea').value = '';

    try {
        // Ensure asynchronous eel functions are awaited for proper role assignment
        const username = await eel.username()();
        addMessageToUI({ role: 'user', content: input, name: username });
        
        // Use the global assistantMessageElement (do not declare locally)
        eel.current_model_name()(function(currentModelName) {
            assistantMessageElement = createMessageElement({ role: 'assistant', content: '', name: currentModelName });
            document.getElementById('messagesContainer').appendChild(assistantMessageElement);
        });
        
        // Start generation without saving to history immediately
        await eel.start_generating(input)();
    } catch (error) {
        handle_generation_error(`<ERROR>${error.message}</ERROR>`);
    } finally {
        isGenerating = false;
        document.getElementById('stopButton').style.display = 'none';
    }
    updateChatTitle(currentChatId);
}

// Add stop handler
function stop_generating() {
    if (!isGenerating) return;
    
    eel.stop_generating()(function(response) {
        console.log("Generation stopped:", response);
    });
    
    // Immediate UI feedback
    document.getElementById('stopButton').style.display = 'none';
    showPopupMessage('Generation stopped');
    
    // Update the assistant message to show it's incomplete
    if (assistantMessageElement) {
        const contentDiv = assistantMessageElement.querySelector('.message-content');
        contentDiv.innerHTML += '<em> (stopped)</em>';
    }
    
    isGenerating = false;
}

function enhance_prompt() {
    const input = document.getElementById('inputTextArea').value.trim();
    if (!input) return;
    showPopupMessage('Enhancing prompt...');
    eel.enhance_prompt(input)(function(response) {
        if (response.error) {
            showPopupMessage(`Error: ${response.error}`);
        } else {
            document.getElementById('inputTextArea').value = response;
            showPopupMessage('Prompt enhanced!');
        }
    });
}

function loadSidebarChats() {
    console.log("Loading sidebar chats...");
    eel.get_chats()(function(chats) {
        console.log("Chats received from backend:", chats);
        const sidebarContainer = document.getElementById("chatsList");
        if (!sidebarContainer) {
            console.error("Sidebar element with id 'chatsList' not found.");
            return;
        }
        sidebarContainer.innerHTML = '';
        if (!chats || chats.length === 0) {
            console.log("No chats found, showing empty state");
            sidebarContainer.innerHTML = '<div class="sidebar-empty-state"><p>No chats yet</p></div>';
            return;
        }
        chats.forEach(chat => {
            const chatCard = document.createElement('div');
            chatCard.className = 'sidebar-chat' + (chat.id === currentChatId ? ' active' : '');
            chatCard.innerHTML = `
                <div class="sidebar-chat-title">${chat.title || 'Untitled Chat'}</div>
                <div class="sidebar-chat-meta">${new Date(chat.last_message_at).toLocaleString()}</div>
            `;
            chatCard.onclick = () => {
                console.log("Sidebar chat clicked:", chat.id);
                switchChat(chat.id);
            };
            sidebarContainer.appendChild(chatCard);
        });
    });
}

function createSidebarChatElement(chat) {
    console.log("Creating sidebar element for chat:", chat);
    const div = document.createElement('div');
    div.className = `sidebar-chat ${chat.id === currentChatId ? 'active' : ''}`;
    const title = document.createElement('div');
    title.className = 'sidebar-chat-title';
    title.textContent = chat.title || 'Untitled Chat';
    const meta = document.createElement('div');
    meta.className = 'sidebar-chat-meta';
    meta.textContent = new Date(chat.last_message_at).toLocaleString();
    div.appendChild(title);
    div.appendChild(meta);
    div.onclick = () => {
        if (chat.id !== currentChatId) {
            console.log("Switching to chat:", chat.id);
            window.location.href = `chat.html?id=${chat.id}`;
        }
    };
    return div;
}

function showNewChatPopup() {
    const popup = document.getElementById('newChatPopup');
    const chatTypeSelect = document.getElementById('chatTypeSelect');
    const modelSelect = document.getElementById('modelSelect');
    while (chatTypeSelect.options.length > 1) {
        chatTypeSelect.remove(1);
    }
    while (modelSelect.options.length > 1) {
        modelSelect.remove(1);
    }
    eel.get_chat_types()(function(chatTypes) {
        chatTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.value;
            option.textContent = type.label;
            chatTypeSelect.appendChild(option);
        });
    });
    eel.get_available_models()(function(models) {
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.value;
            option.textContent = model.label;
            modelSelect.appendChild(option);
        });
    });
    popup.style.display = 'flex';
}

function closeNewChatPopup() {
    const popup = document.getElementById('newChatPopup');
    popup.style.display = 'none';
    document.getElementById('chatTypeSelect').value = '';
    document.getElementById('modelSelect').value = '';
}

function createNewChat() {
    const chatType = document.getElementById('chatTypeSelect').value;
    const modelName = document.getElementById('modelSelect').value;
    if (!chatType) {
        alert('Please select a chat type');
        return;
    }
    if (!modelName) {
        alert('Please select a model');
        return;
    }
    eel.new_chat(chatType, modelName)(function(result) {
        if (result.success) {
            closeNewChatPopup();
            loadSidebarChats();
            window.location.href = `chat.html?id=${result.chat_id}`;
        } else {
            alert('Error creating chat: ' + result.error);
        }
    });
}

function searchChats(query) {
    if (!query.trim()) {
        loadSidebarChats();
        return;
    }
    eel.search_chats(query)(function(chats) {
        const chatsList = document.getElementById('chatsList');
        chatsList.innerHTML = '';
        chats.forEach(chat => {
            const chatElement = createSidebarChatElement(chat);
            chatsList.appendChild(chatElement);
        });
    });
}

// Consolidated initialization on DOMContentLoaded
window.onload = function() {
    console.log("DOM loaded, initializing chat page...");

    // Setup textarea listener
    const textarea = document.getElementById('inputTextArea');
    if (textarea) {
        textarea.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                start_generating();
            }
        });
    }
    
    document.getElementById('stopButton').addEventListener('click', stop_generating);

    // Reset sidebar state
    const sidebar = document.getElementById('sidebar');
    const sidebarHeader = document.getElementById('sidebarHeader');
    const mainContent = document.querySelector('.main-content');
    isSidebarOpen = false;
    if (sidebar) sidebar.classList.remove('open');
    if (mainContent) mainContent.classList.remove('sidebar-open');
    if (sidebarHeader) sidebarHeader.onclick = function(){
        setSidebarState(false);
    };

    // Extract current chat ID from URL
    currentChatId = getChatIdFromUrl();
    console.log("Current chat ID from URL:", currentChatId);

    // Load sidebar chats and messages
    loadSidebarChats();

    // Update header title using the chat details
    if (currentChatId) {
        eel.get_chat(currentChatId)(function(chat) {
            if (chat && chat.title) {
                const headerTitle = document.getElementById('headerTitle');
                if (headerTitle) {
                    headerTitle.textContent = chat.title;
                    // Add click handler for home navigation
                    headerTitle.addEventListener('click', function() {
                        window.location.href = 'index.html';
                    });
                }
            }
        });
    } else {
        // No chat ID in URL, use default title
        const headerTitle = document.getElementById('headerTitle');
        if (headerTitle) {
            headerTitle.textContent = "kosmos.chat";
            headerTitle.addEventListener('click', function() {
                window.location.href = 'index.html';
            });
        }
    }

    if (currentChatId) {
        console.log("Loading messages for chat:", currentChatId);
        setTimeout(loadMessages, 100);
    } else {
        const container = document.getElementById('messagesContainer');
        if (container) {
            container.innerHTML = `
                <div class="message system">
                    <div class="message-content">
                        Welcome! Select a chat from the sidebar or create a new one.
                    </div>
                </div>
            `;
        }
    }  
};
