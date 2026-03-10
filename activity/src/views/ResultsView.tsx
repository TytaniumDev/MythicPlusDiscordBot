import { useState } from 'react';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import { GroupCard } from '../components/GroupCard';
import { isCompleteGroup } from '../store/types';
import type { ViewName } from '../store/types';

interface ResultsViewProps {
  onNavigate: (view: ViewName, opts?: { replace?: boolean }) => void;
}

export function ResultsView({ onNavigate }: ResultsViewProps) {
  const channelData = useAppStore((s) => s.channelData);
  const service = useSessionService();
  const groups = channelData?.groups || [];

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
      <main className="content-area">
        <section id="view-results">
          <h2>All Groups Formed!</h2>
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
            <button
              id="new-round-btn"
              className="btn btn-secondary btn-large"
              onClick={handleNewRound}
            >
              New Round
            </button>
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
              <button
                className="btn btn-secondary"
                onClick={() => setShowReportForm(true)}
              >
                Report Bad Group
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
