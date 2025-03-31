from data import Config
import os, signal, uuid
import webview
import shared
from llmFunctions import Model, Message, MessageRole, Chat
import json
from datetime import datetime
import traceback
import logging
import eel

config = Config("kosmos.chat", load_on_get=True)
# Initialize the model (singleton instance used by all functions)
model = Model()

def _save_chats():
    try:
        chats_data = []
        for chat in model.chats.values():
            chat_dict = {
                "id": chat.id,
                "type": chat.type,
                "title": chat.title,
                "created_at": chat.created_at.isoformat(),
                "last_message_at": chat.last_message_at.isoformat(),
                "system_prompt": chat.system_prompt,
                "model_name": chat.model_name,
                "messages": [
                    {
                        "role": msg.role.value,
                        "content": msg.content,
                        "name": msg.name,
                        "timestamp": msg.timestamp.isoformat()
                    }
                    for msg in chat.messages
                ]
            }
            chats_data.append(chat_dict)
        config.set("chats", chats_data)
        logging.info(f"Saved {len(chats_data)} chats to config")
    except Exception as e:
        logging.error(f"Error saving chats: {e}", exc_info=True)

def _load_chats():
    """Load chats from config."""
    try:
        # Clear existing chats
        model.chats.clear()
        
        chats_data = config.get("chats", [])
        print(f"Loading {len(chats_data)} chats from config")
        
        for chat_dict in chats_data:
            try:
                chat = Chat(
                    id=chat_dict["id"],
                    type=chat_dict["type"],
                    title=chat_dict["title"],
                    created_at=datetime.fromisoformat(chat_dict["created_at"]),
                    last_message_at=datetime.fromisoformat(chat_dict["last_message_at"]),
                    system_prompt=chat_dict["system_prompt"],
                    model_name=chat_dict.get("model_name", "llama2"),
                    messages=[
                        Message(
                            role=MessageRole(msg["role"]),
                            content=msg["content"],
                            name=msg["name"],
                            timestamp=datetime.fromisoformat(msg["timestamp"])
                        )
                        for msg in chat_dict["messages"]
                    ]
                )
                model.chats[chat.id] = chat
                print(f"Loaded chat: {chat.id} - {chat.title}")
            except Exception as e:
                print(f"Error loading chat {chat_dict.get('id', 'unknown')}: {str(e)}")
                traceback.print_exc()
                continue
    except Exception as e:
        print(f"Error loading chats: {str(e)}")
        traceback.print_exc()

# Load existing chats on startup
_load_chats()

class funcs:
    def greet():
        return f"Hello, {os.getenv('username')}!"

    def minimize_application():
        webview.active_window().minimize()

    def stop_application():
        print("🛑 Stopping the application...")
        _save_chats()  # Save chats before stopping
        try:
            os.kill(os.getpid(), signal.SIGTERM)
        except Exception as e:
            print(f"Error while stopping: {e}")

    def drag_window(dx, dy):
        window = webview.windows[0]
        try:
            current_x = window.x  
            current_y = window.y
        except AttributeError:
            current_x = 0
            current_y = 0
        new_x = current_x + dx
        new_y = current_y + dy
        window.move(new_x, new_y)

    def enhance_prompt(prompt: str):
        try:
            if not model.current_chat:
                raise Exception("No active chat")
            
            prompt = (
                "Enhance the following prompt to improve its clarity, creativity, and effectiveness. "
                "Return only the final, enhanced prompt with no additional commentary or chain-of-thought."
            )

            response = model.plainGen(prompt).response
            response = model.strip_thinking(response)
            
            return response
        except Exception as e:
            print(f"Error enhancing prompt: {str(e)}")
            traceback.print_exc()
            return f"Error enhancing prompt: {str(e)}"

    def generate_title(chat_id: str):
        try:
            chat = model.get_chat(chat_id)
            if not chat:
                return {"error": "Chat not found"}
            
            # Get last 4 messages for context
            conversation_history = [
                f"{msg.role.value}: {msg.content}" 
                for msg in chat.messages[-4:]
            ]
            
            new_title = model.generate_title(
                conversation_history=conversation_history,
                previous_title=chat.title
            )
            
            # Only update if title changed
            if new_title != chat.title:
                chat.title = new_title
                chat.last_message_at = datetime.now()
                _save_chats()
            
            return {"success": True, "title": new_title}
        except Exception as e:
            logging.error(f"Error generating title: {str(e)}")
            return {"error": str(e)}

    def start_generating(prompt: str):
        try:
            if not model.current_chat:
                raise Exception("No active chat")
            
            model.add_message(MessageRole.USER, prompt, os.getenv("username"))

            # Get the generator - ADD add_to_history=False HERE
            generator = model.generate(prompt, stream=True, add_to_history=False)
            full_response = ""
            
            # Stream chunks to JavaScript
            for chunk in generator:
                full_response += chunk
                eel.receive_chunk(chunk)

            # Add FINAL message ONCE
            model.add_message(MessageRole.ASSISTANT, full_response, model.current_chat.model_name)
            _save_chats()
            eel.generation_complete()
            
        except Exception as e:
            eel.receive_chunk(f"<ERROR>{str(e)}</ERROR>")
            logging.error(f"Generation error: {str(e)}")

    @staticmethod
    def stop_generating():
        model.stop_generation = True
        return {"status": "stopped"}
    
    def current_model_name():
        return model.current_chat.model_name
    
    def username():
        return os.getenv("username")

    def get_title(chat_id):
        if model.current_chat:
            return model.current_chat.title
        
    def get_app_title():
        return shared.app.properties.title

    def get_chat_types():
        return [
            {"value": "general", "label": "General Chat"},
            {"value": "code", "label": "Code Assistant"},
            {"value": "creative", "label": "Creative Writing"},
            {"value": "analysis", "label": "Data Analysis"}
        ]

    def get_available_models():
        return model.get_available_models()

    def get_chats():
        """Get all chats for display. Reloads chats from config to ensure consistency."""
        try:
            _load_chats()  # refresh chats from disk
            chats = model.get_all_chats()
            print(f"Getting {len(chats)} chats for display")
            return [
                {
                    "id": chat.id,
                    "title": chat.title,
                    "type": chat.type,
                    "created_at": chat.created_at.isoformat(),
                    "last_message_at": chat.last_message_at.isoformat()
                }
                for chat in sorted(chats, key=lambda x: x.last_message_at, reverse=True)
            ]
        except Exception as e:
            print(f"Error getting chats: {str(e)}")
            traceback.print_exc()
            return []

    def search_chats(query: str):
        chats = model.search_chats(query)
        return [
            {
                "id": chat.id,
                "title": chat.title,
                "type": chat.type,
                "created_at": chat.created_at.isoformat(),
                "last_message_at": chat.last_message_at.isoformat()
            }
            for chat in sorted(chats, key=lambda x: x.last_message_at, reverse=True)
        ]

    def switch_chat(chat_id: str):
        try:
            model.set_current_chat(chat_id)
            return {"success": True}
        except Exception as e:
            print(f"Error switching chat: {str(e)}")
            traceback.print_exc()
            return {"success": False, "error": str(e)}

    def delete_chat(chat_id: str):
        try:
            model.delete_chat(chat_id)
            _save_chats()
            return {"success": True}
        except Exception as e:
            print(f"Error deleting chat: {str(e)}")
            traceback.print_exc()
            return {"success": False, "error": str(e)}

    def new_chat(chat_type: str = "general", model_name: str = "llama2"):
        try:
            # Use uuid for a unique chat id inside create_chat
            chat = model.create_chat(chat_type, model_name)
            _save_chats()
            print(f"Created new chat: {chat.id} - {chat.title}")
            return {"success": True, "chat_id": chat.id}
        except Exception as e:
            print(f"Error creating new chat: {str(e)}")
            traceback.print_exc()
            return {"success": False, "error": str(e)}

    def get_chat(chat_id: str):
        try:
            print(f"Getting chat with ID: {chat_id}")
            chat = model.get_chat(chat_id)
            if chat:
                print(f"Found chat: {chat.id} - {chat.title} ({len(chat.messages)} messages)")
                return {
                    "id": chat.id,
                    "title": chat.title,
                    "type": chat.type,
                    "created_at": chat.created_at.isoformat(),
                    "last_message_at": chat.last_message_at.isoformat(),
                    "messages": [
                        {
                            "role": msg.role.value,
                            "content": msg.content,
                            "name": msg.name,
                            "timestamp": msg.timestamp.isoformat()
                        }
                        for msg in chat.messages
                    ]
                }
            print(f"Chat not found: {chat_id}")
            return None
        except Exception as e:
            print(f"Error getting chat {chat_id}: {str(e)}")
            traceback.print_exc()
            return None

functionsList = [getattr(funcs, name) for name in dir(funcs) if callable(getattr(funcs, name)) and not name.startswith("__")]
