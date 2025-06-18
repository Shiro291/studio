
export function playSound(soundName: string): void {
  // In a real app, you'd use a library like Howler.js or the Web Audio API
  // For now, we just log the event.
  console.log(`PLAY_SOUND_EVENT: ${soundName}`);
  // Possible sound names: 'diceRoll', 'correctAnswer', 'wrongAnswer', 'finishSound', 'pawnHop'
}
