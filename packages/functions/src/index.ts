import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { fetchWeeklyAffixes } from './fetchWeeklyAffixes.js';
export { lookupCharacter } from './lookupCharacter.js';
export { refreshCharacterMedia } from './refreshCharacterMedia.js';
export { onGithubIssueWebhook } from './githubWebhook.js';
