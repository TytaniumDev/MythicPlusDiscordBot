import { FirebaseService, SERVER_TIMESTAMP } from '../core/firebaseService.js';

export interface TrackIssueData {
  issueNumber: number;
  discordUserId: string;
  issueUrl: string;
  issueTitle: string;
}

export class IssueTrackingService {
  private firebase: FirebaseService;

  constructor(firebase?: FirebaseService) {
    this.firebase = firebase ?? FirebaseService.getInstance();
  }

  async trackIssue(data: TrackIssueData): Promise<void> {
    if (!this.firebase.db) return;

    const docRef = this.firebase.db.collection('issueTracking').doc(String(data.issueNumber));
    await docRef.set({
      discordUserId: data.discordUserId,
      issueUrl: data.issueUrl,
      issueTitle: data.issueTitle,
      createdAt: SERVER_TIMESTAMP,
    });
  }
}
