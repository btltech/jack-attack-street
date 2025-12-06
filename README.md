# Jack Attack Street - Phase 1

Hi! I am your game dev tutor. I have set up the foundation for **Jack Attack Street** as you requested.

## 1. The Plan & Tech Stack
We are building the Phase 1 Web App using:
- **React 18** for the UI.
- **TypeScript** for type-safe code.
- **Tailwind CSS** for easy styling.
- **Core Logic Separation**: We have placed all game logic in a `core/` folder. This is pure TypeScript (no React), making it ready for your future React Native mobile app.

## 2. Folder Structure
Here is the clean structure I have created for you:

```text
/
├── index.html        (The entry HTML file)
├── index.tsx         (The React entry point - often 'main.tsx' in Vite)
├── App.tsx           (The main screen of your app)
├── core/             (ALL game logic lives here)
│   ├── types.ts      (Definitions of Cards, Suits, Ranks)
│   └── game.ts       (Logic to create and shuffle the deck)
└── components/       (Reusable UI components will go here later)
```

## 3. Terminal Commands (for your local machine)
If you were running this locally, you would run these commands:

1.  **Create the project:**
    ```bash
    npm create vite@latest jack-attack-street -- --template react-ts
    cd jack-attack-street
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Start the server:**
    ```bash
    npm run dev
    ```

*Note: In this environment, the code is already generated for you below.*

## 4. Next Steps implemented below
I have created the first basic files for you:
1.  **`core/types.ts`**: Defines what a `Card` is (Suit + Rank).
2.  **`core/game.ts`**: Creates a standard 52-card deck and includes a shuffle function.
3.  **`App.tsx`**: A simple screen to verify everything is working.

Go ahead and explore the files!