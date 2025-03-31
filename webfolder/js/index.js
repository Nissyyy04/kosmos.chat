let dragging = false;
let startX, startY;
let currentChatId = null;

// Initialize the page
window.onload = function() {
    console.log("Initializing index page...");
    loadChats();
};

function showNewChatPopup() {
    const popup = document.getElementById('newChatPopup');
    const chatTypeSelect = document.getElementById('chatTypeSelect');
    const modelSelect = document.getElementById('modelSelect');
    
    // Clear existing options except the first one
    while (chatTypeSelect.options.length > 1) {
        chatTypeSelect.remove(1);
    }
    while (modelSelect.options.length > 1) {
        modelSelect.remove(1);
    }
    
    // Get chat types from Python and populate the select
    eel.get_chat_types()(function(chatTypes) {
        chatTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.value;
            option.textContent = type.label;
            chatTypeSelect.appendChild(option);
        });
    });
    
    // Get available models and populate the select
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
    
    console.log("Creating new chat with type:", chatType, "model:", modelName);
    eel.new_chat(chatType, modelName)(function(result) {
        if (result.success) {
            console.log("New chat created:", result.chat_id);
            closeNewChatPopup();
            loadChats();
            switchChat(result.chat_id);
        } else {
            console.error("Error creating chat:", result.error);
            alert('Error creating chat: ' + result.error);
        }
    });
}

function loadChats() {
    console.log("Loading chats...");
    eel.get_chats()(function(chats) {
        try {
            console.log("Received chats:", chats);
            const container = document.getElementById('chatsContainer');
            if (!container) {
                console.error("Chats container not found");
                return;
            }
            
            container.innerHTML = '';
            
            if (!chats || chats.length === 0) {
                console.log("No chats found, showing empty state");
                const emptyState = document.createElement('div');
                emptyState.className = 'empty-state';
                emptyState.innerHTML = `
                    <p>No chats yet</p>
                `;
                container.appendChild(emptyState);
                return;
            }
            
            console.log(`Adding ${chats.length} chats to container`);
            chats.forEach(chat => {
                const chatCard = createChatCard(chat);
                container.appendChild(chatCard);
            });
        } catch (error) {
            console.error("Error loading chats:", error);
        }
    });
}

function createChatCard(chat) {
    console.log("Creating chat card for:", chat);
    const card = document.createElement('div');
    card.className = `chatCard ${chat.id === currentChatId ? 'active' : ''}`;
    
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = chat.title || 'Untitled Chat';
    
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = new Date(chat.last_message_at).toLocaleString();
    
    const actions = document.createElement('div');
    actions.className = 'actions';
    
    const switchButton = document.createElement('button');
    switchButton.textContent = 'Switch';
    switchButton.onclick = (e) => {
        e.stopPropagation();
        switchChat(chat.id);
    };
    
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.onclick = (e) => {
        e.stopPropagation();
        deleteChat(chat.id);
    };
    
    actions.appendChild(switchButton);
    actions.appendChild(deleteButton);
    
    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(actions);
    
    card.onclick = () => switchChat(chat.id);
    
    return card;
}

function deleteChat(chatId) {
    console.log("Deleting chat:", chatId);

    eel.delete_chat(chatId)(function(result) {
        if (result.success) {
            loadChats();
            if (currentChatId === chatId) {
                currentChatId = null;
            }
        } else {
            console.error("Error deleting chat:", result.error);
            alert('Error deleting chat: ' + result.error);
        }
    });
}


function search_chats() {
    const query = document.getElementById('searchInput').value;
    if (!query.trim()) {
        loadChats();
        return;
    }
    
    eel.search_chats(query)(function(chats) {
        const container = document.getElementById('chatsContainer');
        container.innerHTML = '';
        
        chats.forEach(chat => {
            const chatCard = createChatCard(chat);
            container.appendChild(chatCard);
        });
    });
}