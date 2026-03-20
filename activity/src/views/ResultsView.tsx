import { useState } from 'react';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import { useIdentityResolver } from '../hooks/useIdentityResolver';
import { GroupCard } from '../components/GroupCard';
import { HeaderBar } from '../components/HeaderBar';
import { SecondaryButton } from '../components/ui';
import { isCompleteGroup } from '../store/types';
import type { ViewName } from '../store/types';

const RotateIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
  </svg>
);

const FlagIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

interface ResultsViewProps {
  onNavigate: (view: ViewName, opts?: { replace?: boolean }) => void;
}

export function ResultsView({ onNavigate }: ResultsViewProps) {
  const channelData = useAppStore((s) => s.channelData);
  const service = useSessionService();
  const groups = channelData?.groups || [];
  const players = channelData?.players || [];
  useIdentityResolver(players);

  const [showReportForm, setShowReportForm] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  const handleNewRound = async () => {
    try {
      await service.newRound();
      onNavigate('lobby');
    } catch (err) {
      console.error('[Wheelson] Failed to start new round:', err);
      useAppStore.getState().setStatusMessage('Failed to start new round. Please refresh.');
    }
  };

  const handleReportSubmit = async () => {
    if (!reportTitle.trim() || !reportDescription.trim()) return;
    setReportSubmitting(true);
    try {
      await service.reportBadGroup(reportTitle.trim(), reportDescription.trim());
      setReportSubmitted(true);
      setTimeout(() => setReportSubmitted(false), 5000);
      setShowReportForm(false);
      setReportTitle('');
      setReportDescription('');
    } catch (err) {
      console.error('[Wheelson] Failed to report bad group:', err);
      useAppStore.getState().setStatusMessage('Failed to submit report. Please try again.');
    } finally {
      setReportSubmitting(false);
    }
  };

  return (
    <div className="main-layout">
      <HeaderBar
        title="All Groups Formed!"
        titleColor="var(--color-gold)"
        className="app-header"
      />
      <main className="content-area">
        <section id="view-results">
          <div id="final-groups">
            {groups.map((g, i) => {
              const remainder = !isCompleteGroup(g);
              return (
                <GroupCard
                  key={i}
                  group={g}
                  index={i}
                  label={remainder ? 'Remainder' : undefined}
                  hideEmpty={remainder}
                />
              );
            })}
          </div>
          <div className="results-actions">
            <SecondaryButton
              id="new-round-btn"
              large
              icon={<RotateIcon />}
              onClick={handleNewRound}
            >
              New Round
            </SecondaryButton>
            {reportSubmitted ? (
              <p className="report-success">Report submitted. Thank you!</p>
            ) : showReportForm ? (
              <div className="report-form">
                <h3>Report Bad Group</h3>
                <input
                  type="text"
                  placeholder="Issue title"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="report-input"
                  maxLength={100}
                />
                <textarea
                  placeholder="Describe what's wrong with the group formation"
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  className="report-textarea"
                  rows={3}
                  maxLength={500}
                />
                <div className="report-form-actions">
                  <button
                    className="btn btn-primary"
                    onClick={handleReportSubmit}
                    disabled={reportSubmitting || !reportTitle.trim() || !reportDescription.trim()}
                  >
                    {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowReportForm(false)}
                    disabled={reportSubmitting}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <SecondaryButton
                icon={<FlagIcon />}
                onClick={() => setShowReportForm(true)}
              >
                Report Bad Group
              </SecondaryButton>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
