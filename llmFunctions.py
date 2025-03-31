import json, re
from typing import List, Dict, Optional, Generator, Union
import requests
from dataclasses import dataclass, asdict
from enum import Enum
from datetime import datetime
import ollama
import traceback
from dataclasses import dataclass, field
import uuid, logging

class MessageRole(Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    FUNCTION = "function"


@dataclass
class Message:
    role: MessageRole
    content: str
    name: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)

@dataclass
class Chat:
    id: str
    type: str
    title: str
    created_at: datetime
    last_message_at: datetime
    messages: List[Message]
    system_prompt: Optional[str] = None
    model_name: str = "llama2"  # Default model

class Model:
    def __init__(self, base_url: str = "http://localhost:11434", model_name: str = "llama2"):
        self.base_url = base_url
        self.default_model_name = model_name
        self.current_chat: Optional[Chat] = None
        self.chats: Dict[str, Chat] = {}
        self.available_models = self._get_available_models()
        self.stop_generation = False
        print("Model initialized")

    def _get_available_models(self) -> List[Dict[str, str]]:
        try:
            models_dict = ollama.list()
            return [{"value": model.model, "label": model.model} for model in models_dict['models']]
        except Exception:
            return [{"value": "llama2", "label": "llama2"}]

    def get_available_models(self) -> List[Dict[str, str]]:
        return self.available_models



    def generate_title(self, conversation_history: list, previous_title: str = None) -> str:
        """
        Generate a context-aware title for the conversation
        Returns the generated title or existing title if no change needed
        """
        prompt = f'''Generate a concise, relevant title (3-8 words) that captures the core topic of the current conversation. Before generating a new title, you MUST follow these steps:

Check Context: Recall the previous title (if any) and analyze whether the current discussion is still focused on the same core topic.

Decision Criteria: Only generate a new title if:
- The conversation has significantly shifted to a new subject (>50% new context)
- The previous title no longer accurately represents the discussion
- No title exists yet

Previous Title: {previous_title or "None"}
Current Conversation: {"\n".join(conversation_history[-4:])}

Title Quality: Make titles:
- Specific yet concise
- Keyword-rich
- Action-oriented when appropriate
- Free of special characters

Format: Always output the title in this exact format:
[Current Title: "Your Generated Title Here"]'''

        try:
            response = self.plainGen(prompt).response
            match = re.search(r'\[Current Title: "(.*?)"\]', response)
            if match:
                return match.group(1)
            return previous_title or "New Conversation"
        except Exception as e:
            logging.error(f"Title generation failed: {str(e)}")
            return previous_title or "New Conversation"

    def plainGen(self, prompt:str) -> ollama.GenerateResponse:
        response = ollama.generate(
            model=self.current_chat.model_name,
            prompt=prompt
        )
        return response

    def create_chat(self, chat_type: str, model_name: Optional[str] = None) -> Chat:
        if model_name is None:
            model_name = self.default_model_name
        chat_id = str(uuid.uuid4())
        # Create a system prompt message as a Message instance
        system_message = Message(
            role=MessageRole.SYSTEM,
            content=f"This is a system prompt. {self._get_system_prompt(chat_type)}"
        )
        chat = Chat(
            id=chat_id,
            type=chat_type,
            title="New Chat",
            created_at=datetime.now(),
            last_message_at=datetime.now(),
            messages=[system_message],
            model_name=model_name
        )
        self.chats[chat_id] = chat
        self.current_chat = chat
        print(f"Created new chat: {chat_id} - {chat.title}")
        return chat

    def _get_system_prompt(self, chat_type: str) -> str:
        system_prompts = {
            "general": "You are a helpful AI assistant.",
            "code": "You are an expert programming assistant. Provide clear, well-documented code and explanations.",
            "creative": "You are a creative writing assistant. Help with storytelling, poetry, and creative content.",
            "analysis": "You are a data analysis assistant. Help with data interpretation and analysis."
        }
        return system_prompts.get(chat_type, system_prompts["general"])

    def add_message(self, role: MessageRole, content: str, name: Optional[str] = None):
        try:
            if not self.current_chat:
                raise Exception("No active chat")
            message = Message(role=role, content=content, name=name)
            self.current_chat.messages.append(message)
            self.current_chat.last_message_at = datetime.now()
            if role == MessageRole.USER and self.current_chat.title.startswith("New Chat"):
                self.current_chat.title = content[:50] + "..." if len(content) > 50 else content
            print(f"Added message to chat {self.current_chat.id}")
        except Exception as e:
            print(f"Error adding message: {str(e)}")
            traceback.print_exc()
            raise

    def remove_message(self, index: int):
        try:
            if not self.current_chat:
                raise Exception("No active chat")
            if index < 0:
                index = len(self.current_chat.messages) + index
            if index < 0 or index >= len(self.current_chat.messages):
                raise Exception("Invalid message index")
            del self.current_chat.messages[index]
            print(f"Removed message from chat {self.current_chat.id}")
        except Exception as e:
            print(f"Error removing message: {str(e)}")
            traceback.print_exc()
            raise

    def strip_thinking(self, response: str) -> str:
        return re.sub(r'<think>.*?</think>', '', response, flags=re.DOTALL).strip()

    def get_chat(self, chat_id: str) -> Optional[Chat]:
        try:
            print(f"Looking up chat with ID: {chat_id}")
            print(f"Available chat IDs: {list(self.chats.keys())}")
            chat = self.chats.get(chat_id)
            if chat:
                print(f"Found chat: {chat_id} - {chat.title}")
                print(f"Number of messages: {len(chat.messages)}")
                self.current_chat = chat
                return chat
            else:
                print(f"Chat not found: {chat_id}")
                return None
        except Exception as e:
            print(f"Error getting chat: {str(e)}")
            traceback.print_exc()
            return None

    def get_all_chats(self) -> List[Chat]:
        try:
            chats = list(self.chats.values())
            print(f"Retrieved {len(chats)} chats")
            return chats
        except Exception as e:
            print(f"Error getting all chats: {str(e)}")
            traceback.print_exc()
            return []

    def search_chats(self, query: str) -> List[Chat]:
        query = query.lower()
        results = []
        for chat in self.chats.values():
            if query in chat.title.lower():
                results.append(chat)
            else:
                for msg in chat.messages:
                    if query in msg.content.lower():
                        results.append(chat)
                        break
        return results

    def delete_chat(self, chat_id: str):
        try:
            if chat_id in self.chats:
                print(f"Deleting chat: {chat_id}")
                del self.chats[chat_id]
                if self.current_chat and self.current_chat.id == chat_id:
                    self.current_chat = None
            else:
                print(f"Chat {chat_id} not found for deletion")
        except Exception as e:
            print(f"Error deleting chat: {str(e)}")
            traceback.print_exc()
            raise

    def set_current_chat(self, chat_id: str):
        try:
            if chat_id in self.chats:
                self.current_chat = self.chats[chat_id]
                print(f"Set current chat to: {chat_id} - {self.current_chat.title}")
            else:
                raise Exception(f"Chat with ID {chat_id} not found")
        except Exception as e:
            print(f"Error setting current chat: {str(e)}")
            traceback.print_exc()
            raise

    def clear_current_chat(self):
        self.current_chat = None

    def _prepare_messages(self) -> List[Dict]:
        if not self.current_chat:
            raise Exception("No active chat")
        messages = []
        if self.current_chat.system_prompt:
            messages.append({
                "role": MessageRole.SYSTEM.value,
                "content": self.current_chat.system_prompt
            })
        for msg in self.current_chat.messages:
            message_dict = {
                "role": msg.role.value,
                "content": msg.content
            }
            if msg.name:
                message_dict["name"] = msg.name
            messages.append(message_dict)
        print(messages)
        return messages

    def generate(self, prompt: str, stream: bool = True, add_to_history: bool = True) -> Generator[str, None, None]:
        from functions import _save_chats
        
        if not self.current_chat:
            raise Exception("No active chat")
        
        self.stop_generation = False

        if add_to_history:
            self.add_message(MessageRole.USER, prompt)
        
        messages = self._prepare_messages()
        
        try:
            response = ollama.chat(
                model=self.current_chat.model_name,
                messages=messages,
                stream=stream
            )
            
            full_response = ""
            for chunk in response:
                if self.stop_generation:
                    break
                
                content = chunk.get('message', {}).get('content', '')
                if content:
                    full_response += content
                    yield content
            
            # Only save if not stopped
            if not self.stop_generation and add_to_history:
                self.add_message(MessageRole.ASSISTANT, full_response)
            elif add_to_history:  # Save partial response if stopped
                self.add_message(MessageRole.ASSISTANT, full_response)
                _save_chats()
                
        except Exception as e:
            yield f"<ERROR>{str(e)}</ERROR>"

    def _stream_response(self, data: Dict) -> Generator[str, None, None]:
        response = requests.post(
            f"{self.base_url}/api/chat",
            json=data,
            stream=True
        )
        if response.status_code != 200:
            raise Exception(f"Ollama API error: {response.text}")
        for line in response.iter_lines():
            if line:
                chunk = json.loads(line)
                if "message" in chunk and "content" in chunk["message"]:
                    yield chunk["message"]["content"]

    def _get_complete_response(self, data: Dict) -> str:
        response = requests.post(
            f"{self.base_url}/api/chat",
            json=data
        )
        if response.status_code != 200:
            raise Exception(f"Ollama API error: {response.text}")
        result = response.json()
        if "message" in result and "content" in result["message"]:
            return result["message"]["content"]
        return ""

    def get_history(self) -> List[Message]:
        if not self.current_chat:
            raise Exception("No active chat")
        return self.current_chat.messages.copy()
