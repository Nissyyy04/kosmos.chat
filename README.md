# Kosmos Chat

Kosmos Chat is a modular chat application built with Python and modern web technologies (HTML, CSS, JavaScript). It runs natively on your system, providing a seamless, local experience for integrating large language model functionalities and interactive conversational AI.

## Features

- **Native Execution:** Runs directly on your machine without the need for additional virtualization or containerization.
- **Chat Interface:** A web-based UI offering real-time conversation through your default browser.
- **Language Model Integration:** Leverages custom LLM functions to generate intelligent responses.
- **Prompt Management:** Organized prompt templates stored in the `prompts` folder for versatile interactions.
- **Modular Architecture:** Separates core functions (`functions.py`), LLM-specific routines (`llmFunctions.py`), and shared utilities (`shared.py`).
- **Data-Driven Configuration:** Uses the `data` folder to manage configuration files and static assets.
- **Web Integration:** The `webfolder` contains front-end assets ensuring a responsive and dynamic user experience.

## Project Structure

```
kosmos.chat/
├── data/              # Contains configuration files and static data.
├── prompts/           # Directory for prompt templates used in chat sessions.
├── webfolder/         # Web assets (HTML, CSS, JavaScript) for the UI.
├── .gitignore         # Specifies files and directories to be ignored by Git.
├── functions.py       # Contains general helper functions.
├── llmFunctions.py    # Implements functions specific to language model interactions.
├── main.py            # Entry point of the application.
└── shared.py          # Shared utilities and configurations.
```

## Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/Nissyyy04/kosmos.chat.git
   cd kosmos.chat
   ```

2. **Set Up a Virtual Environment (Optional but Recommended):**

   ```bash
   python -m venv env
   source env/bin/activate  # On Windows: env\Scripts\activate
   ```

3. **Install Dependencies:**

   Ensure you have Python 3.8+ installed. Then, install any required dependencies (if available, refer to a `requirements.txt` file):

   ```bash
   pip install -r requirements.txt
   ```

   _Note: If no requirements file exists, review the source code to identify necessary packages._

## Usage

- **Run the Application:**

  Execute the main script to start Kosmos Chat:

  ```bash
  python main.py
  ```

- **Access the Chat Interface:**

  Kosmos Chat will run natively, starting a local server. If needed open your browser and navigate to the designated URL (typically `http://localhost:8000` or as configured) to interact with the application.

- **Customization:**

  - Update prompt templates in the `prompts` folder.
  - Modify configuration settings or static data in the `data` folder.
  - Adjust web assets in the `webfolder` to tailor the UI to your needs.

## Contributing

Contributions are welcome. If you have suggestions or improvements, please open an issue or submit a pull request. For major changes, please discuss them via GitHub Issues before proceeding.

## License

_No license has been specified for this project._  
If you plan to share or modify the project, consider adding a license to clarify usage rights.

## Acknowledgments

- Thanks to all contributors and the open source community for inspiration and tools.
- Special mention to any libraries or frameworks utilized in this project.
