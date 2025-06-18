# **App Name**: BoardWise

## Core Features:

- Customizable Game Board Designer: Enable users to visually design a game board with drag-and-drop tile placement. The number of tiles can be chosen by the user, up to a maximum of 100. Options include quiz tiles, info tiles, reward tiles, start and finish markers. Adds options to enable or disable punishment mode where the pawn doesn't move on a wrong answer. Also adds an option to randomize the tiles; when pawn 1 lands on tile 2, it could be a quiz (level 2, 3, or 1), an info tile, or even a reward tile. Even if the question itself is the same, the options will be randomized. Add a little tutorial here and there to help the user customize the board; it doesn't need to be fancy, as long as it's easy to use.
- Interactive Quiz Tiles: Incorporate quizzes into the game board, offering three levels of difficulty (Level 1=5pts, Level 2=10pts, Level 3=15pts). Support image uploads for quiz questions and answers. Provides feedback based on responses, acting as a teaching tool.
- Info Tiles: Incorporate info tiles to offer helpful information when a player lands on the tile.
- Shareable Game Board URLs: Generate a shareable URL using Base64 encoding to save and share board configurations. Ensure data integrity of the URL through base64 encoding, making BoardWise suitable for professional educators looking to integrate customized games.
- Customizable Tile Aesthetics: Provide tile customization, including color and icons. Give the users an emoji/icon picker to put on tiles.
- Custom Dice Configuration: Introduce a customizable digital dice with options to set sides from 1 to 12. A digital dice will enforce clear and accessible gameplay.

## Style Guidelines:

- Primary color: Use a vivid blue (#29ABE2) to create a digital learning environment, instilling calmness.
- Background color: A very light blue (#E0F7FA) acts to keep an airy feel.
- Accent color: Choose an orange hue (#FF914D). Orange adds creative energy, contrasting against the dominant light-blue palette to draw the eye.
- Font pairing: 'Poppins' for headlines, giving a clean modern look, paired with 'PT Sans' (sans-serif) for the body.
- Employ a set of vibrant, friendly icons to denote each tile category; the quiz icon could feature a question mark enclosed in a chat bubble, for instance.
- Use a fully responsive grid layout with clear visual hierarchy for intuitive customization. A fixed sidebar can allow quick navigation through options without disrupting the user experience.
- Incorporate animations that use movement in dice rolls and tile transitions to clarify their actions and increase engagement, with attention to minimizing distracting movements. Add simple animations of dice rolling and moving pawns, along with sounds for rolling dice, correct/wrong answers, and finishing.