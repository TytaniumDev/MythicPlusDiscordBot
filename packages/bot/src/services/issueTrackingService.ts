import { FirebaseService, SERVER_TIMESTAMP } from '../core/firebaseService.js';

export interface TrackIssueData {
  issueNumber: number;
  discordUserId: string;
  issueUrl: string;
  issueTitle: string;
}

export class IssueTrackingService {
  async trackIssue(data: TrackIssueData): Promise<void> {
    const firebase = FirebaseService.getInstance();
    if (!firebase.db) return;

    const docRef = firebase.db.collection('issueTracking').doc(String(data.issueNumber));
    await docRef.set({
      discordUserId: data.discordUserId,
      issueUrl: data.issueUrl,
      issueTitle: data.issueTitle,
      createdAt: SERVER_TIMESTAMP,
    });
  }

  async deleteTracking(issueNumber: number): Promise<void> {
    const firebase = FirebaseService.getInstance();
    if (!firebase.db) return;

    const docRef = firebase.db.collection('issueTracking').doc(String(issueNumber));
    await docRef.delete();
  }
}
