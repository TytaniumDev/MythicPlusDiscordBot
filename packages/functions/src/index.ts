import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { fetchWeeklyAffixes, refreshAffixes } from './fetchWeeklyAffixes.js';
export { lookupCharacter } from './lookupCharacter.js';
export { refreshCharacterMedia, refreshCharacterMediaNow } from './refreshCharacterMedia.js';
export { onGithubIssueWebhook } from './githubWebhook.js';
