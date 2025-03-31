const header = document.querySelector("header");

// Popup message handling
let popupTimeout;
let activePopups = [];

let assistantMessageElement = null;  // Global assistant message element

let isInterfaceOpen = true;
let isInterfaceLocked = false;

function showPopupMessage(message) {
    // Clear any existing timeout
    if (popupTimeout) {
        clearTimeout(popupTimeout);
    }

    // Remove any existing popups
    while (activePopups.length > 0) {
        const oldPopup = activePopups.pop();
        if (oldPopup && oldPopup.parentNode) {
            oldPopup.parentNode.removeChild(oldPopup);
        }
    }

    // Create new popup
    const popup = document.createElement('div');
    popup.className = 'popup-message';
    popup.textContent = message;
    document.body.appendChild(popup);
    activePopups.push(popup);
    
    console.log("Showing popup:", message);

    // Set timeout to remove popup
    popupTimeout = setTimeout(() => {
        console.log("Removing popup:", message);
        if (popup && popup.parentNode) {
            popup.parentNode.removeChild(popup);
            const index = activePopups.indexOf(popup);
            if (index > -1) {
                activePopups.splice(index, 1);
            }
        }
    }, 5000);
}

function stop_application() {
    eel.stop_application();
}

function minimize_application() {
    eel.minimize_application();
}

function switchChat(chatId) {
    console.log("Attempting to switch to chat:", chatId);
    // Call the Python function to switch chat
    eel.switch_chat(chatId)(function(result) {
        if (result && result.success) {
            console.log("Switch successful; redirecting to chat.html?id=" + chatId);
            // Redirect to chat page
            window.location.href = `chat.html?id=${chatId}`;
        } else {
            const errorMsg = result && result.error ? result.error : 'No valid response';
            console.error("Error switching chat:", errorMsg);
            alert('Error switching chat: ' + errorMsg);
        }
    });
}

function collapseInterface(){
    if (isInterfaceLocked) return;
    interfaceContainer.classList.add("collapsed");
    if (messagesContainer) {
        messagesContainer.classList.add("collapsed");
    }
    collapseInterfaceButton.innerText = "▲";
    isInterfaceOpen = false;
}

function openInterface(){
    if (isInterfaceLocked) return;
    if (messagesContainer) {
        setTimeout(function() {
            messagesContainer.scrollBy({ top: 340, behavior: 'smooth' });
        }, 250);
        messagesContainer.classList.remove("collapsed");
    }
    interfaceContainer.classList.remove("collapsed");
    collapseInterfaceButton.innerText = "▼";
    isInterfaceOpen = true;
}

function toggleInterface() {
    if (isInterfaceLocked){return;}
    // No need to re-fetch these if they're global or already defined elsewhere
    const interfaceContainer = document.getElementById("interfaceContainer");
    const collapseInterfaceButton = document.getElementById("collapseInterfaceButton");

    if (!interfaceContainer || !collapseInterfaceButton) return;

    if (isInterfaceOpen) {
        collapseInterface();
    } else {
        openInterface();
    }
}

function toggleInterfaceLock(){
    isInterfaceLocked = !isInterfaceLocked;

    const lockInterfaceStateButton = document.getElementById("lockInterfaceStateButton");

    if (isInterfaceLocked){
        lockInterfaceStateButton.innerText = "🔒";
    }
    else{
        lockInterfaceStateButton.innerText = "🔓";
    }
}

document.addEventListener('DOMContentLoaded', function() {
    let dragging = false;
    let startX, startY;
    
    const header = document.querySelector("header");
    if (header) {
        header.addEventListener("mousedown", (e) => {
            dragging = true;
            startX = e.screenX;
            startY = e.screenY;
        });
    
        document.addEventListener("mousemove", (e) => {
            if (dragging) {
                const dx = e.screenX - startX;
                const dy = e.screenY - startY;
                startX = e.screenX;
                startY = e.screenY;
                eel.drag_window(dx, dy);
            }
        });
    
        document.addEventListener("mouseup", () => {
            dragging = false;
        });
    }
    
    const collapseInterfaceButton = document.getElementById("collapseInterfaceButton");
    if (collapseInterfaceButton){
        collapseInterfaceButton.onclick = toggleInterface;
    }

    const inputTextArea = document.getElementById("inputTextArea");
    
    if (inputTextArea){
        inputTextArea.addEventListener('input', function(){
            if (!isInterfaceOpen) { 
                openInterface(); 
            }
        });
    }

    const messagesContainer = document.getElementById("messagesContainer");

    // Set the title - moved from window.onload to avoid conflicts
    eel.get_app_title()(function(title) {
        document.title = title;
        var headerTitle = document.getElementById("headerTitle");
        if (headerTitle) {
            headerTitle.textContent = title;
            // Add click handler to the header
            headerTitle.addEventListener('click', function() {
                window.location.href = 'index.html';
            });
        }
    });
});

document.addEventListener('click', function(event) {
    const sidebar = document.getElementById('sidebar');
    const interfaceContainer = document.getElementById('interfaceContainer');
    const clickedElement = document.elementFromPoint(event.clientX, event.clientY);

    // If the clicked element is within the sidebar, collapse the interface if it's open.
    if (sidebar && sidebar.contains(clickedElement)) {
        if (isInterfaceOpen) {
            collapseInterface();
        }
        return; // Stop further processing for sidebar clicks.
    }

    // If the clicked element is outside the interface container, collapse it if open.
    if (interfaceContainer && !interfaceContainer.contains(clickedElement)) {
        if (isInterfaceOpen) {
            collapseInterface();
        }
        return;
    }

    // Otherwise, do nothing.
});

document.addEventListener('keydown', function(event) {
    // Handle collapse/expand with Shift+Arrow keys
    if (event.key === "ArrowDown" && event.shiftKey) {
        collapseInterface();
    }
    if (event.key === "ArrowUp" && event.shiftKey) {
        openInterface();
    }
    if (event.key === "Enter"){
        collapseInterface();
    }

    // Only proceed if an ASCII printable character is pressed.
    if (!(event.key.length === 1 && event.key.charCodeAt(0) >= 32 && event.key.charCodeAt(0) <= 126)) {
        return;
    }

    // If the event is already in the textarea, don't do anything.
    if (event.target === inputTextArea) {
        return;
    }
    
    // If the interface is closed, open it.
    if (!isInterfaceOpen){
        openInterface();
    }

    // Focus the inputTextArea
    inputTextArea.focus();
});

eel.expose(receive_chunk);
function receive_chunk(chunk) {
    if (!isGenerating) return;
    
    if (chunk.startsWith('<ERROR>')) {
        handle_generation_error(chunk);
        return;
    }
    
    if (!assistantMessageElement) {
        assistantMessageElement = createMessageElement({ role: 'assistant', content: '' });
        document.getElementById('messagesContainer').appendChild(assistantMessageElement);
    }
    
    const contentDiv = assistantMessageElement.querySelector('.message-content');
    
    // Store raw content and only parse when complete
    if (!contentDiv.dataset.raw) contentDiv.dataset.raw = '';
    contentDiv.dataset.raw += chunk;
    
    // Temporary display with placeholder for unclosed tags
    const tempContent = contentDiv.dataset.raw
        .replace(/<think>/g, '<div class="think-container">')
        .replace(/<\/think>/g, '</div>')
        .replace(/<think(.*?)>/g, '<div class="think-container">');
    
    contentDiv.innerHTML = marked.parse(tempContent);
    
    // Highlight code blocks
    contentDiv.querySelectorAll('pre code').forEach(block => hljs.highlightBlock(block));
    
    // Auto-scroll
    const container = document.getElementById('messagesContainer');
    container.scrollTop = container.scrollHeight;
}

// Expose completion handler
eel.expose(generation_complete);
function generation_complete() {
    document.getElementById('stopButton').style.display = 'none';
    isGenerating = false;
    assistantMessageElement.classList.add("complete");
    if (currentChatId) {
        setTimeout(() => updateChatTitle(currentChatId), 1000);
    }
}

function handle_generation_error(errorChunk) {
    const errorMsg = errorChunk.replace('<ERROR>', '').replace('</ERROR>', '');
    showPopupMessage(`Error: ${errorMsg}`);
    
    if (assistantMessageElement) {
        assistantMessageElement.querySelector('.message-content').textContent = `Error: ${errorMsg}`;
    }
    
    isGenerating = false;
    assistantMessageElement = null;
}
