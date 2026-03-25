import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { fetchWeeklyAffixes, refreshAffixes } from './fetchWeeklyAffixes.js';
export { lookupCharacter } from './lookupCharacter.js';
